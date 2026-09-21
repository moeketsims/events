'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { CountUp } from '@/components/brand/CountUp';
import { Logo } from '@/components/brand/Logo';
import { Marquee } from '@/components/brand/Marquee';
import { createClient } from '@/lib/supabase/client';
import { formatBidderNumber, formatCountdown, formatTime } from '@/lib/dates';
import { formatZAR } from '@/lib/money';
import {
  POLL_INTERVAL_MS,
  auctionTopic,
  realtimeEnabled,
  type BidPlacedPayload,
  type DisplayModePayload,
  type LotStatusPayload,
} from '@/lib/realtime';
import type { AuctionState, LotStateRow } from '@/lib/auction/state';
import type { LotBid, TickerBid } from '@/lib/auction/display';
import { cn } from '@/lib/utils';

export type BoardLot = { lotId: string; image: string | null; donorName: string | null };

export type BoardInitial = AuctionState & {
  mode: string;
  spotlightLotId: string | null;
  recentBids: TickerBid[];
};

type Mode = 'grid' | 'spotlight' | 'total';
type ChannelState = 'connecting' | 'live' | 'down';

/** Six cards per grid page, 3 × 2, per DESIGN-SYSTEM §5.4. */
const PAGE_SIZE = 6;
/** How long each grid page stays up when there are more than six lots. */
const PAGE_EVERY_MS = 12_000;
/** The gold border after a bid. */
const FLASH_MS = 1500;
/** Under this much time left, the countdown turns gold and says so. */
const CLOSING_SOON_MS = 2 * 60 * 1000;
/** Beyond this, the board shows the closing time rather than a ticking clock. */
const TICK_WITHIN_MS = 12 * 60 * 60 * 1000;
/** How long the first subscribe may take before the board admits it is down. */
const CONNECT_GRACE_MS = 5000;
/** Chips in the footer ticker. */
const TICKER_SIZE = 8;

function asMode(value: string | null | undefined): Mode {
  return value === 'spotlight' || value === 'total' ? value : 'grid';
}

/**
 * The board, kept live — docs/06 T4.1, BUILD-SPEC §4.6 and §7.4.
 *
 * The same subscription as the phones: `bid_placed` moves an amount, a bidder
 * number and the clock and flashes the card; `lot_status` flips a lot;
 * `bid_voided` refetches; `display_mode` switches the whole board. With
 * realtime off the state route is polled every two seconds, mode included, so
 * the operator's switch still lands. The board never blanks: a dropped channel
 * shows the pill and the last known board until the channel returns, when it
 * refetches everything missed.
 */
export function Board({
  auctionId,
  title,
  eventTitle,
  cards,
  initial,
}: {
  auctionId: string;
  title: string;
  eventTitle: string;
  cards: BoardLot[];
  initial: BoardInitial;
}) {
  const order = useMemo(() => new Map(cards.map((card, i) => [card.lotId, i])), [cards]);
  const byId = useMemo(() => new Map(cards.map((card) => [card.lotId, card])), [cards]);
  const sortLots = useCallback(
    (rows: LotStateRow[]) =>
      [...rows].sort((a, b) => (order.get(a.lotId) ?? 0) - (order.get(b.lotId) ?? 0)),
    [order],
  );

  const [lots, setLots] = useState<LotStateRow[]>(() => sortLots(initial.lots));
  const [totalRaised, setTotalRaised] = useState(initial.totalRaised);
  const [mode, setMode] = useState<Mode>(asMode(initial.mode));
  const [spotlightLotId, setSpotlightLotId] = useState<string | null>(initial.spotlightLotId);
  const [spotlightBids, setSpotlightBids] = useState<LotBid[]>([]);
  const [ticker, setTicker] = useState<TickerBid[]>(initial.recentBids);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<ChannelState>(realtimeEnabled ? 'connecting' : 'live');
  const [skewMs, setSkewMs] = useState(() => new Date(initial.now).getTime() - Date.now());

  /** The key travels with the page URL when cookies are refused; pass it on. */
  const query = () => (typeof window === 'undefined' ? '' : window.location.search);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/display/${auctionId}/state${query()}`, {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = (await response.json()) as BoardInitial;
      setSkewMs(new Date(data.now).getTime() - Date.now());
      setLots(sortLots(data.lots));
      setTotalRaised(data.totalRaised);
      setMode(asMode(data.mode));
      setSpotlightLotId(data.spotlightLotId);
      setTicker(data.recentBids);
    } catch {
      // A missed refetch is a board a couple of seconds stale, never a blank one.
    }
  }, [auctionId, sortLots]);

  const loadSpotlightBids = useCallback(
    async (lotId: string | null) => {
      if (!lotId) {
        setSpotlightBids([]);
        return;
      }
      try {
        const response = await fetch(`/api/display/${auctionId}/lot/${lotId}/bids${query()}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = (await response.json()) as { bids: LotBid[] };
        setSpotlightBids(data.bids);
      } catch {
        // The amount and leader are already on the board; the list can wait.
      }
    },
    [auctionId],
  );

  const flash = useCallback((lotId: string) => {
    setFlashing((current) => new Set(current).add(lotId));
    setTimeout(
      () =>
        setFlashing((current) => {
          const next = new Set(current);
          next.delete(lotId);
          return next;
        }),
      FLASH_MS,
    );
  }, []);

  // The spotlight's bid list follows the spotlit lot.
  useEffect(() => {
    if (mode === 'spotlight') void loadSpotlightBids(spotlightLotId);
  }, [mode, spotlightLotId, loadSpotlightBids]);

  useEffect(() => {
    let cancelled = false;

    if (!realtimeEnabled) {
      const id = setInterval(refresh, POLL_INTERVAL_MS);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }

    const grace = setTimeout(() => {
      if (!cancelled) setChannel((current) => (current === 'connecting' ? 'down' : current));
    }, CONNECT_GRACE_MS);

    const supabase = createClient();
    const board = supabase
      .channel(auctionTopic(auctionId))
      .on('broadcast', { event: 'bid_placed' }, ({ payload }) => {
        if (cancelled) return;
        const bid = payload as BidPlacedPayload;
        let lotTitle = '';
        let previousHigh: number | null = null;
        setLots((current) => {
          const next = current.map((lot) => {
            if (lot.lotId !== bid.lot_id) return lot;
            lotTitle = lot.title;
            previousHigh = lot.highBid;
            return {
              ...lot,
              highBid: Number(bid.amount),
              highBidderNumber: bid.bidder_number,
              bidCount: lot.bidCount + 1,
              nextMin: Number(bid.next_min),
              closesAt: bid.closes_at,
            };
          });
          return next;
        });
        // The total is the sum of leading bids, so it moves by the difference.
        setTotalRaised((current) => current - (previousHigh ?? 0) + Number(bid.amount));
        setTicker((current) =>
          [
            {
              lotId: bid.lot_id,
              lotNumber: bid.lot_number,
              lotTitle,
              amount: Number(bid.amount),
              bidderNumber: bid.bidder_number,
              placedAt: new Date().toISOString(),
            },
            ...current,
          ].slice(0, TICKER_SIZE),
        );
        flash(bid.lot_id);
        setSpotlightLotId((spot) => {
          if (spot === bid.lot_id) void loadSpotlightBids(spot);
          return spot;
        });
      })
      .on('broadcast', { event: 'lot_status' }, ({ payload }) => {
        if (cancelled) return;
        const status = payload as LotStatusPayload;
        setLots((current) =>
          current.map((lot) =>
            lot.lotId === status.lot_id
              ? { ...lot, status: status.status, closesAt: status.closes_at }
              : lot,
          ),
        );
        if (status.status === 'closed' || status.status === 'unsold') void refresh();
      })
      .on('broadcast', { event: 'bid_voided' }, () => {
        if (cancelled) return;
        void refresh();
        setSpotlightLotId((spot) => {
          void loadSpotlightBids(spot);
          return spot;
        });
      })
      .on('broadcast', { event: 'display_mode' }, ({ payload }) => {
        if (cancelled) return;
        const next = payload as DisplayModePayload;
        setMode(asMode(next.mode));
        setSpotlightLotId(next.lot_id);
      })
      .subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setChannel('live');
          void refresh();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChannel('down');
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(grace);
      supabase.removeChannel(board);
    };
  }, [auctionId, refresh, flash, loadSpotlightBids]);

  const spotlight = lots.find((lot) => lot.lotId === spotlightLotId) ?? lots[0] ?? null;

  return (
    <>
      <Header title={title} eventTitle={eventTitle} skewMs={skewMs} live={channel === 'live'} />

      <main className="min-h-0 flex-1 px-[3vh] pb-[2vh]">
        {mode === 'total' ? (
          <TotalMode totalRaised={totalRaised} />
        ) : mode === 'spotlight' && spotlight ? (
          <SpotlightMode
            lot={spotlight}
            card={byId.get(spotlight.lotId)}
            bids={spotlightBids}
            flashing={flashing.has(spotlight.lotId)}
            skewMs={skewMs}
          />
        ) : (
          <GridMode lots={lots} byId={byId} flashing={flashing} skewMs={skewMs} />
        )}
      </main>

      <Footer ticker={ticker} totalRaised={totalRaised} showTotal={mode !== 'total'} />

      {channel === 'down' ? (
        <p className="bg-gold-500 text-cut-950 fixed bottom-[9vh] left-[3vh] z-30 rounded-full px-[2vh] py-[1vh] text-[2vh] font-bold tracking-wide uppercase">
          Reconnecting
        </p>
      ) : null}
    </>
  );
}

/** One clock for the whole board. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Header({
  title,
  eventTitle,
  skewMs,
  live,
}: {
  title: string;
  eventTitle: string;
  skewMs: number;
  live: boolean;
}) {
  const now = useNow(1000);
  return (
    <header className="flex items-center justify-between gap-[3vh] px-[3vh] pt-[2.5vh] pb-[2vh]">
      <span className="shadow-plate inline-flex shrink-0 rounded-xl bg-white p-[1.2vh] [&_img]:h-[5.5vh]! [&_img]:w-auto!">
        <Logo variant="horizontal" size="md" priority />
      </span>
      <div className="min-w-0 text-center">
        <p className="font-display truncate text-[3.7vh] leading-none font-bold">{title}</p>
        {eventTitle ? (
          <p className="mt-[0.8vh] truncate text-[1.9vh] tracking-[0.14em] text-white/60 uppercase">
            {eventTitle}
          </p>
        ) : null}
      </div>
      <p className="numeral flex shrink-0 items-center gap-[1.5vh] text-[3.2vh] text-white/85">
        <span className={cn('live-dot', !live && 'opacity-30')} aria-hidden />
        <span suppressHydrationWarning>{formatTime(new Date(now + skewMs))}</span>
      </p>
    </header>
  );
}

function Footer({
  ticker,
  totalRaised,
  showTotal,
}: {
  ticker: TickerBid[];
  totalRaised: number;
  showTotal: boolean;
}) {
  return (
    <footer className="flex h-[8vh] shrink-0 items-center gap-[3vh] border-t border-white/10 pl-[3vh]">
      {showTotal ? (
        <p className="flex shrink-0 items-baseline gap-[1.5vh] whitespace-nowrap">
          <span className="text-[1.8vh] font-bold tracking-[0.16em] text-white/60 uppercase">
            Raised so far
          </span>
          <span className="numeral text-gold-metallic text-[3.6vh]">{formatZAR(totalRaised)}</span>
        </p>
      ) : null}
      <div className="min-w-0 flex-1">
        {ticker.length > 0 ? (
          <Marquee speed={40}>
            {ticker.map((bid, i) => (
              <span
                key={`${bid.placedAt}-${i}`}
                className="inline-flex items-center gap-[1.5vh] rounded-full border border-white/10 bg-white/8 px-[2vh] py-[0.8vh] text-[2.6vh] whitespace-nowrap backdrop-blur"
              >
                <span className="text-gold-500 text-[1.4vh]">◆</span>
                <span className="text-white/60">Lot {bid.lotNumber}</span>
                <span className="numeral text-gold-500 text-[2.8vh]">{formatZAR(bid.amount)}</span>
                <span className="text-white/75">Bidder {formatBidderNumber(bid.bidderNumber)}</span>
              </span>
            ))}
          </Marquee>
        ) : (
          <p className="text-[2.2vh] text-white/50">The first bid of the evening goes here.</p>
        )}
      </div>
    </footer>
  );
}

function Countdown({
  lot,
  skewMs,
  className,
}: {
  lot: LotStateRow;
  skewMs: number;
  className?: string;
}) {
  const now = useNow(250);

  if (lot.status !== 'open') {
    return (
      <span className={cn('text-white/60', className)}>
        {lot.status === 'upcoming' ? 'Opens soon' : lot.status === 'closed' ? 'Sold' : 'Closed'}
      </span>
    );
  }
  if (!lot.closesAt) return <span className={cn('text-white/60', className)}>Open</span>;

  const remaining = new Date(lot.closesAt).getTime() - (now + skewMs);
  if (remaining <= 0) return <span className={cn('text-white/60', className)}>Closing…</span>;
  if (remaining > TICK_WITHIN_MS) {
    return (
      <span className={cn('text-white/70', className)}>Closes {formatTime(lot.closesAt)}</span>
    );
  }

  const soon = remaining < CLOSING_SOON_MS;
  return (
    <span
      className={cn('tabular-nums', soon ? 'text-gold-500 font-bold' : 'text-white/80', className)}
    >
      {formatCountdown(remaining)}
      {soon ? ' · closing soon' : ''}
    </span>
  );
}

function LotImage({ card, sizes }: { card: BoardLot | undefined; sizes: string }) {
  return card?.image ? (
    <Image src={card.image} alt="" fill sizes={sizes} className="object-cover" priority />
  ) : (
    <span className="flex h-full items-center justify-center text-white/25">
      <ImageOff className="size-[6vh]" aria-hidden />
    </span>
  );
}

function GridMode({
  lots,
  byId,
  flashing,
  skewMs,
}: {
  lots: LotStateRow[];
  byId: Map<string, BoardLot>;
  flashing: Set<string>;
  skewMs: number;
}) {
  const pages = Math.max(1, Math.ceil(lots.length / PAGE_SIZE));
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pages <= 1) {
      setPage(0);
      return;
    }
    const id = setInterval(() => setPage((current) => (current + 1) % pages), PAGE_EVERY_MS);
    return () => clearInterval(id);
  }, [pages]);

  const visible = lots.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const first = page * PAGE_SIZE + 1;
  const last = Math.min(lots.length, page * PAGE_SIZE + PAGE_SIZE);

  if (lots.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-display text-[5vh] text-white/70">The lots are being set up.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {pages > 1 ? (
        <p className="mb-[1vh] shrink-0 text-[1.8vh] font-bold tracking-[0.16em] text-white/60 uppercase">
          Lots {first}–{last} of {lots.length}
        </p>
      ) : null}
      <ul className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-[2vh]">
        {visible.map((lot) => (
          <li
            key={lot.lotId}
            className={cn(
              'glass-panel flex min-h-0 flex-col overflow-hidden rounded-[2vh] border-[0.4vh] transition-[border-color,box-shadow] duration-300',
              flashing.has(lot.lotId)
                ? 'border-gold-500 shadow-[0_0_6vh_rgba(251,185,39,0.55)]'
                : 'border-transparent',
            )}
          >
            <div className="bg-cut-950 relative h-[40%] shrink-0">
              <LotImage card={byId.get(lot.lotId)} sizes="33vw" />
              <span className="absolute top-[1.2vh] left-[1.2vh] rounded-full bg-black/55 px-[1.4vh] py-[0.5vh] text-[1.6vh] font-bold tracking-[0.12em] text-white uppercase backdrop-blur">
                Lot {String(lot.lotNumber).padStart(2, '0')}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-[2vh] py-[1.4vh]">
              <p className="font-display line-clamp-2 text-[3vh] leading-[1.05] font-semibold">
                {lot.title}
              </p>
              <p className="numeral text-gold-metallic mt-auto py-[0.05em] text-[6.67vh]">
                {formatZAR(lot.highBid ?? lot.startingBid)}
              </p>
              <div className="mt-[0.6vh] flex items-baseline justify-between gap-[2vh] text-[2.6vh]">
                <span className="text-white/80">
                  {lot.highBid === null
                    ? 'Opening bid'
                    : `Bidder ${formatBidderNumber(lot.highBidderNumber)}`}
                </span>
                <Countdown lot={lot} skewMs={skewMs} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpotlightMode({
  lot,
  card,
  bids,
  flashing,
  skewMs,
}: {
  lot: LotStateRow;
  card: BoardLot | undefined;
  bids: LotBid[];
  flashing: boolean;
  skewMs: number;
}) {
  return (
    <div className="grid h-full grid-cols-[45fr_55fr] gap-[3vh]">
      <div
        className={cn(
          'bg-cut-950 relative overflow-hidden rounded-[2vh] border-[0.4vh] transition-[border-color,box-shadow] duration-300',
          flashing ? 'border-gold-500 shadow-[0_0_8vh_rgba(251,185,39,0.55)]' : 'border-white/10',
        )}
      >
        <LotImage card={card} sizes="45vw" />
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden">
        <p className="text-[2.2vh] font-bold tracking-[0.18em] text-white/60 uppercase">
          Lot {String(lot.lotNumber).padStart(2, '0')}
          {card?.donorName ? ` · Donated by ${card.donorName}` : ''}
        </p>
        <p className="font-display mt-[1vh] line-clamp-2 text-[5.9vh] leading-[1.0] font-bold text-balance">
          {lot.title}
        </p>

        <p className="mt-[2.5vh] text-[2vh] font-bold tracking-[0.16em] text-white/60 uppercase">
          {lot.highBid === null ? 'Opening bid' : 'Current bid'}
        </p>
        <p className="numeral text-gold-metallic py-[0.05em] text-[14.8vh] leading-none">
          {formatZAR(lot.highBid ?? lot.startingBid)}
        </p>

        <div className="mt-[1.5vh] flex flex-wrap items-baseline gap-x-[4vh] gap-y-[1vh]">
          <p className="text-[3.7vh] text-white/85">
            {lot.highBid !== null ? (
              <>
                Bidder{' '}
                <span className="numeral text-[4vh] text-white">
                  {formatBidderNumber(lot.highBidderNumber)}
                </span>
              </>
            ) : (
              'No bids yet'
            )}
          </p>
          <p className="text-[3.7vh] text-white/70">
            Next min{' '}
            <span className="numeral text-[4vh] text-white/90">{formatZAR(lot.nextMin)}</span>
          </p>
        </div>
        <p className="mt-[1vh] text-[4.4vh]">
          <Countdown lot={lot} skewMs={skewMs} />
        </p>

        {bids.length > 0 ? (
          <div className="mt-auto min-h-0 shrink border-t border-white/10 pt-[1.2vh]">
            <p className="text-[1.8vh] font-bold tracking-[0.16em] text-white/60 uppercase">
              Recent bids
            </p>
            <ol className="mt-[0.6vh] space-y-[0.2vh]">
              {bids.map((bid, i) => (
                <li
                  key={`${bid.placedAt}-${i}`}
                  className="flex items-baseline justify-between text-[2.6vh]"
                >
                  <span className="text-white/80">
                    Bidder {formatBidderNumber(bid.bidderNumber)}
                  </span>
                  <span
                    className={cn(
                      'numeral text-[3vh]',
                      i === 0 ? 'text-gold-500' : 'text-white/85',
                    )}
                  >
                    {formatZAR(bid.amount)}
                  </span>
                  <span className="text-white/50">{formatTime(bid.placedAt)}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TotalMode({ totalRaised }: { totalRaised: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="eyebrow-on-dark text-[4.4vh] font-bold tracking-[0.18em] uppercase">
        Raised so far
      </p>
      <p className="numeral text-gold-metallic mt-[2vh] py-[0.05em] text-[18.5vh] leading-none">
        <CountUp value={totalRaised} format="zar" duration={1400} />
      </p>
      <p className="font-display text-gold-500 mt-[4vh] text-[3.7vh] font-semibold tracking-wide">
        Thinking Beyond
      </p>
      <span className="shadow-plate mt-[4vh] inline-flex rounded-2xl bg-white p-[2vh] [&_img]:h-[16vh]! [&_img]:w-auto!">
        <Logo variant="vertical" size="md" />
      </span>
    </div>
  );
}
