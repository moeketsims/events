import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { nextMinBid, type IncrementRow } from '@/lib/money';
import { readIncrementTable } from '@/app/(staff)/events/[eventId]/auction/schema';

/**
 * The board as an attendee, a projection or a console may see it — TASKS T3.3,
 * BUILD-SPEC §7.3 and §7.4.
 *
 * Built from `lot_state`, which carries a bidder number and never a name, plus
 * the auction's increment table so every surface proposes the same next
 * minimum the database will accept. One function, so the bidding grid, its
 * poll route and the projection cannot drift apart.
 */

export type LotStateRow = {
  lotId: string;
  lotNumber: number;
  title: string;
  status: string;
  closesAt: string | null;
  startingBid: number;
  highBid: number | null;
  highBidderNumber: number | null;
  bidCount: number;
  nextMin: number;
  /** Whether the reserve has been met. Never the reserve itself. */
  reserveMet: boolean;
};

export type AuctionState = {
  auctionId: string;
  lots: LotStateRow[];
  totalRaised: number;
  lotsWithBids: number;
  /** The server's clock, so a client can correct for a phone set to the wrong time. */
  now: string;
};

export async function auctionState(
  admin: ReturnType<typeof createAdminClient>,
  auctionId: string,
  incrementTable?: IncrementRow[],
): Promise<AuctionState> {
  let table = incrementTable;
  if (!table) {
    const { data: auction } = await admin
      .from('auctions')
      .select('increment_table')
      .eq('id', auctionId)
      .maybeSingle();
    table = readIncrementTable(auction?.increment_table);
  }

  const [{ data: rows }, { data: totals }] = await Promise.all([
    admin
      .from('lot_state')
      .select(
        'lot_id, lot_number, title, status, closes_at, starting_bid, reserve, high_bid, high_bidder_number, bid_count',
      )
      .eq('auction_id', auctionId),
    admin
      .from('auction_totals')
      .select('total_raised, lots_with_bids')
      .eq('auction_id', auctionId)
      .maybeSingle(),
  ]);

  const lots: LotStateRow[] = (rows ?? [])
    .filter((row) => row.lot_id !== null && row.lot_number !== null)
    .map((row) => {
      const startingBid = Number(row.starting_bid ?? 0);
      const highBid =
        row.high_bid === null || row.high_bid === undefined ? null : Number(row.high_bid);
      const reserve =
        row.reserve === null || row.reserve === undefined ? null : Number(row.reserve);
      return {
        lotId: row.lot_id!,
        lotNumber: row.lot_number!,
        title: row.title ?? '',
        status: row.status ?? 'upcoming',
        closesAt: row.closes_at,
        startingBid,
        highBid,
        highBidderNumber: row.high_bidder_number,
        bidCount: Number(row.bid_count ?? 0),
        nextMin: nextMinBid({ startingBid, highBid, incrementTable: table }),
        reserveMet: reserve === null ? true : highBid !== null && highBid >= reserve,
      };
    })
    .sort((a, b) => a.lotNumber - b.lotNumber);

  return {
    auctionId,
    lots,
    totalRaised: Number(totals?.total_raised ?? 0),
    lotsWithBids: Number(totals?.lots_with_bids ?? 0),
    now: new Date().toISOString(),
  };
}
