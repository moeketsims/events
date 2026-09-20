import { CountUp } from '@/components/brand/CountUp';
import { Marquee } from '@/components/brand/Marquee';
import { formatBidderNumber, formatEventDate } from '@/lib/dates';
import { formatZAR } from '@/lib/money';
import type { Showcase } from '@/lib/public/showcase';
import { cn } from '@/lib/utils';

/**
 * "Tonight" on the public pages: the featured event, the money, the room, and a
 * ticker of the last anonymised bids. If there is no event, it renders nothing
 * and the page falls back to the pillars. `compact` is the single-screen
 * variant used on the sign-in page.
 */
export function LiveStrip({
  data,
  compact = false,
  className,
}: {
  data: Showcase;
  compact?: boolean;
  className?: string;
}) {
  if (!data.event) return null;
  const live = data.event.status === 'live';

  return (
    <div className={cn('glass-panel rounded-2xl', compact ? 'p-5' : 'p-6 sm:p-7', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.16em] text-white/70 uppercase">
          {live ? <span className="live-dot" /> : null}
          {live ? 'Live tonight' : 'Next event'}
        </p>
        <p className="text-sm text-white/55">
          {formatEventDate(data.event.startsAt)}
          {data.event.venue ? ` · ${data.event.venue}` : ''}
        </p>
      </div>

      <p
        className={cn(
          'font-display leading-none font-semibold text-white',
          compact ? 'mt-2 text-[1.375rem]' : 'mt-3 text-[1.75rem]',
        )}
      >
        {data.event.title}
      </p>

      <div className={cn('grid grid-cols-3 gap-4 sm:gap-8', compact ? 'mt-4' : 'mt-6')}>
        <Figure
          compact={compact}
          label="Raised so far"
          value={
            <CountUp value={data.totalRaised} format="zar" className="text-gold-metallic" />
          }
        />
        <Figure
          compact={compact}
          label="Guests arrived"
          value={<CountUp value={data.arrived} />}
          hint={data.expected ? `of ${data.expected}` : undefined}
        />
        <Figure
          compact={compact}
          label="Lots open"
          value={<CountUp value={data.lotsOpen} duration={1200} />}
        />
      </div>

      {data.recentBids.length > 0 ? (
        <div
          className={cn(
            'border-t border-white/10',
            compact ? 'mt-4 pt-3 [@media(max-height:760px)]:hidden' : 'mt-6 pt-4',
          )}
        >
          <Marquee speed={38}>
            {data.recentBids.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-3 text-sm whitespace-nowrap text-white/75">
                <span className="text-gold-500 text-[10px]">◆</span>
                <span className="text-white/50">Lot {b.lotNumber}</span>
                <span className="text-white">{b.lotTitle}</span>
                <span className="numeral text-gold-500 text-base">{formatZAR(b.amount)}</span>
                <span className="text-white/50">Bidder {formatBidderNumber(b.bidderNumber)}</span>
              </span>
            ))}
          </Marquee>
        </div>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  compact,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  compact: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[0.6875rem] font-bold tracking-[0.14em] text-white/50 uppercase">{label}</p>
      <p
        className={cn(
          'numeral truncate text-white',
          compact ? 'mt-1.5 text-[1.75rem] sm:text-[2rem]' : 'mt-2 text-[2rem] sm:text-[2.5rem]',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-white/45">{hint}</p> : null}
    </div>
  );
}
