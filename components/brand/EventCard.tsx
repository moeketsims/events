import { CalendarDays, MapPin } from 'lucide-react';
import { formatEventDate } from '@/lib/dates';
import type { PublicEvent } from '@/lib/public/showcase';
import { cn } from '@/lib/utils';

/**
 * The featured event as an outward-facing page may show it — DESIGN-SYSTEM
 * §2.5. Title, date, venue, and whether it is happening now. Nothing counted,
 * nothing priced: those belong behind sign-in. Renders nothing without an
 * event so the page falls back to copy alone.
 */
export function EventCard({
  event,
  compact = false,
  className,
}: {
  event: PublicEvent | null;
  compact?: boolean;
  className?: string;
}) {
  if (!event) return null;
  const live = event.status === 'live';

  return (
    <div className={cn('glass-panel rounded-2xl', compact ? 'p-5' : 'p-6 sm:p-7', className)}>
      <p className="inline-flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.16em] text-white/70 uppercase">
        {live ? <span className="live-dot" /> : null}
        {live ? 'Happening now' : 'Next on the calendar'}
      </p>

      <p
        className={cn(
          'font-display leading-none font-semibold text-white text-balance',
          compact ? 'mt-3 text-[1.625rem]' : 'mt-4 text-[2rem]',
        )}
      >
        {event.title}
      </p>

      <dl className={cn('space-y-1.5 text-white/70', compact ? 'mt-4 text-[0.9375rem]' : 'mt-5 text-base')}>
        <div className="flex items-center gap-3">
          <CalendarDays className="text-gold-500 size-4 shrink-0" aria-hidden />
          <dd>{formatEventDate(event.startsAt)}</dd>
        </div>
        {event.venue ? (
          <div className="flex items-center gap-3">
            <MapPin className="text-gold-500 size-4 shrink-0" aria-hidden />
            <dd>{event.venue}</dd>
          </div>
        ) : null}
      </dl>

      <div className="hairline-gold mt-5" />
      <p className="mt-4 text-sm text-white/50">
        By invitation. Your invitation link is your RSVP; your pass link is your entry.
      </p>
    </div>
  );
}
