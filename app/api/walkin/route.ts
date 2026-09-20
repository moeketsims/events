import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffProfile } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { newTokenId, signToken } from '@/lib/auth/pass';
import { normalisePhone } from '@/lib/contacts/csv';
import { storePassPng, passUrl } from '@/lib/qr';
import { CONSENT_PURPOSE, CONSENT_SOURCE, CONSENT_VERSION } from '@/lib/consent';

/**
 * Register someone at the door and check them in — BUILD-SPEC §7.2.
 *
 * A walk-in is a contact, an attendee and a consent record created in twenty
 * seconds by a student usher holding a phone in one hand, so the form is five
 * fields and everything else is inferred. The consent tick is not optional
 * decoration: POPIA requires it before CUT holds this person's details, and the
 * wording version is stored with it.
 */

export const runtime = 'nodejs';

const schema = z.object({
  eventId: z.uuid(),
  firstName: z.string().trim().min(1, 'A first name is needed').max(80),
  lastName: z.string().trim().min(1, 'A surname is needed').max(80),
  email: z.union([z.email(), z.literal('')]).optional(),
  phone: z.string().trim().max(40).optional(),
  whatsappOptIn: z.boolean().default(false),
  consent: z.literal(true, { message: 'The guest has to agree before we may keep their details.' }),
});

export async function POST(request: Request) {
  const profile = await getStaffProfile();
  if (!profile) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  if (!['door_staff', 'organiser', 'auction_operator', 'platform_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'bad_request' },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select('id, department_id, title, starts_at, venue_name')
    .eq('id', input.eventId)
    .maybeSingle();

  if (
    !event ||
    (profile.role !== 'platform_admin' && event.department_id !== profile.departmentId)
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const email = input.email ? input.email.toLowerCase() : null;
  const phone = normalisePhone(input.phone);
  if (phone === undefined) {
    return NextResponse.json({ error: 'That phone number could not be read.' }, { status: 400 });
  }

  // Match an existing contact before creating one: the walk-in is often someone
  // who was invited and never replied, and two records for one donor is the
  // thing the contacts table exists to prevent.
  let contactId: string | null = null;

  if (email) {
    const { data } = await admin
      .from('contacts')
      .select('id')
      .eq('department_id', event.department_id)
      .eq('email', email)
      .maybeSingle();
    contactId = data?.id ?? null;
  }
  if (!contactId && phone) {
    const { data } = await admin
      .from('contacts')
      .select('id')
      .eq('department_id', event.department_id)
      .eq('phone_e164', phone)
      .maybeSingle();
    contactId = data?.id ?? null;
  }

  if (contactId) {
    await admin
      .from('contacts')
      .update({
        whatsapp_opt_in: input.whatsappOptIn,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);
  } else {
    const { data, error } = await admin
      .from('contacts')
      .insert({
        department_id: event.department_id,
        first_name: input.firstName,
        last_name: input.lastName,
        email,
        phone_e164: phone,
        whatsapp_opt_in: input.whatsappOptIn,
        tags: ['walk-in'],
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    contactId = data.id;
  }

  await admin.from('consents').insert([
    {
      contact_id: contactId,
      purpose: CONSENT_PURPOSE.eventComms,
      channel: email ? ('email' as const) : null,
      wording_version: CONSENT_VERSION,
      source: CONSENT_SOURCE.walkIn,
    },
    ...(input.whatsappOptIn && phone
      ? [
          {
            contact_id: contactId,
            purpose: CONSENT_PURPOSE.whatsapp,
            channel: 'whatsapp' as const,
            wording_version: CONSENT_VERSION,
            source: CONSENT_SOURCE.walkIn,
          },
        ]
      : []),
  ]);

  // Already an attendee of this event? Then this is a lookup, not a new pass.
  const { data: existing } = await admin
    .from('attendees')
    .select('id, pass_token')
    .eq('event_id', event.id)
    .eq('contact_id', contactId)
    .eq('is_plus_one', false)
    .maybeSingle();

  let attendeeId = existing?.id ?? null;
  let passToken = existing?.pass_token ?? null;

  if (!attendeeId) {
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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    attendeeId = id;
    passToken = token;
  }

  const { data, error } = await admin.rpc('check_in_attendee', {
    p_attendee_id: attendeeId,
    p_staff_id: profile.id,
    p_event_id: event.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = Array.isArray(data) ? data[0] : data;

  // The QR is generated now rather than on first view, so an usher can hold the
  // phone out and the guest can photograph it, and so a later WhatsApp has an
  // image to attach.
  if (attendeeId && passToken) await storePassPng(attendeeId, passToken);

  return NextResponse.json(
    {
      result: row?.result ?? 'checked_in',
      displayName: row?.display_name ?? `${input.firstName} ${input.lastName}`,
      bidderNumber: row?.bidder_number ?? null,
      checkedInAt: row?.checked_in_at ?? null,
      passUrl: passToken ? passUrl(passToken) : null,
      passPath: passToken ? `/p/${passToken}` : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
