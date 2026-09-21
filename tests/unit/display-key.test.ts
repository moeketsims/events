import { describe, expect, it } from 'vitest';
import {
  displayKeyMatches,
  isDisplayKeyShaped,
  parseDisplayCookie,
  presentedDisplayKey,
} from '@/lib/auction/display';

const AUCTION = '3f1c7a2e-9b4d-4e6a-8f21-5c0d7e8a1b34';
const KEY = '0123456789abcdef0123456789abcdef';
const OTHER = 'fedcba9876543210fedcba9876543210';

describe('display key', () => {
  it('accepts only 32 hex characters', () => {
    expect(isDisplayKeyShaped(KEY)).toBe(true);
    expect(isDisplayKeyShaped(KEY.toUpperCase())).toBe(false);
    expect(isDisplayKeyShaped(KEY.slice(1))).toBe(false);
    expect(isDisplayKeyShaped(null)).toBe(false);
  });

  it('matches the stored key and nothing else', () => {
    expect(displayKeyMatches(KEY, KEY)).toBe(true);
    expect(displayKeyMatches(OTHER, KEY)).toBe(false);
    expect(displayKeyMatches(KEY.slice(0, 31) + 'x', KEY)).toBe(false);
    expect(displayKeyMatches(undefined, KEY)).toBe(false);
  });

  it('parses the cookie into its two parts', () => {
    expect(parseDisplayCookie(`${AUCTION}:${KEY}`)).toEqual({ auctionId: AUCTION, key: KEY });
    expect(parseDisplayCookie(`${AUCTION}:nope`)).toBeNull();
    expect(parseDisplayCookie(`not-a-uuid:${KEY}`)).toBeNull();
    expect(parseDisplayCookie('')).toBeNull();
  });

  it('prefers the query, then a cookie issued for the same auction', () => {
    expect(presentedDisplayKey(AUCTION, KEY, null)).toBe(KEY);
    expect(presentedDisplayKey(AUCTION, null, `${AUCTION}:${OTHER}`)).toBe(OTHER);
    expect(
      presentedDisplayKey(AUCTION, null, `a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d:${OTHER}`),
    ).toBeNull();
    expect(presentedDisplayKey(AUCTION, 'short', null)).toBeNull();
  });
});
