import Link from 'next/link';
import { CalendarDays, MapPin, QrCode } from 'lucide-react';
import { PageHeader, StaffShell, StatusPill } from '@/components/staff/StaffShell';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { formatEventDate } from '@/lib/dates';

export const metadata = { title: 'Scanner' };

/**
 * The event picker — TASKS T2.6, BUILD-SPEC §7.2.
 *
 * Door staff are handed a phone minutes before the doors open, so the list is
 * short on purpose: the department's events that are published or live and
 * happening within a day either side. Anything older or further off would be a
 * chance to scan the wrong event's guests in.
 */
export default async function ScanPickerPage() {
  const profile = await requireStaff(['door_staff', 'organiser', 'auction_operator']);
  const supabase = await createClient();

  const day = 24 * 60 * 60 * 1000;
  const from = new Date(Date.now() - day).toISOString();
  const to = new Date(Date.now() + day).toISOString();

  const [{ data: near }, { data: upcoming }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, starts_at, venue_name, status, auction_enabled')
      .in('status', ['published', 'live'])
      .gte('starts_at', from)
      .lte('starts_at', to)
      .order('starts_at', { ascending: true }),
    supabase
      .from('events')
      .select('id, title, starts_at, venue_name, status, auction_enabled')
      .in('status', ['published', 'live'])
      .gt('starts_at', to)
      .order('starts_at', { ascending: true })
      .limit(6),
  ]);

  const tonight = near ?? [];
  const later = upcoming ?? [];

  return (
    <StaffShell profile={profile}>
      <PageHeader
        title="Scanner"
        breadcrumb="At the door"
        description={
          tonight.length > 0
            ? 'Choose the event you are working, then point the camera at a guest’s pass.'
            : 'Nothing is on today. Any published event can still be opened below.'
        }
      />

      {tonight.length > 0 ? (
        <ul className="mb-12 space-y-4">
          {tonight.map((event) => (
            <li key={event.id}>
              <EventChoice event={event} primary />
            </li>
          ))}
        </ul>
      ) : null}

      {later.length > 0 ? (
        <>
          <p className="eyebrow mb-4">Later on the calendar</p>
          <ul className="space-y-3">
            {later.map((event) => (
              <li key={event.id}>
                <EventChoice event={event} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {tonight.length === 0 && later.length === 0 ? (
        <div className="border-hairline-strong rounded-xl border border-dashed p-12 text-center">
          <QrCode className="text-cut-700/40 mx-auto size-10" aria-hidden />
          <p className="text-ink-900 mt-4 font-semibold">No event to scan</p>
          <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
            An event has to be published before its guests can be checked in.
          </p>
        </div>
      ) : null}
    </StaffShell>
  );
}

function EventChoice({
  event,
  primary = false,
}: {
  event: {
    id: string;
    title: string;
    starts_at: string;
    venue_name: string | null;
    status: string;
  };
  primary?: boolean;
}) {
  return (
    <Link
      href={`/scan/${event.id}`}
      className="card card-hover flex items-center gap-4 p-5 sm:gap-5"
    >
      <span
        className={
          'flex size-12 shrink-0 items-center justify-center rounded-xl ' +
          (primary ? 'bg-cut-900 text-gold-500' : 'bg-cut-100 text-cut-900')
        }
      >
        <QrCode className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-display text-cut-900 text-[1.25rem] leading-tight font-semibold">
            {event.title}
          </span>
          <StatusPill status={event.status} />
        </span>
        <span className="text-ink-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden /> {formatEventDate(event.starts_at)}
          </span>
          {event.venue_name ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden /> {event.venue_name}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
