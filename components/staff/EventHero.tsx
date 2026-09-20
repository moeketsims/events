import Link from 'next/link';
import { ArrowRight, CalendarDays, Gavel, MapPin, QrCode, Radio } from 'lucide-react';
import { Atmosphere } from '@/components/brand/Atmosphere';
import { Button } from '@/components/ui/button';
import { formatEventDate } from '@/lib/dates';
import { isBuilt } from '@/lib/features';
import { formatZAR } from '@/lib/money';
import { cn } from '@/lib/utils';
import { StatusPill } from './StaffShell';

/**
 * The featured event on the dashboard — DESIGN-SYSTEM §5.1 v3. The ballroom of
 * light behind it, the event as a headline, and the room drawn as seats that
 * turn gold as guests arrive. The one dramatic element on the console.
 */
export function EventHero({
  event,
  counts,
  raised,
  canOrganise,
  showOverviewLink = true,
}: {
  event: {
    id: string;
    title: string;
    starts_at: string;
    venue_name: string | null;
    status: string;
    auction_enabled: boolean;
  };
  counts: { invited: number; accepted: number; attendees: number; checkedIn: number };
  raised: number | null;
  canOrganise: boolean;
  /** Off on the event overview itself, where the link would point at the page. */
  showOverviewLink?: boolean;
}) {
  const isLive = event.status === 'live';
  const toCome = Math.max(0, counts.attendees - counts.checkedIn);

  return (
    <section
      aria-labelledby="hero-title"
      className="shadow-hero relative overflow-hidden rounded-2xl text-white"
    >
      <Atmosphere intensity={0.75} />

      <div className="relative z-10 grid gap-8 p-7 sm:p-9 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:p-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="eyebrow eyebrow-on-dark">{isLive ? 'Happening now' : 'Next event'}</p>
            <StatusPill status={event.status} />
            {event.auction_enabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[0.6875rem] font-bold tracking-[0.1em] text-white/85 uppercase">
                <Gavel className="size-3" aria-hidden /> Auction
              </span>
            ) : null}
          </div>

          <h2
            id="hero-title"
            className="font-display mt-5 text-[2.5rem] leading-[1] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]"
          >
            {event.title}
          </h2>

          <dl className="mt-6 space-y-2 text-[1.0625rem] text-white/80">
            <div className="flex items-center gap-3">
              <CalendarDays className="text-gold-500 size-[18px] shrink-0" aria-hidden />
              <dd>{formatEventDate(event.starts_at)}</dd>
            </div>
            {event.venue_name ? (
              <div className="flex items-center gap-3">
                <MapPin className="text-gold-500 size-[18px] shrink-0" aria-hidden />
                <dd>{event.venue_name}</dd>
              </div>
            ) : null}
          </dl>

          {raised !== null ? (
            <div className="mt-7">
              <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/55 uppercase">
                Raised so far
              </p>
              <p className="numeral text-gold-metallic mt-1 text-[3rem]">{formatZAR(raised)}</p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="lg" className="h-11 px-5 text-[0.9375rem]">
              <Link href="/scan">
                <QrCode className="size-4" aria-hidden /> Open the scanner
              </Link>
            </Button>
            {/* Desks that are not built yet are listed on the desk below with a
                "Coming" mark; a button here that led to a 404 would read as a bug. */}
            {canOrganise && isBuilt('broadcasts') ? (
              <Button asChild variant="onDark" size="lg" className="h-11 px-5 text-[0.9375rem]">
                <Link href={`/events/${event.id}/broadcasts`}>
                  <Radio className="size-4" aria-hidden /> Broadcast
                </Link>
              </Button>
            ) : null}
            {canOrganise && event.auction_enabled && isBuilt('console') ? (
              <Button asChild variant="onDark" size="lg" className="h-11 px-5 text-[0.9375rem]">
                <Link href={`/events/${event.id}/auction/console`}>
                  <Gavel className="size-4" aria-hidden /> Auction console
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        {/* The room */}
        <div className="flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/60 uppercase">
                The room
              </p>
              <p className="text-sm text-white/60">
                <span className="text-gold-500 font-semibold">{counts.checkedIn}</span> arrived ·{' '}
                {toCome} to come
              </p>
            </div>
            <SeatMap total={counts.attendees} taken={counts.checkedIn} className="mt-4" />
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
            <Figure label="Invited" value={counts.invited} />
            <Figure
              label="Accepted"
              value={counts.accepted}
              hint={
                counts.invited
                  ? `${Math.round((counts.accepted / counts.invited) * 100)}%`
                  : undefined
              }
            />
            <Figure
              label="Checked in"
              value={counts.checkedIn}
              hint={
                counts.attendees
                  ? `${Math.round((counts.checkedIn / counts.attendees) * 100)}%`
                  : undefined
              }
              gold
            />
          </div>

          {showOverviewLink ? (
            <Link
              href={`/events/${event.id}`}
              className="group inline-flex items-center gap-2 self-start text-sm font-semibold text-white/85 transition-colors hover:text-white"
            >
              Event overview
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Every expected guest is a seat; arrived seats are lit gold. Capped at 160. */
function SeatMap({
  total,
  taken,
  className,
}: {
  total: number;
  taken: number;
  className?: string;
}) {
  const max = 160;
  const shown = Math.max(1, Math.min(total, max));
  const scale = total > max ? total / max : 1;
  const filled = Math.round(taken / scale);
  return (
    <div className={cn(className)}>
      <div className="flex flex-wrap gap-[6px]" aria-hidden>
        {Array.from({ length: shown }, (_, i) => (
          <span
            key={i}
            className={cn('seat', i < filled && 'seat-taken')}
            style={
              i < filled
                ? { animation: `fade-in 0.4s ease-out both`, animationDelay: `${i * 18}ms` }
                : undefined
            }
          />
        ))}
      </div>
      {total === 0 ? <p className="mt-2 text-sm text-white/55">No guests expected yet.</p> : null}
      {total > max ? (
        <p className="mt-2 text-xs text-white/45">
          Each seat stands for {Math.ceil(scale)} guests.
        </p>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  gold = false,
}: {
  label: string;
  value: number;
  hint?: string;
  gold?: boolean;
}) {
  return (
    <div>
      <p className="text-[0.625rem] font-bold tracking-[0.14em] text-white/55 uppercase">{label}</p>
      <p className={cn('numeral mt-1 text-[2rem]', gold ? 'text-gold-500' : 'text-white')}>
        {value}
        {hint ? <span className="ml-1.5 text-sm font-semibold text-white/45">{hint}</span> : null}
      </p>
    </div>
  );
}
