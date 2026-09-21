import { timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';

/**
 * The projection's credential — BUILD-SPEC §5 and §7.4, docs/06 T4.1.
 *
 * `/display/[auctionId]?k=<display_key>` is the link the operator copies from
 * the auction page. The key is compared in constant time against
 * `auctions.display_key` through the admin client; a match is remembered for
 * 24 hours in the `cut_display` cookie the middleware sets, so a reload of the
 * projector laptop does not need the key again. The cookie holds
 * `<auctionId>:<key>` and is re-verified on every request: a convenience,
 * never an authorisation on its own.
 */

export const DISPLAY_COOKIE = 'cut_display';
/** Twenty-four hours, per BUILD-SPEC §5. */
export const DISPLAY_COOKIE_MAX_AGE = 24 * 60 * 60;

const KEY_RE = /^[0-9a-f]{32}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape check only: 32 hex characters, as `gen_random_bytes(16)` encodes. */
export function isDisplayKeyShaped(value: string | null | undefined): value is string {
  return typeof value === 'string' && KEY_RE.test(value);
}

/** Constant-time comparison of a presented key with the stored one. */
export function displayKeyMatches(presented: string | null | undefined, stored: string): boolean {
  if (!isDisplayKeyShaped(presented) || !isDisplayKeyShaped(stored)) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(stored));
}

/** `<auctionId>:<key>` → its parts, or null for anything else. */
export function parseDisplayCookie(
  value: string | null | undefined,
): { auctionId: string; key: string } | null {
  if (!value) return null;
  const at = value.indexOf(':');
  if (at === -1) return null;
  const auctionId = value.slice(0, at);
  const key = value.slice(at + 1);
  if (!UUID_RE.test(auctionId) || !isDisplayKeyShaped(key)) return null;
  return { auctionId, key };
}

/**
 * The key a request presents for this auction: the `k` query first, then the
 * cookie if it was issued for the same auction.
 */
export function presentedDisplayKey(
  auctionId: string,
  query: string | null | undefined,
  cookie: string | null | undefined,
): string | null {
  if (isDisplayKeyShaped(query)) return query;
  const parsed = parseDisplayCookie(cookie);
  return parsed && parsed.auctionId === auctionId ? parsed.key : null;
}

export const DISPLAY_AUCTION_COLUMNS =
  'id, event_id, title, display_key, display_mode, spotlight_lot_id, increment_table, closes_at';

export type DisplayAuction = Pick<
  Database['public']['Tables']['auctions']['Row'],
  | 'id'
  | 'event_id'
  | 'title'
  | 'display_key'
  | 'display_mode'
  | 'spotlight_lot_id'
  | 'increment_table'
  | 'closes_at'
>;

/** Load the auction and check the key. Null on any miss; the caller decides what to show. */
export async function authoriseDisplay(
  admin: SupabaseClient<Database>,
  auctionId: string,
  presented: string | null,
): Promise<DisplayAuction | null> {
  if (!UUID_RE.test(auctionId) || !presented) return null;

  const { data: auction } = await admin
    .from('auctions')
    .select(DISPLAY_AUCTION_COLUMNS)
    .eq('id', auctionId)
    .maybeSingle();

  if (!auction || !displayKeyMatches(presented, auction.display_key)) return null;
  return auction;
}

export type TickerBid = {
  lotId: string;
  lotNumber: number;
  lotTitle: string;
  amount: number;
  bidderNumber: number | null;
  placedAt: string;
};

/** The last `limit` live bids across the auction, newest first. Numbers only. */
export async function recentBids(
  admin: SupabaseClient<Database>,
  auctionId: string,
  limit = 8,
): Promise<TickerBid[]> {
  const { data } = await admin
    .from('bids')
    .select(
      'lot_id, amount, placed_at, lots!inner(lot_number, title, auction_id), attendees(bidder_number)',
    )
    .eq('lots.auction_id', auctionId)
    .is('voided_at', null)
    .order('placed_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    lotId: row.lot_id,
    lotNumber: row.lots?.lot_number ?? 0,
    lotTitle: row.lots?.title ?? '',
    amount: Number(row.amount),
    bidderNumber: row.attendees?.bidder_number ?? null,
    placedAt: row.placed_at,
  }));
}

export type LotBid = { amount: number; bidderNumber: number | null; placedAt: string };

/** The last `limit` live bids on one lot, newest first, for the spotlight. */
export async function lotBids(
  admin: SupabaseClient<Database>,
  lotId: string,
  limit = 5,
): Promise<LotBid[]> {
  const { data } = await admin
    .from('bids')
    .select('amount, placed_at, attendees(bidder_number)')
    .eq('lot_id', lotId)
    .is('voided_at', null)
    .order('amount', { ascending: false })
    .order('placed_at', { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) => ({
    amount: Number(row.amount),
    bidderNumber: row.attendees?.bidder_number ?? null,
    placedAt: row.placed_at,
  }));
}
