'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { newTokenId, signToken } from '@/lib/auth/pass';
import { resolveJoinToken } from '@/lib/auth/join';
import { storePassPng, passUrl } from '@/lib/qr';
import { send } from '@/lib/messaging';
import { formatEventDate } from '@/lib/dates';
import { CONSENT_PURPOSE, CONSENT_SOURCE, CONSENT_VERSION } from '@/lib/consent';

export type JoinState = {
  error?: string;
  result?: {
    outcome: 'registered' | 'existing' | 'ignored';
    firstName?: string;
    email?: string;
    bidderNumber?: number | null;
    passPath?: string;
    passUrl?: string;
    sent?: { email: boolean };
  };
};

const schema = z.object({
  token: z.string().min(40).max(60),
  firstName: z.string().trim().min(1, 'Your first name is needed.').max(80),
  lastName: z.string().trim().min(1, 'Your surname is needed.').max(80),
  email: z.email('That email address could not be read.'),
  consent: z.literal(true, { message: 'Please tick the box so we may keep your details.' }),
  website: z.string().max(200).optional(), // honeypot
});

const NOT_VALID = 'This code is not valid. Ask a member of staff at the door.';
const CLOSED = 'Registration for this event is closed.';
const TOO_MANY = 'Too many attempts from this connection. Ask a member of staff at the door.';

/**
 * Five submissions per ten minutes per client IP, in memory, the same pattern
 * as `/api/bid`. A courtesy against a runaway script, not a security control:
 * it resets when the instance recycles and every instance keeps its own.
 */
const WINDOW_MS = 10 * 60_000;
const MAX_IN_WINDOW = 5;
const recent = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const hits = (recent.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);

  if (recent.size > 5000) {
    for (const [key, times] of recent) {
      if (times.every((at) => now - at >= WINDOW_MS)) recent.delete(key);
    }
  }

  return hits.length > MAX_IN_WINDOW;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim() || 'unknown';
  return h.get('x-real-ip') ?? 'unknown';
}

/**
 * A guest registers themselves from the QR on the table — docs/07 §2.4.
 *
 * There is no session. The `j.` token in the form is re-resolved against the
 * event row on every call, and everything runs through the admin client. The
 * steps mirror `/api/walkin` exactly: match or create the contact, record the
 * consent, find or create the attendee, check in through `check_in_attendee`
 * (which assigns the bidder number), store the QR, email the pass. The
 * response carries the guest's own first name and their own pass, nothing else.
 */
export async function joinEvent(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = schema.safeParse({
    token: formData.get('token'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    consent: formData.get('consent') === 'on',
    website: formData.get('website') ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' };
  }

  const input = parsed.data;

  // Honeypot: a bot filled the field a person never sees. Say thank you and
  // write nothing.
  if (input.website && input.website.length > 0) {
    return { result: { outcome: 'ignored' } };
  }

  if (rateLimited(await clientIp())) return { error: TOO_MANY };

  const admin = createAdminClient();

  const event = await resolveJoinToken(admin, input.token);
  if (!event) return { error: NOT_VALID };
  if (event.status !== 'published' && event.status !== 'live') return { error: CLOSED };

  const email = input.email.toLowerCase();

  // Match before creating: the guest at the table is often someone who was
  // invited and never replied. A matched contact keeps its own spelling of
  // the name.
  const { data: matched } = await admin
    .from('contacts')
    .select('id')
    .eq('department_id', event.department_id)
    .eq('email', email)
    .maybeSingle();

  let contactId = matched?.id ?? null;

  if (!contactId) {
    const { data, error } = await admin
      .from('contacts')
      .insert({
        department_id: event.department_id,
        first_name: input.firstName,
        last_name: input.lastName,
        email,
        tags: ['walk-in', 'self-registered'],
      })
      .select('id')
      .single();

    if (error) return { error: `Your details could not be saved: ${error.message}` };
    contactId = data.id;
  }

  // Already an attendee of this event? Then this is their pass, not a new one.
  const { data: existing } = await admin
    .from('attendees')
    .select('id, pass_token')
    .eq('event_id', event.id)
    .eq('contact_id', contactId)
    .eq('is_plus_one', false)
    .maybeSingle();

  const outcome: 'registered' | 'existing' = existing ? 'existing' : 'registered';

  // One consent row per registration, not per tap of the button: a guest who
  // scans the code twice has agreed once (docs/07 §2.11 check 8).
  if (!existing) {
    await admin.from('consents').insert({
      contact_id: contactId,
      purpose: CONSENT_PURPOSE.eventComms,
      channel: 'email',
      wording_version: CONSENT_VERSION,
      source: CONSENT_SOURCE.selfRegistration,
    });
  }
  let attendeeId = existing?.id ?? null;
  let passToken = existing?.pass_token ?? null;

  if (!attendeeId || !passToken) {
    const id = newTokenId();
    const token = signToken('p', id);
    const { error } = await admin.from('attendees').insert({
      id,
      event_id: event.id,
      contact_id: contactId,
      display_name: `${input.firstName} ${input.lastName}`,
      is_walk_in: true,
      pass_token: token,
    });
    if (error) return { error: `Your pass could not be issued: ${error.message}` };
    attendeeId = id;
    passToken = token;
  }

  // The QR on the table is proof of arrival, so registering is checking in.
  // `already_checked_in` is not an error: the number shown is the one they have.
  const { data, error } = await admin.rpc('check_in_attendee', {
    p_attendee_id: attendeeId,
    // Nullable in the schema (0004); the generated type does not say so.
    p_staff_id: null as unknown as string,
    p_event_id: event.id,
  });

  if (error) return { error: `You could not be checked in: ${error.message}` };

  const row = Array.isArray(data) ? data[0] : data;
  const bidderNumber = row?.bidder_number ?? null;

  const qrImageUrl = await storePassPng(attendeeId, passToken);

  // The screen is the guarantee; the email is the convenience. A failed send is
  // recorded by the messaging layer and never fails the registration.
  const sent = await send({
    kind: 'pass',
    channel: 'email',
    eventId: event.id,
    contactId,
    attendeeId,
    to: { email },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      eventTitle: event.title,
      startsAt: formatEventDate(event.starts_at),
      venue: event.venue_name ?? '',
      passUrl: passUrl(passToken),
      qrImageUrl: qrImageUrl ?? undefined,
    },
  });

  await admin.rpc('log_audit', {
    p_actor_id: null as unknown as string,
    p_action: 'attendee.self_registered',
    p_entity: 'attendee',
    p_entity_id: attendeeId,
    p_metadata: { event_id: event.id, outcome, bidder_number: bidderNumber },
  });

  return {
    result: {
      outcome,
      firstName: input.firstName,
      email,
      bidderNumber,
      passPath: `/p/${passToken}`,
      passUrl: passUrl(passToken),
      sent: { email: sent.status === 'sent' },
    },
  };
}
