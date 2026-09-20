'use client';

import { useMemo, useState } from 'react';
import { Check, Mail, MessageCircle, Search } from 'lucide-react';
import { StatusPill } from '@/components/staff/StatusPill';
import { formatTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { RemoveInviteeButton } from './GuestForms';

export type GuestRow = {
  id: string;
  status: string;
  sent_via: string[];
  first_sent_at: string | null;
  opened_at: string | null;
  responded_at: string | null;
  name: string;
  initials: string;
  detail: string | null;
  organisation: string | null;
};

const REPLIES = [
  { key: 'accepted', label: 'Accepted', bar: 'bg-gold-500' },
  { key: 'waitlisted', label: 'Waiting list', bar: 'bg-gold-500/40' },
  { key: 'declined', label: 'Declined', bar: 'bg-red-700/45' },
  { key: 'pending', label: 'Yet to reply', bar: 'bg-cut-900/12' },
] as const;

type ReplyKey = (typeof REPLIES)[number]['key'];

/**
 * The guest list itself — TASKS T2.3, redrawn in the v3 vocabulary.
 *
 * The one drawing on the page is the reply bar: every invitation is a slice,
 * gold for a yes, faint for no answer yet, so the organiser sees at a glance
 * how the room is filling. Its legend doubles as the filter. Filtering and
 * search happen here in the browser because a guest list is in the tens or
 * low hundreds; the server already sends every row for the table.
 */
export function GuestList({ eventId, rows }: { eventId: string; rows: GuestRow[] }) {
  const [filter, setFilter] = useState<ReplyKey | 'all'>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of rows) c[row.status] = (c[row.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        (row.detail ?? '').toLowerCase().includes(q) ||
        (row.organisation ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

  const total = rows.length;

  return (
    <div>
      {/* The reply bar */}
      <div
        className="bg-cut-900/6 flex h-3 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={REPLIES.map((r) => `${counts[r.key] ?? 0} ${r.label.toLowerCase()}`).join(', ')}
      >
        {REPLIES.map((r) => {
          const n = counts[r.key] ?? 0;
          if (n === 0) return null;
          return (
            <span
              key={r.key}
              className={cn('h-full transition-[width] duration-700', r.bar)}
              style={{ width: `${(n / total) * 100}%` }}
            />
          );
        })}
      </div>

      {/* Legend as filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="Everyone"
          count={total}
        />
        {REPLIES.map((r) => {
          const n = counts[r.key] ?? 0;
          if (n === 0 && r.key === 'waitlisted') return null;
          return (
            <FilterChip
              key={r.key}
              active={filter === r.key}
              onClick={() => setFilter(r.key)}
              label={r.label}
              count={n}
              swatch={r.bar}
            />
          );
        })}

        <label className="relative ml-auto w-full sm:w-64">
          <Search
            className="text-ink-500 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a guest"
            aria-label="Find a guest on the list"
            className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 h-10 w-full rounded-md border bg-white pr-3 pl-9 text-sm focus:ring-4 focus:outline-none"
          />
        </label>
      </div>

      {/* The list */}
      <div className="card table-card mt-5 overflow-hidden">
        <table>
          <thead>
            <tr>
              <th scope="col">Guest</th>
              <th scope="col">Reply</th>
              <th scope="col" className="hidden md:table-cell">
                Sent
              </th>
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-ink-500 py-10 text-center text-sm">
                  Nobody on the list matches that.
                </td>
              </tr>
            ) : (
              shown.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={cn(
                          'font-display flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                          row.status === 'accepted'
                            ? 'bg-gold-500 text-cut-950'
                            : 'bg-cut-100 text-cut-900',
                        )}
                      >
                        {row.initials}
                      </span>
                      <span className="min-w-0">
                        <span className="text-ink-900 block truncate font-semibold">
                          {row.name}
                        </span>
                        <span className="text-ink-500 block truncate text-xs">
                          {row.detail ?? 'No contact details'}
                          {row.organisation ? ` · ${row.organisation}` : ''}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <StatusPill status={row.status}>
                      {row.status === 'pending' ? 'No reply' : row.status}
                    </StatusPill>
                    {row.responded_at ? (
                      <span className="text-ink-500 mt-1 block text-xs">
                        {formatTime(row.responded_at)}
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden md:table-cell">
                    <Channels sentVia={row.sent_via} opened={row.opened_at !== null} />
                  </td>
                  <td className="text-right">
                    {row.status === 'pending' ? (
                      <RemoveInviteeButton
                        eventId={eventId}
                        invitationId={row.id}
                        name={row.name}
                      />
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="text-ink-500 border-hairline bg-cut-50/60 border-t px-5 py-2.5 text-xs">
          {shown.length === total
            ? `${total} on the guest list`
            : `${shown.length} of ${total} on the guest list`}
        </p>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  swatch,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-cut-900 text-white'
          : 'border-hairline-strong text-ink-700 hover:border-cut-700 border bg-white',
      )}
    >
      {swatch ? (
        <span
          className={cn('size-2 shrink-0 rounded-full', swatch, active && 'ring-1 ring-white/60')}
        />
      ) : null}
      {label}
      <span className={cn('tabular', active ? 'text-white/60' : 'text-ink-500')}>{count}</span>
    </button>
  );
}

/** Which channels the invitation went out on, and whether it was opened. */
function Channels({ sentVia, opened }: { sentVia: string[]; opened: boolean }) {
  if (sentVia.length === 0) {
    return <span className="text-ink-300 text-xs">Not sent</span>;
  }
  return (
    <span className="text-ink-700 inline-flex items-center gap-2 text-xs">
      {sentVia.includes('email') ? (
        <span className="inline-flex items-center gap-1" title="Sent by email">
          <Mail className="text-cut-700 size-3.5" aria-hidden /> Email
        </span>
      ) : null}
      {sentVia.includes('whatsapp') ? (
        <span className="inline-flex items-center gap-1" title="Sent on WhatsApp">
          <MessageCircle className="text-cut-700 size-3.5" aria-hidden /> WhatsApp
        </span>
      ) : null}
      {opened ? (
        <span className="inline-flex items-center gap-1 text-green-600" title="Opened">
          <Check className="size-3.5" aria-hidden /> Opened
        </span>
      ) : null}
    </span>
  );
}
