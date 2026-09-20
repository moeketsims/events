import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { PageHeader, SectionHeading, StaffShell } from '@/components/staff/StaffShell';
import { Arc, Ledger, LedgerFigure, SeatRow } from '@/components/staff/Ledger';
import { Button } from '@/components/ui/button';
import { hasRole, requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatTime, formatBidderNumber } from '@/lib/dates';
import { TIME_ZONE } from '@/lib/env';
import { LiveArrivals } from './LiveArrivals';
import { CheckInButton } from './CheckInButton';

export const metadata = { title: 'Attendance' };

type Filter = 'all' | 'arrived' | 'waiting';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'arrived', label: 'Arrived' },
  { id: 'waiting', label: 'Not yet arrived' },
];

/**
 * The live register — TASKS T2.7. What replaces the clipboard at the door.
 *
 * The table is rendered on the server and re-read when `LiveArrivals` sees a
 * `checkin` payload, so the page never holds a list the database does not
 * agree with. The payload itself carries no name (0006_realtime.sql): a public
 * channel says only that the count moved.
 */
export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { eventId } = await params;
  const { show } = await searchParams;
  const filter: Filter = show === 'arrived' || show === 'waiting' ? show : 'all';

  const profile = await requireStaff(['organiser', 'finance', 'auction_operator']);
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, title, starts_at, capacity, auction_enabled, status')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) notFound();

  // The register joins attendees to contacts and to the usher who scanned them.
  // The check above has already established, through RLS, that this event is
  // the caller's; the admin client is only here because PostgREST will not
  // embed two policy-guarded relations at once.
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from('attendees')
    .select(
      'id, display_name, is_plus_one, is_walk_in, bidder_number, checked_in_at, checked_in_by, contacts(email, phone_e164, organisation), invitations(status)',
    )
    .eq('event_id', eventId)
    .order('checked_in_at', { ascending: false, nullsFirst: false })
    .order('display_name', { ascending: true });

  const attendees = rows ?? [];

  const scannerIds = [...new Set(attendees.map((row) => row.checked_in_by).filter(Boolean))];
  const scanners = new Map<string, string>();
  if (scannerIds.length > 0) {
    const { data: staff } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', scannerIds as string[]);
    for (const person of staff ?? []) {
      scanners.set(person.id, person.full_name ?? person.email ?? '');
    }
  }

  const arrived = attendees.filter((row) => row.checked_in_at !== null);
  const walkIns = attendees.filter((row) => row.is_walk_in).length;
  const rate = attendees.length ? (arrived.length / attendees.length) * 100 : 0;

  const shown =
    filter === 'arrived'
      ? arrived
      : filter === 'waiting'
        ? attendees.filter((row) => row.checked_in_at === null)
        : attendees;

  const canCheckIn = hasRole(profile, ['organiser', 'auction_operator']);

  return (
    <StaffShell profile={profile}>
      <Link
        href={`/events/${eventId}`}
        className="text-cut-700 hover:text-cut-900 mb-6 inline-flex items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" aria-hidden /> {event.title}
      </Link>

      <PageHeader
        title="Attendance"
        breadcrumb="The register"
        description={
          attendees.length === 0
            ? 'Nobody is expected yet. Guests appear here as they accept their invitations.'
            : 'Live from the door. Every arrival is time-stamped and attributed to the usher who scanned it.'
        }
        action={
          attendees.length > 0 ? (
            <Button asChild variant="outline" size="lg" className="h-11 px-5">
              <a href={`/api/events/${eventId}/attendance.csv`} download>
                <Download className="size-4" aria-hidden /> Export CSV
              </a>
            </Button>
          ) : null
        }
      />

      <Ledger className="lg:grid-cols-4">
        <LiveArrivals eventId={eventId} initial={arrived.length} expected={attendees.length} />
        <LedgerFigure
          label="Expected"
          value={attendees.length}
          note={event.capacity ? `Room for ${event.capacity}` : 'No capacity set'}
          visual={<SeatRow taken={arrived.length} total={attendees.length} />}
        />
        <LedgerFigure
          label="Turnout"
          value={Math.round(rate)}
          unit="%"
          note={`${attendees.length - arrived.length} still to come`}
          visual={<Arc percent={rate} />}
        />
        <LedgerFigure
          label="Walk-ins"
          value={walkIns}
          note={walkIns === 0 ? 'Nobody unexpected yet' : 'Registered at the door'}
        />
      </Ledger>

      {arrived.length > 0 ? (
        <section className="mt-14">
          <SectionHeading eyebrow="The evening" title="Arrivals" />
          <ArrivalsChart
            arrivals={arrived
              .map((row) => row.checked_in_at)
              .filter((value): value is string => value !== null)}
          />
        </section>
      ) : null}

      <section className="mt-14">
        <SectionHeading
          eyebrow="Who is here"
          title="Register"
          action={
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((option) => (
                <Link
                  key={option.id}
                  href={
                    option.id === 'all'
                      ? `/events/${eventId}/attendance`
                      : `/events/${eventId}/attendance?show=${option.id}`
                  }
                  aria-current={filter === option.id ? 'page' : undefined}
                  className={
                    filter === option.id
                      ? 'bg-cut-900 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white'
                      : 'border-hairline-strong text-ink-700 hover:border-cut-700 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors'
                  }
                >
                  {option.label}
                </Link>
              ))}
            </div>
          }
        />

        {shown.length === 0 ? (
          <div className="border-hairline-strong rounded-xl border border-dashed p-12 text-center">
            <p className="text-ink-900 font-semibold">
              {attendees.length === 0
                ? 'No guests expected yet'
                : filter === 'arrived'
                  ? 'Nobody has arrived yet'
                  : 'Everyone expected is here'}
            </p>
            <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
              {attendees.length === 0
                ? 'An accepted invitation creates the guest and their pass.'
                : 'The list updates by itself as the door scans.'}
            </p>
          </div>
        ) : (
          <div className="card table-card overflow-hidden">
            <table>
              <thead>
                <tr>
                  <th scope="col">Guest</th>
                  <th scope="col">Type</th>
                  <th scope="col">Arrived</th>
                  <th scope="col">Scanned by</th>
                  {event.auction_enabled ? (
                    <th scope="col" className="text-right">
                      Bidder
                    </th>
                  ) : null}
                  <th scope="col">
                    <span className="sr-only">Check in</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="text-ink-900 font-semibold">{row.display_name}</span>
                      <span className="text-ink-500 block text-xs">
                        {row.contacts?.organisation ?? row.contacts?.email ?? '—'}
                      </span>
                    </td>
                    <td className="text-ink-700 text-xs">
                      {row.is_walk_in ? 'Walk-in' : row.is_plus_one ? 'Plus-one' : 'Invited'}
                    </td>
                    <td>
                      {row.checked_in_at ? (
                        <span className="font-semibold text-green-600">
                          {formatTime(row.checked_in_at)}
                        </span>
                      ) : (
                        <span className="text-ink-300">Not yet</span>
                      )}
                    </td>
                    <td className="text-ink-500 text-xs">
                      {row.checked_in_by ? (scanners.get(row.checked_in_by) ?? '—') : '—'}
                    </td>
                    {event.auction_enabled ? (
                      <td className="numeral text-cut-900 text-right text-base">
                        {row.bidder_number === null ? (
                          <span className="text-ink-300">—</span>
                        ) : (
                          formatBidderNumber(row.bidder_number)
                        )}
                      </td>
                    ) : null}
                    <td className="text-right">
                      {row.checked_in_at === null && canCheckIn ? (
                        <CheckInButton
                          eventId={eventId}
                          attendeeId={row.id}
                          name={row.display_name}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </StaffShell>
  );
}

/**
 * Arrivals in fifteen-minute buckets, drawn as a band of bars.
 *
 * Not a chart library: this is one series of small integers, and the honest
 * drawing of "when did the room fill" is fifteen bars an organiser can read
 * from across a table.
 */
function ArrivalsChart({ arrivals }: { arrivals: string[] }) {
  const QUARTER = 15 * 60 * 1000;

  const times = arrivals.map((value) => new Date(value).getTime()).sort((a, b) => a - b);
  const first = times[0];
  const last = times[times.length - 1];
  if (first === undefined || last === undefined) return null;

  const start = Math.floor(first / QUARTER) * QUARTER;
  const end = Math.floor(last / QUARTER) * QUARTER;
  const buckets: { at: number; count: number }[] = [];

  for (let at = start; at <= end; at += QUARTER) {
    buckets.push({ at, count: times.filter((t) => t >= at && t < at + QUARTER).length });
  }

  const peak = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const label = new Intl.DateTimeFormat('en-ZA', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div className="card p-5">
      <div className="flex h-36 items-end gap-1.5">
        {buckets.map((bucket) => (
          <div key={bucket.at} className="flex min-w-0 flex-1 flex-col items-center justify-end">
            <span className="numeral text-cut-900 mb-1 text-sm">
              {bucket.count > 0 ? bucket.count : ''}
            </span>
            <span
              className="bg-cut-900 w-full rounded-t-sm"
              style={{ height: `${Math.max(2, (bucket.count / peak) * 100)}%` }}
              title={`${bucket.count} between ${label.format(bucket.at)} and ${label.format(bucket.at + QUARTER)}`}
            />
          </div>
        ))}
      </div>
      <div className="border-hairline text-ink-500 mt-2 flex justify-between border-t pt-2 text-xs">
        <span>{label.format(start)}</span>
        <span>
          {arrivals.length} {arrivals.length === 1 ? 'arrival' : 'arrivals'} in fifteen-minute steps
        </span>
        <span>{label.format(end + QUARTER)}</span>
      </div>
    </div>
  );
}
