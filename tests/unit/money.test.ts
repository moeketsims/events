import { describe, expect, it } from 'vitest';
import { DEFAULT_INCREMENT_TABLE, bidStep, formatZAR, nextMinBid, toCents } from '@/lib/money';

describe('formatZAR', () => {
  it('formats whole rands with a space separator and no decimals', () => {
    expect(formatZAR(2500)).toBe('R2 500');
    expect(formatZAR(12750)).toBe('R12 750');
    expect(formatZAR(0)).toBe('R0');
    expect(formatZAR(999)).toBe('R999');
    expect(formatZAR(1000000)).toBe('R1 000 000');
  });

  it('shows cents only when they exist', () => {
    expect(formatZAR(2500.5)).toBe('R2 500.50');
    expect(formatZAR(19.99)).toBe('R19.99');
  });

  it('accepts the numeric strings Postgres returns for numeric(12,2)', () => {
    expect(formatZAR('2500.00')).toBe('R2 500');
    expect(formatZAR('1500.50')).toBe('R1 500.50');
  });

  it('renders an em dash rather than R0 for absent amounts', () => {
    expect(formatZAR(null)).toBe('—');
    expect(formatZAR(undefined)).toBe('—');
    expect(formatZAR('')).toBe('—');
    expect(formatZAR(Number.NaN)).toBe('—');
  });

  it('keeps the sign outside the R', () => {
    expect(formatZAR(-2500)).toBe('R-2 500');
  });
});

describe('bidStep — parity with SQL bid_step()', () => {
  // Each case is also asserted by the SQL function in 0004_functions.sql; keep
  // the two tables identical when either changes.
  const cases: Array<[current: number, step: number]> = [
    [0, 100],
    [100, 100],
    [999, 100],
    [999.99, 100],
    [1000, 250],
    [1500, 250],
    [4999, 250],
    [5000, 500],
    [5001, 500],
    [12750, 500],
    [1000000, 500],
  ];

  it.each(cases)('at R%s the step is R%s', (current, step) => {
    expect(bidStep(DEFAULT_INCREMENT_TABLE, current)).toBe(step);
  });

  it('falls back to R100 when no row matches', () => {
    expect(bidStep([{ upTo: 50, step: 25 }], 100)).toBe(100);
  });

  it('honours a custom table', () => {
    const table = [
      { upTo: 500, step: 50 },
      { upTo: null, step: 1000 },
    ];
    expect(bidStep(table, 100)).toBe(50);
    expect(bidStep(table, 500)).toBe(1000);
  });
});

describe('nextMinBid — parity with SQL next_min_bid()', () => {
  const incrementTable = DEFAULT_INCREMENT_TABLE;

  it('is the starting bid while the lot has no bids', () => {
    expect(nextMinBid({ startingBid: 3000, highBid: null, incrementTable })).toBe(3000);
  });

  it('adds the step that applies at the current high bid', () => {
    expect(nextMinBid({ startingBid: 1500, highBid: 1500, incrementTable })).toBe(1750);
    expect(nextMinBid({ startingBid: 1500, highBid: 900, incrementTable })).toBe(1000);
    expect(nextMinBid({ startingBid: 1500, highBid: 5000, incrementTable })).toBe(5500);
    expect(nextMinBid({ startingBid: 1500, highBid: 4999, incrementTable })).toBe(5249);
  });
});

describe('toCents', () => {
  it('converts rands to the minor unit without float drift', () => {
    expect(toCents(2500)).toBe(250000);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
});
