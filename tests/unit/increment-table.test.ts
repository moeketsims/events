import { describe, expect, it } from 'vitest';
import { DEFAULT_INCREMENT_TABLE } from '@/lib/money';
import {
  describeIncrements,
  incrementTableSchema,
  readIncrementTable,
} from '@/app/(staff)/events/[eventId]/auction/schema';

const issues = (value: unknown) => {
  const parsed = incrementTableSchema.safeParse(value);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
};

describe('incrementTableSchema', () => {
  it('accepts the default table', () => {
    expect(issues(DEFAULT_INCREMENT_TABLE)).toEqual([]);
  });

  it('accepts a single open-ended band', () => {
    expect(issues([{ upTo: null, step: 500 }])).toEqual([]);
  });

  it('requires at least one band', () => {
    expect(issues([])).toContain('Add at least one increment.');
  });

  it('requires the last band to be open-ended', () => {
    expect(issues([{ upTo: 1000, step: 100 }])).toContain(
      'The last band must be open-ended ("and above").',
    );
  });

  it('allows only the last band to be open-ended', () => {
    // A null anywhere else would swallow every band after it in SQL bid_step.
    expect(
      issues([
        { upTo: null, step: 100 },
        { upTo: null, step: 500 },
      ]),
    ).toContain('Only the last band may be open-ended.');
  });

  it('requires bands to ascend', () => {
    expect(
      issues([
        { upTo: 5000, step: 100 },
        { upTo: 1000, step: 250 },
        { upTo: null, step: 500 },
      ]),
    ).toContain('Each band must end higher than the one before it.');
    expect(
      issues([
        { upTo: 1000, step: 100 },
        { upTo: 1000, step: 250 },
        { upTo: null, step: 500 },
      ]),
    ).toContain('Each band must end higher than the one before it.');
  });

  it('requires whole-rand steps', () => {
    expect(issues([{ upTo: null, step: 12.5 }])).toContain('Steps are whole rands.');
  });

  it('rejects a zero or negative step and a zero band edge', () => {
    expect(issues([{ upTo: null, step: 0 }]).length).toBeGreaterThan(0);
    expect(issues([{ upTo: null, step: -100 }]).length).toBeGreaterThan(0);
    expect(
      issues([
        { upTo: 0, step: 100 },
        { upTo: null, step: 100 },
      ]).length,
    ).toBeGreaterThan(0);
  });

  it('rejects rows that are not {upTo, step}', () => {
    expect(issues([{ step: 100 }]).length).toBeGreaterThan(0);
    expect(issues('100').length).toBeGreaterThan(0);
  });
});

describe('readIncrementTable', () => {
  it('returns the stored table when it is valid', () => {
    const table = [
      { upTo: 2000, step: 200 },
      { upTo: null, step: 1000 },
    ];
    expect(readIncrementTable(table)).toEqual(table);
  });

  it('falls back to the default for anything invalid, including null', () => {
    expect(readIncrementTable(null)).toEqual(DEFAULT_INCREMENT_TABLE);
    expect(readIncrementTable([{ upTo: 100, step: 10 }])).toEqual(DEFAULT_INCREMENT_TABLE);
    expect(readIncrementTable({ upTo: null, step: 100 })).toEqual(DEFAULT_INCREMENT_TABLE);
  });
});

describe('describeIncrements', () => {
  it('describes each band from where the previous one ended', () => {
    expect(describeIncrements(DEFAULT_INCREMENT_TABLE)).toEqual([
      'From R0 to R1 000 bids rise by R100',
      'From R1 000 to R5 000 bids rise by R250',
      'From R5 000 and above bids rise by R500',
    ]);
  });
});
