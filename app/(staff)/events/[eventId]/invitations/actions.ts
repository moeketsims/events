'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { sendMany, type SendInput } from '@/lib/messaging';
import { APP_URL } from '@/lib/env';
import { formatEventDate } from '@/lib/dates';
import type { Database } from '@/lib/db/types';
import { AUDIENCES } from './audience';

type DeliveryChannel = Database['public']['Enums']['delivery_channel'];

export type SendInvitationsState = {
  error?: string;
  report?: {
    recipients: number;
    sent: number;
    failed: number;
    /** The first few failures, so a wrong key is diagnosable from the page. */
    problems: { name: string; channel: string; error: string }[];
  };
};

const schema = z.object({
  eventId: z.uuid(),
  body: z.string().trim().max(4000).optional(),
  audience: z.enum(AUDIENCES),
  channels: z.array(z.enum(['email', 'whatsapp'])).min(1, 'Choose at least one channel.'),
});

/**
 * Send the invitation to a chosen slice of the guest list — TASKS T2.3.
 *
 * The RSVP link is the guest's whole credential, so it is built here from the
 * token already stored on the invitation rather than minted again: re-signing
 * would silently invalidate a link an earlier send already put in an inbox.
 *
 * A guest with no email address is not sent an email, and one who has not
 * opted in to WhatsApp is not sent a WhatsApp message. Both are reported rather
 * than passed over, because an organiser watching a funnel needs to know the
 * difference between "not sent" and "sent and bounced".
 */
export async function sendInvitations(
  _prev: SendInvitationsState,
  formData: FormData,
): Promise<SendInvitationsState> {
  await requireStaff(['organiser']);

  const parsed = schema.safeParse({
    eventId: formData.get('eventId'),
    body: formData.get('body') || undefined,
    audience: formData.get('audience'),
    channels: formData.getAll('channels').map(String),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const { eventId, body, audience, channels } = parsed.data;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, title, starts_at, venue_name, status')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) return { error: 'That event is not in your department.' };
  if (event.status === 'draft') {
    return { error: 'Publish the event before inviting anyone to it.' };
  }

  let query = supabase
    .from('invitations')
    .select(
      'id, token, status, sent_via, first_sent_at, contact_id, contacts(first_name, last_name, email, phone_e164, whatsapp_opt_in)',
    )
    .eq('event_id', eventId);

  if (audience === 'pending') query = query.eq('status', 'pending');
  if (audience === 'not_sent') query = query.is('first_sent_at', null);

  const { data: invitations, error: readError } = await query;
  if (readError) return { error: `The guest list could not be read: ${readError.message}` };

  const recipients = invitations ?? [];
  if (recipients.length === 0) {
    return { error: 'Nobody on the guest list matches that choice.' };
  }

  const startsAt = formatEventDate(event.starts_at);

  const jobs: { invitationId: string; name: string; input: SendInput }[] = [];

  for (const invitation of recipients) {
    const contact = invitation.contacts;
    if (!contact) continue;

    const name = `${contact.first_name} ${contact.last_name}`;
    const data = {
      firstName: contact.first_name,
      lastName: contact.last_name,
      eventTitle: event.title,
      startsAt,
      venue: event.venue_name ?? '',
      rsvpUrl: `${APP_URL}/rsvp/${invitation.token}`,
      body,
    };

    if (channels.includes('email') && contact.email) {
      jobs.push({
        invitationId: invitation.id,
        name,
        input: {
          kind: 'invite',
          channel: 'email',
          eventId,
          contactId: invitation.contact_id,
          to: { email: contact.email },
          data,
        },
      });
    }

    // WhatsApp only where the contact has agreed to it. Meta requires the
    // consent, and POPIA requires us to be able to show it was given.
    if (channels.includes('whatsapp') && contact.phone_e164 && contact.whatsapp_opt_in) {
      jobs.push({
        invitationId: invitation.id,
        name,
        input: {
          kind: 'invite',
          channel: 'whatsapp',
          eventId,
          contactId: invitation.contact_id,
          to: { phone: contact.phone_e164 },
          data,
        },
      });
    }
  }

  if (jobs.length === 0) {
    return {
      error:
        channels.includes('whatsapp') && !channels.includes('email')
          ? 'None of those guests has a phone number and a WhatsApp opt-in.'
          : 'None of those guests has an address on the chosen channels.',
    };
  }

  const results = await sendMany(jobs.map((job) => job.input));

  // Record on each invitation which channels actually carried it, and when it
  // first went out. `sent_via` accumulates: an invitation emailed on Monday and
  // WhatsApped on Tuesday has been sent through both.
  const sentChannels = new Map<string, Set<DeliveryChannel>>();
  const problems: { name: string; channel: string; error: string }[] = [];
  let sent = 0;

  results.forEach((result, index) => {
    const job = jobs[index];
    if (!job) return;

    if (result.status === 'sent') {
      sent++;
      const set = sentChannels.get(job.invitationId) ?? new Set<DeliveryChannel>();
      set.add(job.input.channel);
      sentChannels.set(job.invitationId, set);
    } else {
      problems.push({
        name: job.name,
        channel: job.input.channel,
        error: result.error ?? 'unknown_error',
      });
    }
  });

  const now = new Date().toISOString();
  for (const invitation of recipients) {
    const channelsSent = sentChannels.get(invitation.id);
    if (!channelsSent || channelsSent.size === 0) continue;

    const merged = Array.from(new Set([...invitation.sent_via, ...channelsSent]));

    await supabase
      .from('invitations')
      .update({
        sent_via: merged,
        first_sent_at: invitation.first_sent_at ?? now,
      })
      .eq('id', invitation.id);
  }

  revalidatePath(`/events/${eventId}/invitations`);
  revalidatePath(`/events/${eventId}/guests`);
  revalidatePath(`/events/${eventId}`);

  return {
    report: {
      recipients: recipients.length,
      sent,
      failed: problems.length,
      problems: problems.slice(0, 8),
    },
  };
}
