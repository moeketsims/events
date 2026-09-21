import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { auctionState } from '@/lib/auction/state';
import { readIncrementTable } from '@/app/(staff)/events/[eventId]/auction/schema';
import {
  DISPLAY_COOKIE,
  authoriseDisplay,
  presentedDisplayKey,
  recentBids,
} from '@/lib/auction/display';

/**
 * The board, for the projection — BUILD-SPEC §7.4, docs/06 T4.1.
 *
 * The polling fallback when realtime is off, the refetch after a payload that
 * carries less than the board needs, and the recovery after a dropped channel.
 * Display-key or cookie authenticated; anonymised: bidder numbers only.
 */

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await context.params;
  const key = presentedDisplayKey(
    auctionId,
    new URL(request.url).searchParams.get('k'),
    (await cookies()).get(DISPLAY_COOKIE)?.value,
  );

  const admin = createAdminClient();
  const auction = await authoriseDisplay(admin, auctionId, key);
  if (!auction) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const [state, ticker] = await Promise.all([
    auctionState(admin, auction.id, readIncrementTable(auction.increment_table)),
    recentBids(admin, auction.id, 8),
  ]);

  return NextResponse.json(
    {
      ...state,
      mode: auction.display_mode,
      spotlightLotId: auction.spotlight_lot_id,
      recentBids: ticker,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
