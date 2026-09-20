import Link from 'next/link';
import { Gavel, MapPin } from 'lucide-react';
import { formatEventDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { StatusPill } from './StaffShell';

/**
 * An event as a ticket — DESIGN-SYSTEM §5.1 v3. Date on the stub, a dashed
 * perforation with notches, the details on the body, a barcode edge. The one
 * card in the console that is allowed to be literal, because events are what
 * tickets are for.
 */
export function Ticket({
  event,
  className,
}: {
  event: {
    id: string;
    title: string;
    starts_at: string;
    venue_name: string | null;
    status: string;
    auction_enabled: boolean;
    capacity?: number | null;
  };
  className?: string;
}) {
  const d = new Date(event.starts_at);
  const day = new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric' }).format(d);
  const month = new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short' }).format(d);
  const weekday = new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', weekday: 'short' }).format(d);

  return (
    <Link href={`/events/${event.id}`} className={cn('ticket ticket-hover', className)}>
      <div className="ticket-stub py-4">
        <span className="text-cut-700 text-[0.625rem] font-bold tracking-[0.16em] uppercase">{weekday}</span>
        <span className="numeral text-cut-900 text-[2.25rem]">{day}</span>
        <span className="text-cut-700 text-[0.6875rem] font-bold tracking-[0.14em] uppercase">{month}</span>
      </div>

      <div className="min-w-0 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-500 text-[0.625rem] font-bold tracking-[0.16em] uppercase">Admit</span>
          <StatusPill status={event.status} />
          {event.auction_enabled ? (
            <span className="text-cut-900 inline-flex items-center gap-1 text-[0.625rem] font-bold tracking-[0.16em] uppercase">
              <Gavel className="text-gold-600 size-3" aria-hidden /> Auction
            </span>
          ) : null}
        </div>
        <p className="font-display text-cut-900 mt-2 truncate text-[1.5rem] leading-tight font-semibold">
          {event.title}
        </p>
        <p className="text-ink-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>{formatEventDate(event.starts_at)}</span>
          {event.venue_name ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="text-cut-700 size-3.5" aria-hidden /> {event.venue_name}
            </span>
          ) : null}
          {event.capacity ? <span>{event.capacity} seats</span> : null}
        </p>
      </div>

      <div className="ticket-barcode" aria-hidden />
    </Link>
  );
}
