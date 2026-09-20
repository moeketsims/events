'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Search, UserPlus, Users, X } from 'lucide-react';
import { formatTime, formatBidderNumber } from '@/lib/dates';
import type { AttendeeSearchRow } from '@/app/api/attendees/route';
import type { CheckinResponse } from '@/app/api/checkin/route';
import { WalkInForm } from './WalkInForm';

// html5-qrcode reaches for `navigator` at import time (BUILD-SPEC §11b), so the
// camera is never part of the server render.
const CameraView = dynamic(() => import('./CameraView').then((m) => m.CameraView), {
  ssr: false,
  loading: () => <div className="flex-1 bg-black" />,
});

type Tab = 'scan' | 'search' | 'walkin' | 'count';

export type ScanResult = CheckinResponse & { source: 'scan' | 'search' | 'walkin' };

/** How long a result card stays up before scanning resumes — §5.3. */
const RESULT_MS = 2500;

/** Ignore the same code for three seconds, so one pass is not read twice. */
const REPEAT_MS = 3000;

/**
 * The door, in one screen — TASKS T2.6, DESIGN-SYSTEM §5.3.
 *
 * Four tabs on 64 px targets, because this is used one-handed by a student
 * usher in a queue. Everything that can fail at the door has a way round it:
 * no camera, no phone, no invitation, already scanned.
 */
export function Scanner({
  event,
  initialCounts,
  staffName,
}: {
  event: { id: string; title: string; auctionEnabled: boolean };
  initialCounts: { expected: number; checkedIn: number };
  staffName: string;
}) {
  const [tab, setTab] = useState<Tab>('scan');
  const [counts, setCounts] = useState(initialCounts);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped after every successful check-in so the Search tab re-reads its list
  // and the row the usher just pressed shows as arrived rather than offering
  // the button again.
  const [version, setVersion] = useState(0);
  const lastScan = useRef<{ text: string; at: number } | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCounts = useCallback(async () => {
    try {
      const response = await fetch(`/api/events/${event.id}/counts`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { expected: number; checkedIn: number };
      setCounts({ expected: data.expected, checkedIn: data.checkedIn });
    } catch {
      // A missed count is not worth interrupting the queue for.
    }
  }, [event.id]);

  const show = useCallback((next: ScanResult) => {
    setResult(next);
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => setResult(null), RESULT_MS);

    // A short buzz for success, two for a duplicate, a long one for invalid.
    // Silent on desktop and on iOS, which is why it is never the only signal.
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(
        next.result === 'checked_in'
          ? 60
          : next.result === 'already_checked_in'
            ? [40, 60, 40]
            : 250,
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  // The Count tab is the one place a stale number would be noticed.
  useEffect(() => {
    if (tab !== 'count') return;
    refreshCounts();
    const id = setInterval(refreshCounts, 5000);
    return () => clearInterval(id);
  }, [tab, refreshCounts]);

  const checkIn = useCallback(
    async (body: { token?: string; attendeeId?: string }, source: ScanResult['source']) => {
      setBusy(true);
      try {
        const response = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: event.id, ...body }),
        });

        if (!response.ok) {
          show({
            result: 'invalid',
            displayName: null,
            bidderNumber: null,
            checkedInAt: null,
            source,
          });
          return;
        }

        const data = (await response.json()) as CheckinResponse;
        show({ ...data, source });
        setVersion((v) => v + 1);
        if (data.result === 'checked_in') {
          setCounts((c) => ({ ...c, checkedIn: c.checkedIn + 1 }));
        }
      } catch {
        show({
          result: 'invalid',
          displayName: null,
          bidderNumber: null,
          checkedInAt: null,
          source,
        });
      } finally {
        setBusy(false);
      }
    },
    [event.id, show],
  );

  const onDecode = useCallback(
    (text: string) => {
      const now = Date.now();
      const last = lastScan.current;
      if (last && last.text === text && now - last.at < REPEAT_MS) return;
      lastScan.current = { text, at: now };
      void checkIn({ token: text }, 'scan');
    },
    [checkIn],
  );

  return (
    <div className="bg-cut-950 fixed inset-0 flex flex-col text-white">
      {/* Top bar */}
      <header className="relative z-20 flex items-center gap-3 border-b border-white/10 bg-black/40 px-3 py-2.5 backdrop-blur">
        <Link
          href="/scan"
          aria-label="Choose another event"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{event.title}</p>
          <p className="truncate text-xs text-white/60">{staffName}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="numeral text-gold-500 text-[1.5rem]">{counts.checkedIn}</span>
          <span className="text-sm text-white/60"> / {counts.expected}</span>
        </p>
      </header>

      {/* Body */}
      {tab === 'scan' ? (
        <CameraView onDecode={onDecode} paused={Boolean(result) || busy} />
      ) : tab === 'search' ? (
        <SearchTab
          eventId={event.id}
          version={version}
          onCheckIn={(id) => checkIn({ attendeeId: id }, 'search')}
        />
      ) : tab === 'walkin' ? (
        <WalkInForm
          eventId={event.id}
          onDone={(walkIn) => {
            show({ ...walkIn, source: 'walkin' });
            setCounts((c) => ({ ...c, expected: c.expected + 1, checkedIn: c.checkedIn + 1 }));
            setTab('scan');
          }}
        />
      ) : (
        <CountTab counts={counts} auctionEnabled={event.auctionEnabled} />
      )}

      {/* Result card */}
      {result ? <ResultCard result={result} onDismiss={() => setResult(null)} /> : null}

      {/* Tabs */}
      <nav
        aria-label="Door"
        className="relative z-20 grid shrink-0 grid-cols-4 border-t border-white/10 bg-black/60 backdrop-blur"
      >
        {(
          [
            { id: 'scan', label: 'Scan', icon: Check },
            { id: 'search', label: 'Search', icon: Search },
            { id: 'walkin', label: 'Walk-in', icon: UserPlus },
            { id: 'count', label: 'Count', icon: Users },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={
              'flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold tracking-wide transition-colors ' +
              (tab === id ? 'text-gold-500' : 'text-white/55 hover:text-white/80')
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------------------------------------------------------------- result */

const RESULT_STYLE: Record<string, { bar: string; text: string; title: string }> = {
  checked_in: { bar: 'bg-green-600', text: 'text-white', title: 'Welcome' },
  already_checked_in: { bar: 'bg-sky-500', text: 'text-white', title: 'Already checked in' },
  wrong_event: { bar: 'bg-red-700', text: 'text-white', title: 'Not valid for this event' },
  invalid: { bar: 'bg-red-700', text: 'text-white', title: 'Not a valid pass' },
};

function ResultCard({ result, onDismiss }: { result: ScanResult; onDismiss: () => void }) {
  const style = RESULT_STYLE[result.result] ?? RESULT_STYLE.invalid!;
  // A plus-one whose host did not name them is stored as "Guest of Naledi", so
  // greeting them by "first name" would read "Welcome, Guest."
  const named = result.displayName && !result.displayName.startsWith('Guest of');
  const firstName = named ? (result.displayName?.split(' ')[0] ?? null) : null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="animate-fade-up absolute inset-x-0 bottom-16 z-30 px-3 pb-3"
    >
      <button
        type="button"
        onClick={onDismiss}
        className={`flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] ${style.bar} ${style.text}`}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
          {result.result === 'checked_in' ? (
            <Check className="size-6" aria-hidden />
          ) : result.result === 'already_checked_in' ? (
            <Check className="size-6" aria-hidden />
          ) : (
            <X className="size-6" aria-hidden />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[1.125rem] leading-tight font-bold">
            {result.result === 'checked_in' && firstName ? `Welcome, ${firstName}.` : style.title}
          </span>
          <span className="block truncate text-sm opacity-90">
            {result.result === 'already_checked_in' && result.checkedInAt
              ? `${result.displayName} · arrived at ${formatTime(result.checkedInAt)}`
              : result.result === 'checked_in'
                ? result.displayName
                : result.result === 'wrong_event'
                  ? 'This pass belongs to another event.'
                  : 'Try the Search tab, or register them as a walk-in.'}
          </span>
        </span>

        {result.bidderNumber !== null ? (
          <span className="bg-cut-950 text-gold-500 shrink-0 rounded-full px-3 py-1.5 text-sm font-bold">
            {formatBidderNumber(result.bidderNumber)}
          </span>
        ) : null}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- search */

function SearchTab({
  eventId,
  version,
  onCheckIn,
}: {
  eventId: string;
  version: number;
  onCheckIn: (attendeeId: string) => void;
}) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AttendeeSearchRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Debounced, because this fires on every keystroke of a name typed with
    // one thumb.
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/attendees?eventId=${eventId}&q=${encodeURIComponent(q)}`,
          { cache: 'no-store' },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { rows: AttendeeSearchRow[] };
        if (!cancelled) setRows(data.rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [q, eventId, version]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 p-3">
        <label htmlFor="scan-search" className="sr-only">
          Search guests by name
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-white/40"
            aria-hidden
          />
          <input
            id="scan-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Guest name"
            autoComplete="off"
            className="input-dark h-14 w-full rounded-xl pr-4 pl-11 text-base"
          />
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {rows.length === 0 ? (
          <li className="py-16 text-center text-sm text-white/60">
            {loading ? 'Looking…' : q ? 'Nobody by that name on this list.' : 'Type a name.'}
          </li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="border-b border-white/8 last:border-0">
              <div className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{row.displayName}</span>
                  <span className="block truncate text-xs text-white/60">
                    {row.checkedInAt
                      ? `Arrived at ${formatTime(row.checkedInAt)}`
                      : row.isPlusOne
                        ? 'Guest of another attendee'
                        : row.isWalkIn
                          ? 'Walk-in'
                          : 'Not yet arrived'}
                    {row.bidderNumber !== null
                      ? ` · Bidder ${formatBidderNumber(row.bidderNumber)}`
                      : ''}
                  </span>
                </span>

                {row.checkedInAt ? (
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-600/20 text-green-500">
                    <Check className="size-5" aria-hidden />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCheckIn(row.id)}
                    className="bg-gold-500 text-cut-950 hover:bg-gold-600 h-11 shrink-0 rounded-lg px-4 text-sm font-semibold transition-colors"
                  >
                    Check in
                  </button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------------------- count */

function CountTab({
  counts,
  auctionEnabled,
}: {
  counts: { expected: number; checkedIn: number };
  auctionEnabled: boolean;
}) {
  const toCome = Math.max(0, counts.expected - counts.checkedIn);
  const percent = counts.expected ? Math.round((counts.checkedIn / counts.expected) * 100) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div>
        <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/60 uppercase">
          In the room
        </p>
        <p className="numeral text-gold-500 mt-2 text-[5.5rem] leading-none">{counts.checkedIn}</p>
        <p className="mt-2 text-white/70">
          of {counts.expected} expected · {percent}%
        </p>
      </div>

      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
        <div
          className="bg-gold-500 h-full rounded-full transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="text-sm text-white/60">
        {toCome === 0
          ? 'Everyone expected is here.'
          : `${toCome} still to arrive. The count refreshes every few seconds.`}
      </p>

      {auctionEnabled ? (
        <p className="text-xs text-white/60">
          Each arrival is given the next bidder number automatically.
        </p>
      ) : null}
    </div>
  );
}
