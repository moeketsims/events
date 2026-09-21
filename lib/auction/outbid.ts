import type { LotStateRow } from './state';

/**
 * Which lots this attendee has lost the lead on — TASKS T3.3.
 *
 * Derived, not remembered: a guest who bid, went to get a drink and reopened
 * the page should see "Outbid" without having been on the page when the
 * realtime event arrived. The inputs are the board and the lots the attendee
 * holds a live bid on, both of which the state route serves.
 */
export function deriveOutbid(
  lots: Pick<LotStateRow, 'lotId' | 'highBidderNumber' | 'status'>[],
  bidderNumber: number | null,
  bidLotIds: Iterable<string>,
): Set<string> {
  const mine = new Set(bidLotIds);
  const lost = new Set<string>();
  for (const lot of lots) {
    if (!mine.has(lot.lotId)) continue;
    if (lot.status !== 'open') continue;
    if (lot.highBidderNumber !== null && lot.highBidderNumber === bidderNumber) continue;
    lost.add(lot.lotId);
  }
  return lost;
}

/**
 * Whether a message the bid panel showed is still about the board the guest is
 * looking at. A confirmation or a "too low" sentence was true of one high bid;
 * once the board moves past it, the derived state must speak instead.
 */
export function messageStale(
  message: { tone: 'ok' | 'warn' | 'error'; atHighBid: number | null } | null,
  highBid: number | null,
): boolean {
  if (!message) return false;
  if (message.tone === 'error') return false;
  return message.atHighBid !== highBid;
}
