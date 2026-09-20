'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toDateTimeLocal } from '@/lib/dates';
import type { IncrementRow } from '@/lib/money';
import { upsertAuction, type AuctionActionState } from './actions';
import { describeIncrements, incrementTableSchema, SOFT_CLOSE_MAX, SOFT_CLOSE_MIN } from './schema';

export type EditableAuction = {
  id: string;
  title: string;
  closes_at: string | null;
  soft_close_seconds: number;
  increment_table: IncrementRow[];
};

type Draft = { upTo: string; step: string };

/**
 * Auction settings — TASKS T3.2. Title, close time, soft close, and the
 * increment table as bands: "up to R1 000, rise by R100". The last band is
 * always open-ended, which is what SQL `bid_step` expects, and the preview
 * under the editor says in words what the table will do before it is saved.
 */
export function AuctionSettingsForm({
  eventId,
  auction,
}: {
  eventId: string;
  auction: EditableAuction;
}) {
  const [state, action] = useActionState<AuctionActionState, FormData>(upsertAuction, {});
  const [rows, setRows] = useState<Draft[]>(() =>
    auction.increment_table.map((row) => ({
      upTo: row.upTo === null ? '' : String(row.upTo),
      step: String(row.step),
    })),
  );

  const table = useMemo(() => {
    const candidate = rows.map((row, i) => ({
      upTo: i === rows.length - 1 ? null : Number(row.upTo),
      step: Number(row.step),
    }));
    const parsed = incrementTableSchema.safeParse(candidate);
    return parsed.success
      ? { rows: parsed.data, error: null }
      : { rows: null, error: parsed.error.issues[0]?.message ?? 'Check the bands.' };
  }, [rows]);

  function update(index: number, field: keyof Draft, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addBand() {
    setRows((current) => {
      const last = current[current.length - 1];
      // The new band slots in before the open-ended one, starting where the
      // previous band ended.
      const previousEnd = current[current.length - 2]?.upTo ?? '0';
      const suggested = String(Number(previousEnd) * 2 || 1000);
      return [
        ...current.slice(0, -1),
        { upTo: suggested, step: last?.step ?? '100' },
        { upTo: '', step: last?.step ?? '100' },
      ];
    });
  }

  function removeBand(index: number) {
    setRows((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)));
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="auctionId" value={auction.id} />
      <input
        type="hidden"
        name="incrementTable"
        value={table.rows ? JSON.stringify(table.rows) : ''}
      />

      <div className="space-y-1.5">
        <Label htmlFor="auction-title">Title</Label>
        <Input
          id="auction-title"
          name="title"
          required
          maxLength={160}
          defaultValue={auction.title}
        />
        <p className="text-ink-500 text-sm">
          On the projection header and in every message about it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="auction-closes">Bidding closes</Label>
          <Input
            id="auction-closes"
            name="closesAt"
            type="datetime-local"
            defaultValue={toDateTimeLocal(auction.closes_at)}
          />
          <p className="text-ink-500 text-sm">The default for each lot; a lot can close earlier.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auction-soft">Soft close (seconds)</Label>
          <Input
            id="auction-soft"
            name="softCloseSeconds"
            type="number"
            min={SOFT_CLOSE_MIN}
            max={SOFT_CLOSE_MAX}
            step={10}
            required
            defaultValue={auction.soft_close_seconds}
          />
          <p className="text-ink-500 text-sm">
            A bid inside this window pushes the close back to give it this long again.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Mode</Label>
        <p className="text-ink-700 text-sm">
          Silent <span className="text-ink-500">— fixed in the proof of concept.</span>
        </p>
      </div>

      <fieldset>
        <legend className="label-caps text-ink-500 mb-2">Bid increments</legend>
        <div className="space-y-2">
          {rows.map((row, index) => {
            const last = index === rows.length - 1;
            return (
              <div key={index} className="flex items-center gap-2">
                <span className="text-ink-500 w-12 shrink-0 text-sm">
                  {last ? 'Above' : 'Up to'}
                </span>
                <div className="relative flex-1">
                  <span className="text-ink-500 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    R
                  </span>
                  {last ? (
                    <Input
                      readOnly
                      value={rows[index - 1]?.upTo ? rows[index - 1]!.upTo : '0'}
                      aria-label="Open-ended band start"
                      className="bg-cut-50/60 pl-7"
                    />
                  ) : (
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={row.upTo}
                      onChange={(e) => update(index, 'upTo', e.target.value)}
                      aria-label={`Band ${index + 1} upper limit`}
                      className="pl-7"
                    />
                  )}
                </div>
                <span className="text-ink-500 shrink-0 text-sm">rise by</span>
                <div className="relative w-28 shrink-0">
                  <span className="text-ink-500 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    R
                  </span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={row.step}
                    onChange={(e) => update(index, 'step', e.target.value)}
                    aria-label={`Band ${index + 1} step`}
                    className="pl-7"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeBand(index)}
                  disabled={rows.length <= 1}
                  aria-label="Remove this band"
                  className="text-ink-500 hover:bg-cut-50 hover:text-cut-900 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addBand}
          className="text-cut-700 hover:text-cut-900 mt-2 inline-flex h-9 items-center gap-1.5 text-sm font-semibold"
        >
          <Plus className="size-4" aria-hidden /> Add a band
        </button>

        <div className="bg-cut-50/60 mt-3 rounded-lg p-3">
          {table.rows ? (
            <ul className="text-ink-700 space-y-0.5 text-sm">
              {describeIncrements(table.rows).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-red-700">{table.error}</p>
          )}
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-700/10 p-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : state.notice ? (
        <p role="status" className="rounded-md bg-green-600/10 p-3 text-sm text-green-600">
          {state.notice}
        </p>
      ) : null}

      <Save disabled={!table.rows} />
    </form>
  );
}

function Save({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? 'Saving…' : 'Save settings'}
    </Button>
  );
}
