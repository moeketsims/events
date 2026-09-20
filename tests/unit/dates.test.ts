import { describe, expect, it } from 'vitest';
import {
  formatBidderNumber,
  formatCountdown,
  formatDate,
  formatEventDate,
  formatTime,
} from '@/lib/dates';

// 30 October 2026 18:00 SAST is 16:00 UTC. These assertions fail if anything
// ever renders in the server's zone instead of Africa/Johannesburg.
const GALA_UTC = '2026-10-30T16:00:00Z';

describe('formatEventDate', () => {
  it('renders the gala in SAST in the house format', () => {
    expect(formatEventDate(GALA_UTC)).toBe('Friday 30 October 2026, 18:00');
  });

  it('shifts a UTC instant into SAST rather than leaving it at UTC', () => {
    // 22:30 UTC on the 30th is 00:30 SAST on the 31st.
    expect(formatEventDate('2026-10-30T22:30:00Z')).toBe('Saturday 31 October 2026, 00:30');
  });

  it('returns an em dash for a missing or unparseable value', () => {
    expect(formatEventDate(null)).toBe('—');
    expect(formatEventDate(undefined)).toBe('—');
    expect(formatEventDate('not a date')).toBe('—');
  });
});

describe('formatTime', () => {
  it('is 24-hour and zoned', () => {
    expect(formatTime(GALA_UTC)).toBe('18:00');
    expect(formatTime('2026-10-30T16:42:00Z')).toBe('18:42');
  });
});

describe('formatDate', () => {
  it('renders the date alone', () => {
    expect(formatDate(GALA_UTC)).toBe('30 October 2026');
  });
});

describe('formatCountdown', () => {
  it('renders minutes and seconds', () => {
    expect(formatCountdown(372_000)).toBe('6:12');
    expect(formatCountdown(59_000)).toBe('0:59');
    expect(formatCountdown(90_000)).toBe('1:30');
  });

  it('adds hours when the lot is more than an hour away', () => {
    expect(formatCountdown(3_870_000)).toBe('1:04:30');
  });

  it('never goes negative', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5000)).toBe('0:00');
  });
});

describe('formatBidderNumber', () => {
  it('pads to three digits', () => {
    expect(formatBidderNumber(1)).toBe('001');
    expect(formatBidderNumber(42)).toBe('042');
    expect(formatBidderNumber(142)).toBe('142');
    expect(formatBidderNumber(null)).toBe('—');
  });
});
