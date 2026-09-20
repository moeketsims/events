import Link from 'next/link';
import { ArrowRight, CalendarDays, Gavel, MapPin, QrCode, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatEventDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { StatusPill } from './StaffShell';

/**
 * The featured event on the dashboard — DESIGN-SYSTEM §5.1 v2. A navy hero on
 * the `hero` gradient with the watermark, the event as a headline, and the
 * funnel as glass tiles. This is the one place on the console that is allowed
 * to be dramatic.
 */
export function EventHero({
  event,
  counts,
  canOrganise,
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
  canOrganise: boolean;
}) {
  const isLive = event.status === 'live';
  const arrivalPct =
    counts.attendees > 0 ? Math.round((counts.checkedIn / counts.attendees) * 100) : 0;
  const acceptPct = counts.invited > 0 ? Math.round((counts.accepted / counts.invited) * 100) : 0;

  return (
    <section
      aria-labelledby="hero-title"
      className="bg-hero watermark shadow-hero relative overflow-hidden rounded-2xl text-white"
    >
      <div className="relative z-10 grid gap-8 p-7 sm:p-9 lg:grid-cols-[1.25fr_1fr] lg:gap-10 lg:p-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="eyebrow eyebrow-on-dark">{isLive ? 'Happening now' : 'Next event'}</p>
            <StatusPill status={event.status} />
            {event.auction_enabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[0.6875rem] font-bold tracking-[0.1em] text-white/85 uppercase">
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

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="lg" className="h-11 px-5 text-[0.9375rem]">
              <Link href="/scan">
                <QrCode className="size-4" aria-hidden /> Open the scanner
              </Link>
            </Button>
            {canOrganise ? (
              <>
                <Button asChild variant="onDark" size="lg" className="h-11 px-5 text-[0.9375rem]">
                  <Link href={`/events/${event.id}/broadcasts`}>
                    <Radio className="size-4" aria-hidden /> Broadcast
                  </Link>
                </Button>
                {event.auction_enabled ? (
                  <Button asChild variant="onDark" size="lg" className="h-11 px-5 text-[0.9375rem]">
                    <Link href={`/events/${event.id}/auction/console`}>
                      <Gavel className="size-4" aria-hidden /> Auction console
                    </Link>
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6">
          <div className="grid grid-cols-3 gap-3">
            <GlassStat label="Invited" value={counts.invited} />
            <GlassStat label="Accepted" value={counts.accepted} hint={`${acceptPct}%`} />
            <GlassStat label="Checked in" value={counts.checkedIn} hint={`${arrivalPct}%`} gold />
          </div>

          <div>
            <div className="flex items-baseline justify-between text-sm text-white/70">
              <span>Arrivals</span>
              <span className="tabular">
                {counts.checkedIn} of {counts.attendees} expected
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="bg-gold-500 h-full rounded-full transition-[width] duration-700"
                style={{ width: `${Math.min(100, arrivalPct)}%` }}
              />
            </div>
          </div>

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
        </div>
      </div>
    </section>
  );
}

function GlassStat({
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
    <div className="rounded-xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
      <p className="text-[0.6875rem] font-bold tracking-[0.12em] text-white/60 uppercase">{label}</p>
      <p className={cn('numeral mt-2 text-[2.25rem]', gold ? 'text-gold-500' : 'text-white')}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-white/55">{hint}</p> : null}
    </div>
  );
}
