import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffProfile } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';

/**
 * Name search at the door — the path for a guest with a dead battery, a broken
 * camera, or a printed card that will not read.
 *
 * It searches `attendees.display_name`, which is denormalised for exactly this
 * reason: the door never needs the donor record behind a guest, so door staff
 * are given no route to `contacts` at all (RLS matrix, BUILD-SPEC §4.5). The
 * session client enforces that.
 */

export const runtime = 'nodejs';

const schema = z.object({
  eventId: z.uuid(),
  q: z.string().trim().max(80).default(''),
});

export type AttendeeSearchRow = {
  id: string;
  displayName: string;
  isPlusOne: boolean;
  isWalkIn: boolean;
  bidderNumber: number | null;
  checkedInAt: string | null;
};

export async function GET(request: Request) {
  const profile = await getStaffProfile();
  if (!profile) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const url = new URL(request.url);
  const parsed = schema.safeParse({
    eventId: url.searchParams.get('eventId'),
    q: url.searchParams.get('q') ?? '',
  });

  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // A percent or an underscore in a search box would be read as a LIKE
  // wildcard, and a comma would be read as filter syntax.
  const q = parsed.data.q.replace(/[,%_()"'\\*]/g, ' ').trim();

  const supabase = await createClient();

  let query = supabase
    .from('attendees')
    .select('id, display_name, is_plus_one, is_walk_in, bidder_number, checked_in_at')
    .eq('event_id', parsed.data.eventId)
    .order('display_name', { ascending: true })
    .limit(25);

  if (q) query = query.ilike('display_name', `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows: AttendeeSearchRow[] = (data ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    isPlusOne: row.is_plus_one,
    isWalkIn: row.is_walk_in,
    bidderNumber: row.bidder_number,
    checkedInAt: row.checked_in_at,
  }));

  return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'no-store' } });
}
