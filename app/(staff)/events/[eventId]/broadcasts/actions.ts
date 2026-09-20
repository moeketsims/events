'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMany, type SendInput } from '@/lib/messaging';
import { passUrl } from '@/lib/qr';
import { AUDIENCES } from './audience';

export type SendBroadcastState = {
  error?: string;
  report?: {
    /** Attendees the message was written to. */
    recipients: number;
    inApp: { sent: number; failed: number };
    whatsapp: { sent: number; failed: number; skipped: number };
    /** The first few failures, so a wrong key is diagnosable from the page. */
    problems: { name: string; channel: string; error: string }[];
  };
};

/**
 * BUILD-SPEC §8 caps a single send at 200 recipients; anything larger is
 * chunked from the client, which the POC does not need.
 */
const MAX_RECIPIENTS = 200;

const schema = z.object({
  eventId: z.uuid(),
  body: z.string().trim().min(1, 'Write the message first.').max(2000),
  audience: z.enum(AUDIENCES),
  channels: z.array(z.enum(['whatsapp'])),
});

/**
 * Send a message to the room — TASKS T3.1, BUILD-SPEC §7.1 and §7.3.
 *
 * One `broadcasts` row, then one `in_app` delivery per attendee in the chosen
 * audience: that row *is* the in-app delivery, because the pass feed reads its
 * own rows and nothing else. So who was in the audience is settled here, once,
 * and a guest scanned in a minute later does not inherit a message that was
 * about the room before they arrived.
 *
 * WhatsApp goes to the contact, not the attendee: a plus-one shares their
 * host's number, so a household is messaged once. It goes only where the
 * contact has a number and has opted in, which Meta requires and POPIA obliges
 * us to be able to evidence.
 *
 * Only after every delivery row is written does `notify_broadcast` fire the
 * realtime event, so a pass page that refetches the moment it hears sees the
 * message it was told about.
 */
export async function sendBroadcast(
  _prev: SendBroadcastState,
  formData: FormData,
): Promise<SendBroadcastState> {
  // BUILD-SPEC §4.5 gives `broadcasts` and `message_deliveries` to the
  // organiser alone, so the desk is organiser-only and every write below goes
  // through the session client, where RLS enforces the same rule.
  const profile = await requireStaff(['organiser']);

  const parsed = schema.safeParse({
    eventId: formData.get('eventId'),
    body: formData.get('body'),
    audience: formData.get('audience'),
    channels: formData.getAll('channels').map(String),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const { eventId, body, audience, channels } = parsed.data;
  const withWhatsApp = channels.includes('whatsapp');
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, title, status')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) return { error: 'That event is not in your department.' };
  if (event.status === 'draft') {
    return { error: 'Publish the event before broadcasting to its guests.' };
  }

  let query = supabase
    .from('attendees')
    .select(
      'id, contact_id, display_name, pass_token, checked_in_at, contacts(phone_e164, whatsapp_opt_in)',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (audience === 'checked_in') query = query.not('checked_in_at', 'is', null);
  if (audience === 'not_arrived') query = query.is('checked_in_at', null);

  const { data: attendees, error: readError } = await query;
  if (readError) return { error: `The guest list could not be read: ${readError.message}` };

  const recipients = attendees ?? [];
  if (recipients.length === 0) {
    return {
      error:
        audience === 'checked_in'
          ? 'Nobody has been checked in yet, so there is nobody in the room to reach.'
          : 'Nobody on the guest list matches that choice.',
    };
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return {
      error: `That audience is ${recipients.length} guests. A single send is limited to ${MAX_RECIPIENTS}; narrow the audience.`,
    };
  }

  const { data: broadcast, error: insertError } = await supabase
    .from('broadcasts')
    .insert({
      event_id: eventId,
      author_id: profile.id,
      body,
      audience: { segment: audience },
      channels: withWhatsApp ? ['in_app', 'whatsapp'] : ['in_app'],
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !broadcast) {
    return { error: `The message could not be saved: ${insertError?.message ?? 'unknown'}` };
  }

  const jobs: { name: string; input: SendInput }[] = [];
  const messaged = new Set<string>();
  let skippedWhatsApp = 0;

  for (const attendee of recipients) {
    const data = {
      eventTitle: event.title,
      body,
      passUrl: passUrl(attendee.pass_token),
    };

    jobs.push({
      name: attendee.display_name,
      input: {
        kind: 'broadcast',
        channel: 'in_app',
        eventId,
        contactId: attendee.contact_id,
        attendeeId: attendee.id,
        broadcastId: broadcast.id,
        to: {},
        data,
      },
    });

    if (!withWhatsApp) continue;

    const contact = attendee.contacts;
    if (!attendee.contact_id || !contact?.phone_e164 || !contact.whatsapp_opt_in) {
      skippedWhatsApp++;
      continue;
    }
    // One message per household: a plus-one shares the host's number.
    if (messaged.has(attendee.contact_id)) continue;
    messaged.add(attendee.contact_id);

    jobs.push({
      name: attendee.display_name,
      input: {
        kind: 'broadcast',
        channel: 'whatsapp',
        eventId,
        contactId: attendee.contact_id,
        attendeeId: attendee.id,
        broadcastId: broadcast.id,
        to: { phone: contact.phone_e164 },
        data,
      },
    });
  }

  const results = await sendMany(jobs.map((job) => job.input));

  const report: NonNullable<SendBroadcastState['report']> = {
    recipients: recipients.length,
    inApp: { sent: 0, failed: 0 },
    whatsapp: { sent: 0, failed: 0, skipped: skippedWhatsApp },
    problems: [],
  };

  results.forEach((result, index) => {
    const job = jobs[index];
    if (!job) return;
    const bucket = job.input.channel === 'whatsapp' ? report.whatsapp : report.inApp;
    if (result.status === 'sent') {
      bucket.sent++;
    } else {
      bucket.failed++;
      report.problems.push({
        name: job.name,
        channel: job.input.channel,
        error: result.error ?? 'unknown_error',
      });
    }
  });

  // The rows are written; now tell every open pass page to come and read them.
  // `notify_broadcast` is service-role only (0006), hence the admin client.
  const { error: notifyError } = await createAdminClient().rpc('notify_broadcast', {
    p_broadcast_id: broadcast.id,
  });
  if (notifyError) {
    // The message is delivered — every pass page will pick it up on its next
    // poll or load. Only the instant push failed, and that is worth saying.
    report.problems.unshift({
      name: 'Live update',
      channel: 'realtime',
      error: notifyError.message,
    });
  }

  revalidatePath(`/events/${eventId}/broadcasts`);
  revalidatePath(`/events/${eventId}`);

  return { report: { ...report, problems: report.problems.slice(0, 8) } };
}
