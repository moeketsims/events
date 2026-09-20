import { z } from 'zod';
import { DEFAULT_INCREMENT_TABLE, formatZAR, type IncrementRow } from '@/lib/money';

/**
 * Shapes the auction editor and its actions agree on. A plain module, not the
 * `'use server'` one, so the client can validate the increment table as the
 * organiser types and the action can validate it again before it is stored.
 */

export const LOT_EDITABLE_STATUSES = ['upcoming', 'open', 'withdrawn'] as const;
export type LotEditableStatus = (typeof LOT_EDITABLE_STATUSES)[number];

export const LOT_STATUS_LABEL: Record<string, string> = {
  upcoming: 'Upcoming',
  open: 'Open for bids',
  withdrawn: 'Withdrawn',
  closed: 'Closed',
  unsold: 'Unsold',
};

export const SOFT_CLOSE_MIN = 30;
export const SOFT_CLOSE_MAX = 600;

const rowSchema = z.object({
  upTo: z.number().positive().nullable(),
  step: z.number().positive(),
});

/**
 * `[{upTo, step}]`, ascending, with the last row open-ended. Mirrors what SQL
 * `bid_step` expects: the first row whose `upTo` is null or above the current
 * bid supplies the step, so a null anywhere but last would swallow every row
 * after it, and an unsorted table would skip bands.
 */
export const incrementTableSchema = z
  .array(rowSchema)
  .min(1, 'Add at least one increment.')
  .superRefine((rows, ctx) => {
    rows.forEach((row, i) => {
      const last = i === rows.length - 1;
      if (last && row.upTo !== null) {
        ctx.addIssue({
          code: 'custom',
          message: 'The last band must be open-ended ("and above").',
          path: [i, 'upTo'],
        });
      }
      if (!last && row.upTo === null) {
        ctx.addIssue({
          code: 'custom',
          message: 'Only the last band may be open-ended.',
          path: [i, 'upTo'],
        });
      }
      const previous = rows[i - 1];
      if (i > 0 && previous?.upTo !== null && previous?.upTo !== undefined && row.upTo !== null) {
        if (row.upTo <= previous.upTo) {
          ctx.addIssue({
            code: 'custom',
            message: 'Each band must end higher than the one before it.',
            path: [i, 'upTo'],
          });
        }
      }
      if (!Number.isInteger(row.step) || row.step <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Steps are whole rands.', path: [i, 'step'] });
      }
    });
  });

/** Parse whatever is stored in `auctions.increment_table`; fall back to the default. */
export function readIncrementTable(value: unknown): IncrementRow[] {
  const parsed = incrementTableSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_INCREMENT_TABLE;
}

/** "From R0 to R1 000 bids rise by R100" — one line per band, for the preview. */
export function describeIncrements(rows: IncrementRow[]): string[] {
  let from = 0;
  return rows.map((row) => {
    const line =
      row.upTo === null
        ? `From ${formatZAR(from)} and above bids rise by ${formatZAR(row.step)}`
        : `From ${formatZAR(from)} to ${formatZAR(row.upTo)} bids rise by ${formatZAR(row.step)}`;
    if (row.upTo !== null) from = row.upTo;
    return line;
  });
}

const money = z.coerce.number().nonnegative().max(100_000_000).multipleOf(0.01);

export const lotSchema = z
  .object({
    auctionId: z.uuid(),
    lotId: z.uuid().optional(),
    lotNumber: z.coerce.number().int().positive().max(9999),
    title: z.string().trim().min(2, 'Give the lot a title.').max(160),
    description: z.string().trim().max(4000).optional(),
    donorName: z.string().trim().max(160).optional(),
    startingBid: money,
    reserve: money.optional(),
    buyNowPrice: money.optional(),
    status: z.enum(LOT_EDITABLE_STATUSES),
    closesAt: z.string().optional(),
  })
  .refine((lot) => lot.reserve === undefined || lot.reserve >= lot.startingBid, {
    message: 'The reserve cannot be below the starting bid.',
    path: ['reserve'],
  });

export type LotInput = z.infer<typeof lotSchema>;
