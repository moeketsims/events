import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffProfile } from '@/lib/auth/staff';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractToken, verifyTokenOfKind } from '@/lib/auth/pass';

/**
 * Check a guest in — BUILD-SPEC §7.2.
 *
 * A staff session is required, and `check_in_attendee` is granted to
 * `service_role` alone (migration 0004), so the route verifies the person at
 * the door and then calls the function through the admin client. The function
 * itself is what assigns the bidder number, under an advisory lock, so two
 * ushers scanning at the same moment cannot hand out the same number.
 *
 * The scanner may send either a scanned QR payload (which is a full URL) or an
 * attendee id chosen from the name search, and the two paths meet at the same
 * function call.
 */

export const runtime = 'nodejs';

const schema = z
  .object({
    eventId: z.uuid(),
    token: z.string().min(10).max(200).optional(),
    attendeeId: z.uuid().optional(),
  })
  .refine((value) => Boolean(value.token || value.attendeeId), {
    message: 'Send a token or an attendeeId.',
  });

export type CheckinResponse = {
  result: 'checked_in' | 'already_checked_in' | 'invalid' | 'wrong_event';
  displayName: string | null;
  bidderNumber: number | null;
  checkedInAt: string | null;
};

export async function POST(request: Request) {
  const profile = await getStaffProfile();
  if (!profile) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }
  if (!['door_staff', 'organiser', 'auction_operator', 'platform_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { eventId, token, attendeeId: manualId } = parsed.data;
  const admin = createAdminClient();

  // The event has to belong to the door staff's own department. RLS does not
  // apply to the admin client, so this is the check that replaces it.
  const { data: event } = await admin
    .from('events')
    .select('id, department_id')
    .eq('id', eventId)
    .maybeSingle();

  if (
    !event ||
    (profile.role !== 'platform_admin' && event.department_id !== profile.departmentId)
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let attendeeId = manualId ?? null;

  if (token) {
    // The QR encodes the whole pass URL; the scanner may also be handed a bare
    // token typed in by hand.
    const bare = extractToken(token);
    attendeeId = verifyTokenOfKind(bare, 'p');

    if (!attendeeId) {
      return json({
        result: 'invalid',
        displayName: null,
        bidderNumber: null,
        checkedInAt: null,
      });
    }

    // A verified signature is not enough: a pass reissued for a guest revokes
    // the old link, and the old QR printed on a card must stop working.
    const { data: attendee } = await admin
      .from('attendees')
      .select('id, pass_token')
      .eq('id', attendeeId)
      .maybeSingle();

    if (!attendee || attendee.pass_token !== bare) {
      return json({
        result: 'invalid',
        displayName: null,
        bidderNumber: null,
        checkedInAt: null,
      });
    }
  }

  if (!attendeeId) {
    return json({ result: 'invalid', displayName: null, bidderNumber: null, checkedInAt: null });
  }

  const { data, error } = await admin.rpc('check_in_attendee', {
    p_attendee_id: attendeeId,
    p_staff_id: profile.id,
    p_event_id: eventId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return json({ result: 'invalid', displayName: null, bidderNumber: null, checkedInAt: null });
  }

  return json({
    result: row.result as CheckinResponse['result'],
    displayName: row.display_name,
    bidderNumber: row.bidder_number,
    checkedInAt: row.checked_in_at,
  });
}

function json(payload: CheckinResponse) {
  // Never cached: the same scan a second later must get the duplicate answer.
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
