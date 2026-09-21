import { NextResponse } from 'next/server';
import { verifyTokenOfKind } from '@/lib/auth/pass';
import { createAdminClient } from '@/lib/supabase/admin';
import { auctionState } from '@/lib/auction/state';
import { attendeeBidLotIds } from '@/lib/auction/attendee';

/**
 * The board, for this attendee's bidding page — BUILD-SPEC §7.3.
 *
 * The polling fallback when realtime is off, and the refetch after a
 * `bid_voided` payload, which carries no bid count. Anonymised: bidder numbers
 * only, never a name. Never cached.
 *
 * Alongside the board it returns the lots this attendee holds a live bid on,
 * so "Outbid" is derived from the server's truth on every load rather than
 * remembered from an event that arrived while the page happened to be open.
 */

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const attendeeId = verifyTokenOfKind(token, 'p');
  if (!attendeeId) return NextResponse.json({ error: 'invalid' }, { status: 404 });

  const admin = createAdminClient();

  const { data: attendee } = await admin
    .from('attendees')
    .select('id, event_id, bidder_number, pass_token')
    .eq('id', attendeeId)
    .maybeSingle();

  if (!attendee || attendee.pass_token !== token) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 });
  }

  const { data: auction } = await admin
    .from('auctions')
    .select('id')
    .eq('event_id', attendee.event_id)
    .maybeSingle();

  if (!auction) return NextResponse.json({ error: 'no_auction' }, { status: 404 });

  const state = await auctionState(admin, auction.id);
  const bidLotIds = await attendeeBidLotIds(
    admin,
    attendee.id,
    state.lots.map((lot) => lot.lotId),
  );

  return NextResponse.json(
    { ...state, bidderNumber: attendee.bidder_number, bidLotIds },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
