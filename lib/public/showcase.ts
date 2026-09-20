import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Anonymised, public-safe numbers for the sign-in and landing pages, so the
 * product demonstrates itself before anyone signs in. Everything here is what
 * the projection screen would show a room full of guests: event title, venue,
 * arrivals count, total raised, lot titles, amounts and bidder numbers. Never a
 * name, an email or a phone number.
 *
 * Reads go through the admin client because the visitor is anonymous and RLS
 * (correctly) returns nothing to anon. The function selects only the columns
 * listed below.
 */

export type Showcase = {
  event: {
    id: string;
    title: string;
    startsAt: string;
    venue: string | null;
    status: string;
  } | null;
  arrived: number;
  expected: number;
  totalRaised: number;
  lotsOpen: number;
  lots: { lotNumber: number; title: string; highBid: number | null; bidderNumber: number | null; status: string }[];
  recentBids: { lotNumber: number; lotTitle: string; amount: number; bidderNumber: number | null }[];
};

const EMPTY: Showcase = {
  event: null,
  arrived: 0,
  expected: 0,
  totalRaised: 0,
  lotsOpen: 0,
  lots: [],
  recentBids: [],
};

export async function getShowcase(): Promise<Showcase> {
  try {
    const db = createAdminClient();

    const { data: events } = await db
      .from('events')
      .select('id, title, starts_at, venue_name, status')
      .in('status', ['live', 'published'])
      .order('starts_at', { ascending: true })
      .limit(5);

    const event = events?.find((e) => e.status === 'live') ?? events?.[0];
    if (!event) return EMPTY;

    const [{ count: arrived }, { count: expected }, { data: auction }] = await Promise.all([
      db
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .not('checked_in_at', 'is', null),
      db.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', event.id),
      db.from('auctions').select('id').eq('event_id', event.id).maybeSingle(),
    ]);

    let totalRaised = 0;
    let lotsOpen = 0;
    let lots: Showcase['lots'] = [];
    let recentBids: Showcase['recentBids'] = [];

    if (auction) {
      const [{ data: totals }, { data: lotRows }, { data: bidRows }] = await Promise.all([
        db.from('auction_totals').select('total_raised').eq('auction_id', auction.id).maybeSingle(),
        db
          .from('lot_state')
          .select('lot_number, title, high_bid, high_bidder_number, status')
          .eq('auction_id', auction.id)
          .order('lot_number', { ascending: true }),
        db
          .from('bids')
          .select('amount, placed_at, lots!inner(lot_number, title, auction_id), attendees(bidder_number)')
          .eq('lots.auction_id', auction.id)
          .is('voided_at', null)
          .order('placed_at', { ascending: false })
          .limit(10),
      ]);

      totalRaised = Number(totals?.total_raised ?? 0);
      lots = (lotRows ?? []).map((l) => ({
        lotNumber: l.lot_number ?? 0,
        title: l.title ?? '',
        highBid: l.high_bid === null ? null : Number(l.high_bid),
        bidderNumber: l.high_bidder_number,
        status: l.status ?? 'upcoming',
      }));
      lotsOpen = lots.filter((l) => l.status === 'open').length;
      recentBids = (bidRows ?? []).map((b) => ({
        lotNumber: b.lots?.lot_number ?? 0,
        lotTitle: b.lots?.title ?? '',
        amount: Number(b.amount),
        bidderNumber: b.attendees?.bidder_number ?? null,
      }));
    }

    return {
      event: {
        id: event.id,
        title: event.title,
        startsAt: event.starts_at,
        venue: event.venue_name,
        status: event.status,
      },
      arrived: arrived ?? 0,
      expected: expected ?? 0,
      totalRaised,
      lotsOpen,
      lots,
      recentBids,
    };
  } catch {
    // A public page must never fail because the database is asleep.
    return EMPTY;
  }
}
