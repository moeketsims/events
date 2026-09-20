'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatTime } from '@/lib/dates';
import { POLL_INTERVAL_MS, eventTopic, realtimeEnabled } from '@/lib/realtime';
import { cn } from '@/lib/utils';

export type FeedItem = { id: string; body: string; sentAt: string };

/** How long a new message stays marked unread once it is on screen. */
const SEEN_AFTER_MS = 3000;

/**
 * Messages from the organisers, live — TASKS T3.1, DESIGN-SYSTEM §5.2.
 *
 * The first items come from the server, so the page paints with content. Then
 * the component listens on `event:{id}` for `broadcast` and, on each payload,
 * refetches its own feed: the payload says only that something was sent, and
 * whether *this* guest was in the audience is a question for the server. With
 * realtime off it polls the same route every two seconds.
 *
 * A message is unread until it has been on screen for three seconds or the tab
 * comes back into focus, and what has been seen is kept per attendee in
 * localStorage, so a reload does not light every message gold again.
 */
export function Feed({
  token,
  eventId,
  attendeeId,
  initial,
  emptyCopy,
}: {
  token: string;
  eventId: string;
  attendeeId: string;
  initial: FeedItem[];
  emptyCopy: string;
}) {
  const [items, setItems] = useState<FeedItem[]>(initial);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [connected, setConnected] = useState(true);
  const [notify, setNotify] = useState<'unavailable' | 'default' | 'granted' | 'denied'>(
    'unavailable',
  );
  const [arrived, setArrived] = useState(false);
  const storageKey = `cut_feed_seen:${attendeeId}`;
  const known = useRef<Set<string>>(new Set(initial.map((item) => item.id)));

  // Read what this phone has already seen. A first visit marks everything on
  // the page as seen: a guest opening the pass at the door should not find
  // every message from the afternoon lit up as new.
  useEffect(() => {
    let stored: string[] | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      stored = raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      stored = null;
    }
    const set = new Set(stored ?? initial.map((item) => item.id));
    setSeen(set);
    setHydrated(true);
    if (!stored) persist(storageKey, set);

    if (typeof Notification !== 'undefined') {
      setNotify(Notification.permission === 'default' ? 'default' : Notification.permission);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const markSeen = useCallback(
    (ids: string[]) => {
      setSeen((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.add(id));
        persist(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(`/p/${token}/feed`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { items: FeedItem[] };
      setItems(data.items);

      const fresh = data.items.filter((item) => !known.current.has(item.id));
      data.items.forEach((item) => known.current.add(item.id));
      if (fresh.length > 0) {
        setArrived(true);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const first = fresh[0];
          if (first) {
            try {
              new Notification('From the organisers', { body: first.body, tag: first.id });
            } catch {
              // Some browsers refuse `new Notification` outside a service worker.
            }
          }
        }
      }
    } catch {
      // A missed refetch is a message that arrives on the next signal.
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    if (!realtimeEnabled) {
      const id = setInterval(refetch, POLL_INTERVAL_MS);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    const supabase = createClient();
    const channel = supabase
      .channel(eventTopic(eventId))
      .on('broadcast', { event: 'broadcast' }, () => {
        if (!cancelled) void refetch();
      })
      .subscribe((status) => {
        if (cancelled) return;
        setConnected(status === 'SUBSCRIBED');
        // Anything missed while the channel was down is on the server.
        if (status === 'SUBSCRIBED') void refetch();
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [eventId, refetch]);

  // Unread → seen after three seconds on screen, or when the tab regains focus.
  useEffect(() => {
    if (!hydrated) return;
    const unread = items.filter((item) => !seen.has(item.id)).map((item) => item.id);
    if (unread.length === 0) return;

    const timer = setTimeout(() => markSeen(unread), SEEN_AFTER_MS);
    const onFocus = () => markSeen(unread);
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [items, seen, hydrated, markSeen]);

  async function askToNotify() {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setNotify(result === 'default' ? 'default' : result);
    } catch {
      setNotify('denied');
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {!connected ? (
        <p className="text-gold-500 text-xs font-semibold tracking-wide uppercase">Reconnecting…</p>
      ) : null}

      {items.length === 0 ? (
        <p className="glass-panel rounded-2xl p-5 text-sm leading-relaxed text-white/60">
          {emptyCopy}
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => {
            const unread = hydrated && !seen.has(item.id);
            return (
              <li
                key={item.id}
                className={cn(
                  'glass-panel rounded-2xl p-5 transition-colors duration-700',
                  unread && 'border-l-gold-500 border-l-[3px]',
                )}
              >
                <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-white">
                  {item.body}
                </p>
                <p className="mt-2 text-xs text-white/60">
                  <time dateTime={item.sentAt}>{formatTime(item.sentAt)}</time>
                  {unread ? (
                    <span className="text-gold-500 ml-2 font-semibold tracking-wide uppercase">
                      New
                    </span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {/* Offered only once a message has arrived while the page was open, and
          only as a button: a permission prompt nobody asked for is dismissed. */}
      {arrived && notify === 'default' ? (
        <button
          type="button"
          onClick={askToNotify}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-white/16"
        >
          <BellRing className="size-4" aria-hidden /> Notify me of new messages
        </button>
      ) : null}
    </div>
  );
}

function persist(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-200)));
  } catch {
    // Private mode or a full store: the gold border simply returns on reload.
  }
}
