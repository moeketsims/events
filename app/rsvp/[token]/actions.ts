'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { newTokenId, signToken, verifyTokenOfKind } from '@/lib/auth/pass';
import { storePassPng, passUrl } from '@/lib/qr';
import { send } from '@/lib/messaging';
import { formatEventDate } from '@/lib/dates';
import { CONSENT_PURPOSE, CONSENT_SOURCE, CONSENT_VERSION } from '@/lib/consent';

export type RsvpState = {
  error?: string;
  result?: {
    outcome: 'accepted' | 'declined' | 'waitlisted';
    passUrl?: string;
    guestCount?: number;
    /** Whether the pass actually went out, and on which channels. */
    sent?: { email: boolean; whatsapp: boolean };
  };
};

const schema = z.object({
  token: z.string().min(10).max(80),
  attending: z.enum(['yes', 'no']),
  guestCount: z.coerce.number().int().min(1).max(10).default(1),
  guestNames: z.array(z.string().trim().max(120)).max(9).default([]),
  whatsappOptIn: z.boolean(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
});

/**
 * A guest's reply — TASKS T2.4.
 *
 * There is no session here. The signed `r.` token in the URL is the whole
 * credential, so everything runs through the admin client and every read is
 * pinned to the invitation the token resolves to. Nothing the form sends
 * decides *which* invitation is written; only the token does.
 */
export async function submitRsvp(_prev: RsvpState, formData: FormData): Promise<RsvpState> {
  const raw = {
    token: formData.get('token'),
    attending: formData.get('attending'),
    guestCount: formData.get('guestCount') || 1,
    guestNames: formData.getAll('guestNames').map(String),
    whatsappOptIn: formData.get('whatsappOptIn') === 'on',
    answers: readAnswers(formData),
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'Something in the form was not understood. Please try again.' };
  }

  const input = parsed.data;
  const invitationId = verifyTokenOfKind(input.token, 'r');
  if (!invitationId) return { error: 'This invitation link is not valid.' };

  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from('invitations')
    .select(
      'id, event_id, contact_id, status, contacts(first_name, last_name, email, phone_e164, whatsapp_opt_in)',
    )
    .eq('id', invitationId)
    .maybeSingle();

  if (!invitation || !invitation.contacts) {
    return { error: 'This invitation link is not valid.' };
  }

  const { data: event } = await admin
    .from('events')
    .select(
      'id, title, starts_at, ends_at, venue_name, venue_address, capacity, rsvp_deadline, allow_plus_ones, status, auction_enabled',
    )
    .eq('id', invitation.event_id)
    .maybeSingle();

  if (!event) return { error: 'This event is no longer available.' };

  if (event.rsvp_deadline && new Date(event.rsvp_deadline) < new Date()) {
    return { error: 'Replies for this event have closed. Please contact the organiser.' };
  }
  if (event.status === 'closed' || event.status === 'archived') {
    return { error: 'This event is over.' };
  }

  const contact = invitation.contacts;
  const attending = input.attending === 'yes';
  const guestCount = event.allow_plus_ones && attending ? input.guestCount : 1;

  // ---- capacity ----
  //
  // Seats are counted from every *other* accepted invitation, so a guest who
  // changes from two seats to one frees one, and re-submitting the same answer
  // never pushes them over their own head.
  let outcome: 'accepted' | 'declined' | 'waitlisted' = attending ? 'accepted' : 'declined';

  if (attending && event.capacity) {
    const { data: others } = await admin
      .from('rsvps')
      .select('guest_count, invitations!inner(event_id, status, id)')
      .eq('invitations.event_id', event.id)
      .eq('invitations.status', 'accepted')
      .neq('invitations.id', invitation.id);

    const taken = (others ?? []).reduce((sum, row) => sum + (row.guest_count ?? 1), 0);
    if (taken + guestCount > event.capacity) outcome = 'waitlisted';
  }

  // ---- the reply itself ----
  const { error: rsvpError } = await admin.from('rsvps').upsert(
    {
      invitation_id: invitation.id,
      attending,
      guest_count: guestCount,
      answers: input.answers,
      whatsapp_opt_in: input.whatsappOptIn,
      responded_at: new Date().toISOString(),
    },
    { onConflict: 'invitation_id' },
  );

  if (rsvpError) return { error: `Your reply could not be saved: ${rsvpError.message}` };

  await admin
    .from('invitations')
    .update({ status: outcome, responded_at: new Date().toISOString() })
    .eq('id', invitation.id);

  // ---- consent ----
  //
  // One row per purpose, carrying the version of the wording that was on the
  // screen. Re-submitting records the consent again rather than editing it: a
  // consent ledger is a history, not a current value.
  const consents: {
    contact_id: string;
    purpose: string;
    channel: 'email' | 'whatsapp' | null;
    wording_version: string;
    source: string;
  }[] = [
    {
      contact_id: invitation.contact_id,
      purpose: CONSENT_PURPOSE.eventComms,
      channel: 'email',
      wording_version: CONSENT_VERSION,
      source: CONSENT_SOURCE.rsvpForm,
    },
  ];

  if (input.whatsappOptIn && contact.phone_e164) {
    consents.push({
      contact_id: invitation.contact_id,
      purpose: CONSENT_PURPOSE.whatsapp,
      channel: 'whatsapp',
      wording_version: CONSENT_VERSION,
      source: CONSENT_SOURCE.rsvpForm,
    });
  }

  await admin.from('consents').insert(consents);

  // The opt-in on the contact is what the broadcast desk reads, so it follows
  // the latest answer in both directions.
  await admin
    .from('contacts')
    .update({ whatsapp_opt_in: input.whatsappOptIn })
    .eq('id', invitation.contact_id);

  // ---- attendees and passes ----
  if (outcome !== 'accepted') {
    // Declining or being waitlisted releases the seats. A guest already through
    // the door is left alone: they are in the room, whatever the form says.
    await admin
      .from('attendees')
      .delete()
      .eq('invitation_id', invitation.id)
      .is('checked_in_at', null);

    revalidatePath(`/rsvp/${input.token}`);
    return { result: { outcome } };
  }

  const { data: existing } = await admin
    .from('attendees')
    .select('id, pass_token, is_plus_one, checked_in_at, display_name')
    .eq('invitation_id', invitation.id)
    .order('is_plus_one', { ascending: true })
    .order('created_at', { ascending: true });

  const current = existing ?? [];
  const primary = current.find((row) => !row.is_plus_one) ?? null;
  const plusOnes = current.filter((row) => row.is_plus_one);
  const fullName = `${contact.first_name} ${contact.last_name}`;

  // The primary attendee
  let primaryId = primary?.id ?? null;
  let primaryToken = primary?.pass_token ?? null;

  if (!primary) {
    const id = newTokenId();
    const token = signToken('p', id);
    const { error } = await admin.from('attendees').insert({
      id,
      event_id: event.id,
      contact_id: invitation.contact_id,
      invitation_id: invitation.id,
      display_name: fullName,
      pass_token: token,
    });
    if (error) return { error: `Your pass could not be issued: ${error.message}` };
    primaryId = id;
    primaryToken = token;
  } else if (primary.display_name !== fullName) {
    await admin.from('attendees').update({ display_name: fullName }).eq('id', primary.id);
  }

  // Plus-ones, to match the number asked for
  const wantedPlusOnes = Math.max(0, guestCount - 1);
  const names = input.guestNames;

  for (let i = 0; i < wantedPlusOnes; i++) {
    const displayName = (names[i] ?? '').trim() || `Guest of ${contact.first_name}`;
    const existingPlusOne = plusOnes[i];

    if (existingPlusOne) {
      if (existingPlusOne.display_name !== displayName) {
        await admin
          .from('attendees')
          .update({ display_name: displayName })
          .eq('id', existingPlusOne.id);
      }
      continue;
    }

    const id = newTokenId();
    await admin.from('attendees').insert({
      id,
      event_id: event.id,
      contact_id: invitation.contact_id,
      invitation_id: invitation.id,
      display_name: displayName,
      is_plus_one: true,
      pass_token: signToken('p', id),
    });
  }

  // Reducing the party removes the surplus passes, unless they have arrived.
  const surplus = plusOnes.slice(wantedPlusOnes).filter((row) => row.checked_in_at === null);
  if (surplus.length > 0) {
    await admin
      .from('attendees')
      .delete()
      .in(
        'id',
        surplus.map((row) => row.id),
      );
  }

  // ---- send the pass ----
  let sentEmail = false;
  let sentWhatsApp = false;

  if (primaryId && primaryToken) {
    const qrImageUrl = await storePassPng(primaryId, primaryToken);
    const data = {
      firstName: contact.first_name,
      lastName: contact.last_name,
      eventTitle: event.title,
      startsAt: formatEventDate(event.starts_at),
      venue: event.venue_name ?? '',
      passUrl: passUrl(primaryToken),
      qrImageUrl: qrImageUrl ?? undefined,
    };

    if (contact.email) {
      const result = await send({
        kind: 'pass',
        channel: 'email',
        eventId: event.id,
        contactId: invitation.contact_id,
        attendeeId: primaryId,
        to: { email: contact.email },
        data,
      });
      sentEmail = result.status === 'sent';
    }

    if (input.whatsappOptIn && contact.phone_e164) {
      const result = await send({
        kind: 'pass',
        channel: 'whatsapp',
        eventId: event.id,
        contactId: invitation.contact_id,
        attendeeId: primaryId,
        to: { phone: contact.phone_e164 },
        data,
      });
      sentWhatsApp = result.status === 'sent';
    }
  }

  revalidatePath(`/rsvp/${input.token}`);

  return {
    result: {
      outcome,
      guestCount,
      passUrl: primaryToken ? `/p/${primaryToken}` : undefined,
      sent: { email: sentEmail, whatsapp: sentWhatsApp },
    },
  };
}

/** Custom answers arrive as `answer:<questionId>`, multiselects repeated. */
function readAnswers(formData: FormData): Record<string, string | string[]> {
  const answers: Record<string, string | string[]> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('answer:')) continue;
    const id = key.slice('answer:'.length);
    const text = String(value);
    if (text === '') continue;

    const seen = answers[id];
    if (seen === undefined) answers[id] = text;
    else if (Array.isArray(seen)) seen.push(text);
    else answers[id] = [seen, text];
  }

  return answers;
}
