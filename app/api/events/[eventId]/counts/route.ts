import { NextResponse } from 'next/server';
import { getStaffProfile } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';

/**
 * Live arrival counts for one event — BUILD-SPEC §4.6.
 *
 * The scanner's Count tab and the attendance dashboard's polling fallback both
 * read this. It goes through the *session* client, so RLS decides whether the
 * caller may see the event at all; there is no reason for a counts endpoint to
 * hold the service-role key.
 */

export const runtime = 'nodejs';

export type EventCounts = {
  expected: number;
  checkedIn: number;
  notArrived: number;
  /** ISO, so a client can tell a stale poll from a fresh one. */
  at: string;
};

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;

  const profile = await getStaffProfile();
  if (!profile) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const supabase = await createClient();

  const [{ count: expected }, { count: checkedIn }] = await Promise.all([
    supabase.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('checked_in_at', 'is', null),
  ]);

  const payload: EventCounts = {
    expected: expected ?? 0,
    checkedIn: checkedIn ?? 0,
    notArrived: Math.max(0, (expected ?? 0) - (checkedIn ?? 0)),
    at: new Date().toISOString(),
  };

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
