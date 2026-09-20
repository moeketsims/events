'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { formatBidderNumber } from '@/lib/dates';
import { formatZAR } from '@/lib/money';
import { Countdown, useLive } from '../AuctionLive';
import { cn } from '@/lib/utils';

export type RecentBid = { id: string; amount: number; at: string; bidder: string };

/**
 * The lot itself — TASKS T3.3, DESIGN-SYSTEM §5.2.
 *
 * The carousel is a scroll-snap strip rather than a slider library: a phone
 * already knows how to swipe, and a library would cost more than the two lines
 * of CSS it would replace.
 */
export function LotDetail({
  lotId,
  lotNumber,
  title,
  description,
  donorName,
  images,
  recent,
}: {
  lotId: string;
  lotNumber: number;
  title: string;
  description: string | null;
  donorName: string | null;
  images: string[];
  recent: RecentBid[];
}) {
  const { lots, bidderNumber, extended } = useLive();
  const [shown, setShown] = useState(0);
  const lot = lots.find((row) => row.lotId === lotId);
  const leading = lot?.highBidderNumber !== null && lot?.highBidderNumber === bidderNumber;

  return (
    <article className="glass-panel overflow-hidden rounded-2xl">
      <div className="bg-cut-950 relative">
        {images.length === 0 ? (
          <div className="flex aspect-[4/3] items-center justify-center text-white/30">
            <ImageOff className="size-8" aria-hidden />
          </div>
        ) : (
          <div
            className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              setShown(Math.round(el.scrollLeft / el.clientWidth));
            }}
          >
            {images.map((image, index) => (
              <div key={image} className="relative h-full w-full shrink-0 snap-center">
                <Image
                  src={image}
                  alt={index === 0 ? title : `${title}, photograph ${index + 1}`}
                  fill
                  sizes="(max-width: 480px) 100vw, 480px"
                  className="object-cover"
                  priority={index === 0}
                />
              </div>
            ))}
          </div>
        )}

        <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[0.625rem] font-bold tracking-[0.12em] text-white uppercase backdrop-blur">
          Lot {String(lotNumber).padStart(2, '0')}
        </span>

        {images.length > 1 ? (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((image, index) => (
              <span
                key={image}
                aria-hidden
                className={cn(
                  'size-1.5 rounded-full transition-colors',
                  index === shown ? 'bg-gold-500' : 'bg-white/40',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="p-5">
        <h1 className="font-display text-[1.625rem] leading-tight font-semibold text-white">
          {title}
        </h1>
        {donorName ? <p className="mt-1 text-sm text-white/60">Donated by {donorName}</p> : null}

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[0.625rem] font-bold tracking-[0.14em] text-white/60 uppercase">
              {lot?.highBid === null || lot?.highBid === undefined ? 'Opening bid' : 'Current bid'}
            </p>
            <p className="numeral text-gold-metallic text-[2.25rem]">
              {formatZAR(lot?.highBid ?? lot?.startingBid ?? 0)}
            </p>
            <p className="text-xs text-white/60">
              {lot && lot.highBid !== null
                ? `Bidder ${formatBidderNumber(lot.highBidderNumber)} · ${lot.bidCount} ${lot.bidCount === 1 ? 'bid' : 'bids'}`
                : 'No bids yet'}
              {leading ? ' · that is you' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60">Next min {formatZAR(lot?.nextMin ?? 0)}</p>
            <p className="mt-1 text-sm">
              {lot && extended.has(lot.lotId) ? (
                <span className="text-gold-500 font-semibold">Extended</span>
              ) : (
                <Countdown closesAt={lot?.closesAt ?? null} status={lot?.status ?? 'upcoming'} />
              )}
            </p>
          </div>
        </div>

        {description ? (
          <p className="mt-5 border-t border-white/10 pt-5 text-[0.9375rem] leading-relaxed text-white/75">
            {description}
          </p>
        ) : null}

        {recent.length > 0 ? (
          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-[0.625rem] font-bold tracking-[0.14em] text-white/60 uppercase">
              Recent bids
            </p>
            <ul className="mt-2 space-y-1.5">
              {recent.map((bid) => (
                <li key={bid.id} className="flex justify-between gap-3 text-sm text-white/75">
                  <span>Bidder {bid.bidder}</span>
                  <span className="numeral text-white">{formatZAR(bid.amount)}</span>
                  <span className="text-white/60 tabular-nums">{bid.at}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-white/60">The room sees numbers, never names.</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
