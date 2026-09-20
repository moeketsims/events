import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { optionalEnv } from '@/lib/env';
import { render } from './templates';
import * as resend from './email.resend';
import * as brevo from './email.brevo';
import { isConfigured as whatsappConfigured, sendWhatsApp } from './whatsapp.meta';
import { sendSms } from './sms.noop';
import type { ProviderResult, SendInput, SendResult } from './types';

export * from './types';
export { render, applyMergeFields, MERGE_FIELDS, DEFAULT_INVITE_BODY } from './templates';

/**
 * The one way a message leaves the platform — BUILD-SPEC §8.
 *
 * Every call writes a `message_deliveries` row *before* it calls the provider,
 * then updates it with the outcome. That ordering is deliberate: if the process
 * dies mid-send, the log shows a `queued` row rather than nothing, and the
 * organiser can see that something was attempted. A provider that is not
 * configured is not an exception — it returns `failed` with error
 * `not_configured`, so the rest of the platform keeps working while the keys
 * are still being arranged.
 *
 * The admin client is used because deliveries are written on behalf of a guest
 * as well as of staff: the RSVP page has no session at all.
 */

type EmailProvider = {
  isConfigured(): boolean;
  sendEmail(input: {
    to: string;
    message: ReturnType<typeof render>;
    kind: string;
  }): Promise<ProviderResult>;
};

function emailProvider(): { name: 'resend' | 'brevo'; provider: EmailProvider } {
  return optionalEnv('EMAIL_PROVIDER') === 'brevo'
    ? { name: 'brevo', provider: brevo }
    : { name: 'resend', provider: resend };
}

/** Which channels can actually deliver right now, for the composer's warnings. */
export function channelReadiness(): Record<'email' | 'whatsapp' | 'sms', boolean> {
  return {
    email: emailProvider().provider.isConfigured(),
    whatsapp: whatsappConfigured(),
    sms: false,
  };
}

export async function send(input: SendInput): Promise<SendResult> {
  const admin = createAdminClient();
  const message = render(input.kind, input.data);

  const recipient =
    input.channel === 'email'
      ? (input.to.email ?? '')
      : input.channel === 'in_app'
        ? (input.attendeeId ?? '')
        : (input.to.phone ?? '');

  const provider =
    input.channel === 'email'
      ? emailProvider().name
      : input.channel === 'whatsapp'
        ? 'meta'
        : input.channel === 'in_app'
          ? 'in_app'
          : 'sms';

  const { data: delivery } = await admin
    .from('message_deliveries')
    .insert({
      kind: input.kind,
      event_id: input.eventId,
      contact_id: input.contactId ?? null,
      attendee_id: input.attendeeId ?? null,
      broadcast_id: input.broadcastId ?? null,
      channel: input.channel,
      recipient,
      provider,
      status: 'queued',
    })
    .select('id')
    .single();

  const deliveryId = delivery?.id ?? null;

  const result = await deliver(input, message, recipient);

  if (deliveryId) {
    await admin
      .from('message_deliveries')
      .update({
        status: result.status === 'sent' ? 'sent' : 'failed',
        provider_message_id: result.providerMessageId ?? null,
        error: result.error ?? null,
        sent_at: result.status === 'sent' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliveryId);
  }

  return { deliveryId, ...result };
}

async function deliver(
  input: SendInput,
  message: ReturnType<typeof render>,
  recipient: string,
): Promise<ProviderResult> {
  switch (input.channel) {
    case 'in_app':
      // There is no provider. The delivery row *is* the delivery: the pass page
      // reads its own in_app rows, so writing one is what puts the message in
      // front of the guest.
      return recipient
        ? { status: 'sent' }
        : { status: 'failed', error: 'no_attendee_for_in_app_delivery' };

    case 'email': {
      if (!recipient) return { status: 'failed', error: 'no_email_address' };
      return emailProvider().provider.sendEmail({
        to: recipient,
        message,
        kind: input.kind,
      });
    }

    case 'whatsapp': {
      if (!recipient) return { status: 'failed', error: 'no_phone_number' };
      // The pass is sent as an image with the QR and a caption, so the guest can
      // show the picture at the door even with no signal in the foyer.
      return message.whatsappImageUrl
        ? sendWhatsApp({
            to: recipient,
            payload: {
              type: 'image',
              imageUrl: message.whatsappImageUrl,
              caption: message.whatsappText,
            },
          })
        : sendWhatsApp({ to: recipient, payload: { type: 'text', body: message.whatsappText } });
    }

    case 'sms': {
      if (!recipient) return { status: 'failed', error: 'no_phone_number' };
      return sendSms({ to: recipient, body: message.whatsappText });
    }

    default:
      return { status: 'failed', error: 'unknown_channel' };
  }
}

/**
 * Send to many recipients with a small amount of concurrency.
 *
 * Five at a time: enough that forty invitations finish inside the 60-second
 * Vercel Hobby limit, low enough that Resend's and Meta's per-second rate
 * limits are never the reason a guest is missed. Nothing throws — each entry
 * reports its own outcome.
 */
export async function sendMany(inputs: SendInput[], concurrency = 5): Promise<SendResult[]> {
  const results: SendResult[] = new Array(inputs.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const index = next++;
      const input = inputs[index];
      if (!input) return;
      try {
        results[index] = await send(input);
      } catch (error) {
        results[index] = {
          deliveryId: null,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, worker));
  return results;
}
