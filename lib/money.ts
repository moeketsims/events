/**
 * ZAR formatting and bid-increment maths.
 *
 * `bidStep` and `nextMinBid` mirror the SQL functions of the same names in
 * `supabase/migrations/0004_functions.sql`. The database is authoritative —
 * these exist so the client can propose the right amount before a round trip.
 * `tests/unit/money.test.ts` pins both to the same table of cases.
 */

/** One row of `auctions.increment_table`: steps apply while current < upTo. */
export type IncrementRow = { upTo: number | null; step: number };

export const DEFAULT_INCREMENT_TABLE: IncrementRow[] = [
  { upTo: 1000, step: 100 },
  { upTo: 5000, step: 250 },
  { upTo: null, step: 500 },
];

/**
 * `R2 500` — space as the thousands separator, no decimals unless cents exist.
 * DESIGN-SYSTEM §6, BUILD-SPEC §13.
 */
export function formatZAR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const value = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(value)) return '—';

  const hasCents =
    Math.abs(value * 100 - Math.round(value * 100)) > 1e-9 || !Number.isInteger(value);
  const formatted = new Intl.NumberFormat('en-ZA', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })
    .format(value)
    // en-ZA uses a non-breaking or narrow space for groups and a comma for the
    // decimal; normalise to a plain space and a full stop.
    .replace(/[  \s]/g, ' ')
    .replace(',', '.');

  return `R${formatted.startsWith('-') ? '-' : ''}${formatted.replace('-', '')}`;
}

/** The increment that applies at `current`. Mirrors SQL `bid_step`. */
export function bidStep(table: IncrementRow[], current: number): number {
  for (const row of table) {
    if (row.upTo === null || current < row.upTo) return row.step;
  }
  return 100; // same fallback as the SQL function
}

/**
 * The lowest bid the server will accept. Mirrors SQL `next_min_bid`: the
 * starting bid while there is no bid, otherwise the high bid plus its step.
 */
export function nextMinBid(input: {
  startingBid: number;
  highBid: number | null;
  incrementTable: IncrementRow[];
}): number {
  const { startingBid, highBid, incrementTable } = input;
  if (highBid === null) return startingBid;
  return highBid + bidStep(incrementTable, highBid);
}

/** Cents, for payment providers that bill in minor units (Yoco). */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
