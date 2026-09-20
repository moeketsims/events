'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LedgerFigure } from '@/components/staff/Ledger';
import { createClient } from '@/lib/supabase/client';
import { POLL_INTERVAL_MS, eventTopic, realtimeEnabled, type CheckinPayload } from '@/lib/realtime';

/**
 * The count that moves while you watch it — TASKS T2.7.
 *
 * `check_in_attendee` sends `{event_id, checked_in_count}` on `event:{id}`
 * every time a guest is scanned, so the number here is the database's own count
 * rather than anything this page has added up. On the payload it also calls
 * `router.refresh()`, which re-runs the server component and brings the new
 * row into the table — the payload carries no name, by design (0006).
 *
 * With `NEXT_PUBLIC_REALTIME_MODE=poll` it asks `/api/events/{id}/counts`
 * instead, on the same two-second cadence BUILD-SPEC §4.6 names, so a project
 * where public channels are unavailable still shows a live door.
 */
export function LiveArrivals({
  eventId,
  initial,
  expected,
}: {
  eventId: string;
  initial: number;
  expected: number;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initial);
  const [connected, setConnected] = useState(false);
  const [flash, setFlash] = useState(false);

  // The server's number wins whenever the page re-renders: an optimistic client
  // count that drifts from the register is worse than one that lags a second.
  const serverCount = useRef(initial);
  useEffect(() => {
    if (initial !== serverCount.current) {
      serverCount.current = initial;
      setCount(initial);
    }
  }, [initial]);

  useEffect(() => {
    let cancelled = false;

    function arrive(next: number) {
      if (cancelled) return;
      setCount((current) => {
        if (next > current) {
          setFlash(true);
          setTimeout(() => !cancelled && setFlash(false), 1200);
        }
        return next;
      });
      router.refresh();
    }

    if (!realtimeEnabled) {
      const id = setInterval(async () => {
        try {
          const response = await fetch(`/api/events/${eventId}/counts`, { cache: 'no-store' });
          if (!response.ok) return;
          const data = (await response.json()) as { checkedIn: number };
          if (data.checkedIn !== serverCount.current) arrive(data.checkedIn);
        } catch {
          // A missed poll is a stale number for two seconds. Not worth a toast.
        }
      }, POLL_INTERVAL_MS);

      setConnected(true);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    const supabase = createClient();
    const channel = supabase
      .channel(eventTopic(eventId))
      .on('broadcast', { event: 'checkin' }, ({ payload }) => {
        const data = payload as CheckinPayload;
        if (typeof data?.checked_in_count === 'number') arrive(data.checked_in_count);
      })
      .subscribe((status) => {
        if (!cancelled) setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [eventId, router]);

  const percent = expected ? Math.round((count / expected) * 100) : 0;

  return (
    <LedgerFigure
      label="Arrived"
      labelAdornment={
        <span
          title={connected ? 'Live' : 'Reconnecting'}
          className={
            connected
              ? 'live-dot'
              : 'bg-ink-300 inline-block size-2 shrink-0 rounded-full align-middle'
          }
        />
      }
      value={count}
      unit={`/ ${expected}`}
      note={connected ? `${percent}% of those expected` : 'Reconnecting to the door…'}
      tone={flash ? 'gold' : 'navy'}
    />
  );
}
