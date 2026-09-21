import { describe, expect, it } from 'vitest';
import { deriveOutbid, messageStale } from '@/lib/auction/outbid';

const lot = (
  lotId: string,
  highBidderNumber: number | null,
  status = 'open',
): { lotId: string; highBidderNumber: number | null; status: string } => ({
  lotId,
  highBidderNumber,
  status,
});

describe('deriveOutbid', () => {
  it('marks a lot the attendee bid on where someone else now leads', () => {
    const lost = deriveOutbid([lot('a', 2), lot('b', 1)], 1, ['a', 'b']);
    expect([...lost]).toEqual(['a']);
  });

  it('ignores lots the attendee never bid on, whoever leads them', () => {
    expect(deriveOutbid([lot('a', 2), lot('b', null)], 1, []).size).toBe(0);
  });

  it('is not outbid while leading', () => {
    expect(deriveOutbid([lot('a', 1)], 1, ['a']).size).toBe(0);
  });

  it('drops the badge once the lot is no longer open', () => {
    expect(deriveOutbid([lot('a', 2, 'closed'), lot('b', 2, 'unsold')], 1, ['a', 'b']).size).toBe(
      0,
    );
  });

  it('treats a guest without a bidder number as never leading', () => {
    // A bid on record but no number is a desk anomaly; the board still says
    // someone else leads, so the honest badge is Outbid.
    expect([...deriveOutbid([lot('a', 2)], null, ['a'])]).toEqual(['a']);
    expect(deriveOutbid([lot('a', null)], null, ['a']).size).toBe(1);
  });

  it('accepts a Set as well as an array of lot ids', () => {
    expect([...deriveOutbid([lot('a', 2)], 1, new Set(['a']))]).toEqual(['a']);
  });
});

describe('messageStale', () => {
  it('keeps a confirmation while the board still shows that bid', () => {
    expect(messageStale({ tone: 'ok', atHighBid: 2000 }, 2000)).toBe(false);
  });

  it('drops "You are leading" the moment the board moves past it', () => {
    expect(messageStale({ tone: 'ok', atHighBid: 2000 }, 2250)).toBe(true);
  });

  it('drops a "too low" notice once someone bids again', () => {
    expect(messageStale({ tone: 'warn', atHighBid: 2250 }, 2500)).toBe(true);
    expect(messageStale({ tone: 'warn', atHighBid: 2250 }, 2250)).toBe(false);
  });

  it('keeps a network error regardless of the board', () => {
    expect(messageStale({ tone: 'error', atHighBid: 2000 }, 9000)).toBe(false);
  });

  it('treats a first bid on an empty board as a move', () => {
    expect(messageStale({ tone: 'warn', atHighBid: null }, 1000)).toBe(true);
    expect(messageStale({ tone: 'warn', atHighBid: null }, null)).toBe(false);
  });

  it('has nothing to say about no message', () => {
    expect(messageStale(null, 2000)).toBe(false);
  });
});
