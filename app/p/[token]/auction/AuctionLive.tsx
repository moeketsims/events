'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ImageOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatBidderNumber, formatCountdown, formatEventDate } from '@/lib/dates';
import { formatZAR } from '@/lib/money';
import {
  POLL_INTERVAL_MS,
  attendeeTopic,
  auctionTopic,
  realtimeEnabled,
  type BidPlacedPayload,
  type BidVoidedPayload,
  type LotStatusPayload,
  type OutbidPayload,
} from '@/lib/realtime';
import type { AuctionState, LotStateRow } from '@/lib/auction/state';
import { cn } from '@/lib/utils';

export type LotCard = {
  lotId: string;
  image: string | null;
  donorName: string | null;
};

/** Under this much time left, the countdown turns gold and says so. */
const CLOSING_SOON_MS = 2 * 60 * 1000;
/** Beyond this, a ticking clock is noise; the page shows the closing date instead. */
const TICK_WITHIN_MS = 12 * 60 * 60 * 1000;
/** How long the "Extended" flag stays up after a soft close moves the clock. */
const EXTENDED_MS = 3000;

type Live = {
  lots: LotStateRow[];
  bidderNumber: number | null;
  /** Lot ids whose close time has just been pushed out. */
  extended: Set<string>;
  /** Lot ids where this attendee has just lost the lead. */
  outbid: Set<string>;
  /** `connecting` on first load, `live` once subscribed, `down` after a drop. */
  channel: ChannelState;
  /** Milliseconds to add to this device's clock to match the server's. */
  skewMs: number;
  refresh: () => void;
};

export type ChannelState = 'connecting' | 'live' | 'down';

/** How long the first subscribe may take before the board admits it is down. */
const CONNECT_GRACE_MS = 5000;

const LiveContext = createContext<Live | null>(null);

export function useLive(): Live {
  const value = useContext(LiveContext);
  if (!value) throw new Error('useLive outside AuctionLive');
  return value;
}

/**
 * The board, kept live — TASKS T3.3, BUILD-SPEC §4.6.
 *
 * Holds the lot map for every page under `/p/[token]/auction` and applies
 * payloads in place: `bid_placed` moves an amount and a bidder number,
 * `lot_status` flips a lot, `outbid` marks this attendee's loss. A
 * `bid_voided` payload has no bid count, so that one refetches.
 *
 * Both a phone with a wrong clock and a phone with no realtime are handled:
 * the state route returns the server's `now`, which is used to correct every
 * countdown, and with realtime off the same route is polled every two seconds.
 */
export function AuctionLive({
  token,
  auctionId,
  attendeeId,
  initial,
  children,
}: {
  token: string;
  auctionId: string;
  attendeeId: string;
  initial: AuctionState & { bidderNumber: number | null };
  children: React.ReactNode;
}) {
  const [lots, setLots] = useState<LotStateRow[]>(initial.lots);
  const [channel, setChannel] = useState<ChannelState>(realtimeEnabled ? 'connecting' : 'live');
  const [extended, setExtended] = useState<Set<string>>(new Set());
  const [outbid, setOutbid] = useState<Set<string>>(new Set());
  const [skewMs, setSkewMs] = useState(() => new Date(initial.now).getTime() - Date.now());
  const closesAt = useRef(new Map(initial.lots.map((lot) => [lot.lotId, lot.closesAt])));

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/p/${token}/auction/state`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as AuctionState;
      setSkewMs(new Date(data.now).getTime() - Date.now());
      setLots(data.lots);
      closesAt.current = new Map(data.lots.map((lot) => [lot.lotId, lot.closesAt]));
    } catch {
      // A missed refetch is a board that is a couple of seconds stale.
    }
  }, [token]);

  /** Mark a lot as just extended, for three seconds. */
  const flagExtended = useCallback((lotId: string) => {
    setExtended((current) => new Set(current).add(lotId));
    setTimeout(
      () =>
        setExtended((current) => {
          const next = new Set(current);
          next.delete(lotId);
          return next;
        }),
      EXTENDED_MS,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!realtimeEnabled) {
      const id = setInterval(refresh, POLL_INTERVAL_MS);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    // A board that says "Reconnecting" while it is still making its first
    // connection is crying wolf. The pill waits for a real failure, or for this
    // grace period to pass with nothing connected.
    const grace = setTimeout(() => {
      if (!cancelled) setChannel((current) => (current === 'connecting' ? 'down' : current));
    }, CONNECT_GRACE_MS);

    const supabase = createClient();

    const board = supabase
      .channel(auctionTopic(auctionId))
      .on('broadcast', { event: 'bid_placed' }, ({ payload }) => {
        if (cancelled) return;
        const bid = payload as BidPlacedPayload;
        const previous = closesAt.current.get(bid.lot_id) ?? null;
        if (bid.closes_at && previous && new Date(bid.closes_at) > new Date(previous)) {
          flagExtended(bid.lot_id);
        }
        closesAt.current.set(bid.lot_id, bid.closes_at);

        setLots((current) =>
          current.map((lot) =>
            lot.lotId === bid.lot_id
              ? {
                  ...lot,
                  highBid: Number(bid.amount),
                  highBidderNumber: bid.bidder_number,
                  bidCount: lot.bidCount + 1,
                  nextMin: Number(bid.next_min),
                  closesAt: bid.closes_at,
                  // The reserve is never on a public surface; a new high bid may
                  // have met it, so ask the server rather than guess.
                  reserveMet: lot.reserveMet,
                }
              : lot,
          ),
        );

        // A bid of this attendee's own clears their outbid flag on that lot.
        setOutbid((current) => {
          if (!current.has(bid.lot_id)) return current;
          if (bid.bidder_number !== initial.bidderNumber) return current;
          const next = new Set(current);
          next.delete(bid.lot_id);
          return next;
        });
      })
      .on('broadcast', { event: 'lot_status' }, ({ payload }) => {
        if (cancelled) return;
        const status = payload as LotStatusPayload;
        closesAt.current.set(status.lot_id, status.closes_at);
        setLots((current) =>
          current.map((lot) =>
            lot.lotId === status.lot_id
              ? { ...lot, status: status.status, closesAt: status.closes_at }
              : lot,
          ),
        );
        // A lot that has closed has a winner and a settlement behind it; the
        // page needs more than the payload carries.
        if (status.status === 'closed' || status.status === 'unsold') void refresh();
      })
      .on('broadcast', { event: 'bid_voided' }, ({ payload }) => {
        if (cancelled) return;
        const voided = payload as BidVoidedPayload;
        void refresh();
        setOutbid((current) => {
          const next = new Set(current);
          next.delete(voided.lot_id);
          return next;
        });
      })
      .subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setChannel('live');
          // Anything missed while the channel was down is on the server.
          void refresh();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChannel('down');
        }
      });

    const mine = supabase
      .channel(attendeeTopic(attendeeId))
      .on('broadcast', { event: 'outbid' }, ({ payload }) => {
        if (cancelled) return;
        const lost = payload as OutbidPayload;
        setOutbid((current) => new Set(current).add(lost.lot_id));
      })
      .subscribe();

    return () => {
      cancelled = true;
      clearTimeout(grace);
      supabase.removeChannel(board);
      supabase.removeChannel(mine);
    };
  }, [auctionId, attendeeId, refresh, flagExtended, initial.bidderNumber]);

  const value = useMemo<Live>(
    () => ({
      lots,
      bidderNumber: initial.bidderNumber,
      extended,
      outbid,
      channel,
      skewMs,
      refresh,
    }),
    [lots, initial.bidderNumber, extended, outbid, channel, skewMs, refresh],
  );

  return (
    <LiveContext.Provider value={value}>
      {children}
      {channel === 'down' ? (
        <p className="bg-gold-500 text-cut-950 fixed bottom-16 left-4 z-30 rounded-full px-3 py-1.5 text-xs font-bold tracking-wide uppercase">
          Reconnecting
        </p>
      ) : null}
    </LiveContext.Provider>
  );
}

/**
 * One ticker for every countdown on the page. A timer per lot would wake the
 * phone six times a second for no gain.
 */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Countdown({
  closesAt,
  status,
  className,
}: {
  closesAt: string | null;
  status: string;
  className?: string;
}) {
  const { skewMs } = useLive();
  const now = useNow();

  if (status !== 'open') {
    return (
      <span className={cn('text-white/60', className)}>
        {status === 'upcoming' ? 'Not open yet' : 'Bidding closed'}
      </span>
    );
  }
  if (!closesAt) return <span className={cn('text-white/60', className)}>Open</span>;

  const remaining = new Date(closesAt).getTime() - (now + skewMs);
  if (remaining <= 0) return <span className={cn('text-white/60', className)}>Closing…</span>;

  // A lot that closes next month does not need a clock counting off the
  // seconds; it needs the date. The clock starts on the day itself.
  if (remaining > TICK_WITHIN_MS) {
    return (
      <span className={cn('text-white/75', className)}>Closes {formatEventDate(closesAt)}</span>
    );
  }

  const soon = remaining < CLOSING_SOON_MS;
  return (
    <span
      className={cn(
        'tabular-nums',
        soon ? 'text-gold-500 font-semibold' : 'text-white/75',
        className,
      )}
    >
      {formatCountdown(remaining)}
      {soon ? ' · closing soon' : ' left'}
    </span>
  );
}

/** The grid of lot cards — DESIGN-SYSTEM §5.2. */
export function LotGrid({ token, cards }: { token: string; cards: LotCard[] }) {
  const { lots, bidderNumber, extended, outbid } = useLive();
  const byId = new Map(cards.map((card) => [card.lotId, card]));

  return (
    <ul className="space-y-4">
      {lots.map((lot) => {
        const card = byId.get(lot.lotId);
        const leading = lot.highBidderNumber !== null && lot.highBidderNumber === bidderNumber;
        const lost = outbid.has(lot.lotId);

        return (
          <li key={lot.lotId}>
            <Link
              href={`/p/${token}/auction/${lot.lotId}`}
              className={cn(
                'glass-panel block overflow-hidden rounded-2xl transition-colors',
                leading && 'border-gold-500/60',
              )}
            >
              <div className="bg-cut-950 relative aspect-[4/3] w-full">
                {card?.image ? (
                  <Image
                    src={card.image}
                    alt=""
                    fill
                    sizes="(max-width: 480px) 100vw, 480px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-white/30">
                    <ImageOff className="size-8" aria-hidden />
                  </span>
                )}
                <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[0.625rem] font-bold tracking-[0.12em] text-white uppercase backdrop-blur">
                  Lot {String(lot.lotNumber).padStart(2, '0')}
                </span>
                {leading ? (
                  <span className="bg-gold-500 text-cut-950 absolute top-3 right-3 rounded-full px-2.5 py-1 text-[0.625rem] font-bold tracking-[0.12em] uppercase">
                    You are leading
                  </span>
                ) : lost ? (
                  <span className="absolute top-3 right-3 rounded-full bg-red-700 px-2.5 py-1 text-[0.625rem] font-bold tracking-[0.12em] text-white uppercase">
                    Outbid
                  </span>
                ) : null}
              </div>

              <div className="p-4">
                <p className="font-display text-[1.25rem] leading-tight font-semibold text-white">
                  {lot.title}
                </p>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[0.625rem] font-bold tracking-[0.14em] text-white/60 uppercase">
                      {lot.highBid === null ? 'Opening bid' : 'Current bid'}
                    </p>
                    <p className="numeral text-gold-metallic text-[1.5rem]">
                      {formatZAR(lot.highBid ?? lot.startingBid)}
                    </p>
                    {lot.highBid !== null ? (
                      <p className="text-xs text-white/60">
                        Bidder {formatBidderNumber(lot.highBidderNumber)} · {lot.bidCount}{' '}
                        {lot.bidCount === 1 ? 'bid' : 'bids'}
                      </p>
                    ) : (
                      <p className="text-xs text-white/60">No bids yet</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-white/60">Next min {formatZAR(lot.nextMin)}</p>
                    <p className="mt-1 text-sm">
                      {extended.has(lot.lotId) ? (
                        <span className="text-gold-500 font-semibold">Extended</span>
                      ) : (
                        <Countdown closesAt={lot.closesAt} status={lot.status} />
                      )}
                    </p>
                  </div>
                </div>

                {lot.status === 'closed' ? (
                  <p className="mt-3 border-t border-white/10 pt-3 text-sm text-white/75">
                    {lot.highBidderNumber !== null && lot.reserveMet
                      ? `Sold to Bidder ${formatBidderNumber(lot.highBidderNumber)} · ${formatZAR(lot.highBid)}`
                      : 'Not sold'}
                  </p>
                ) : lot.status === 'unsold' ? (
                  <p className="mt-3 border-t border-white/10 pt-3 text-sm text-white/75">
                    Not sold
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
