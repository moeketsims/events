import Link from 'next/link';
import { CalendarDays, Gavel, MapPin, Plus, Users } from 'lucide-react';
import {
  DateBlock,
  PageHeader,
  SectionHeading,
  StaffShell,
  StatusPill,
} from '@/components/staff/StaffShell';
import { Button } from '@/components/ui/button';
import { hasRole, requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { formatEventDate } from '@/lib/dates';

export const metadata = { title: 'Events' };

const ORDER = [
  { status: 'live', label: 'Happening now' },
  { status: 'published', label: 'Upcoming' },
  { status: 'draft', label: 'Drafts' },
  { status: 'closed', label: 'Closed' },
  { status: 'archived', label: 'Archived' },
] as const;

export default async function EventsPage() {
  const profile = await requireStaff();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from('events')
    .select('id, title, starts_at, venue_name, status, auction_enabled, capacity')
    .order('starts_at', { ascending: true });

  const grouped = ORDER.map((group) => ({
    ...group,
    rows: (events ?? []).filter((e) => e.status === group.status),
  })).filter((g) => g.rows.length > 0);

  const canCreate = hasRole(profile, ['organiser']);

  return (
    <StaffShell profile={profile}>
      <PageHeader
        title="Events"
        breadcrumb={profile.departmentName ?? 'Department'}
        description={`${events?.length ?? 0} in your department, from draft to archive.`}
        action={
          canCreate ? (
            <Button asChild size="lg" className="h-11 px-5">
              <Link href="/events/new">
                <Plus className="size-4" aria-hidden /> Create an event
              </Link>
            </Button>
          ) : null
        }
      />

      {grouped.length === 0 ? (
        <div className="border-hairline-strong rounded-xl border border-dashed bg-white/60 p-12 text-center">
          <CalendarDays className="text-cut-700/40 mx-auto size-10" aria-hidden />
          <p className="text-ink-900 mt-4 font-semibold">No events yet</p>
          <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
            {canCreate
              ? 'Create one, or run pnpm seed to load the demo gala.'
              : 'Nothing has been published to your department yet.'}
          </p>
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.status} className="mb-12">
            <SectionHeading eyebrow={group.status} title={group.label} />
            <ul className="grid gap-4 md:grid-cols-2">
              {group.rows.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="card card-hover flex h-full flex-col p-5"
                  >
                    <div className="flex items-start gap-4">
                      <DateBlock date={event.starts_at} />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-cut-900 text-[1.5rem] leading-tight font-semibold text-balance">
                          {event.title}
                        </p>
                        <p className="text-ink-500 mt-1.5 text-sm">
                          {formatEventDate(event.starts_at)}
                        </p>
                      </div>
                      <StatusPill status={event.status} />
                    </div>

                    <div className="border-hairline text-ink-500 mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4 text-sm">
                      {event.venue_name ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="text-cut-700 size-4" aria-hidden /> {event.venue_name}
                        </span>
                      ) : null}
                      {event.capacity ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="text-cut-700 size-4" aria-hidden /> {event.capacity} seats
                        </span>
                      ) : null}
                      {event.auction_enabled ? (
                        <span className="text-cut-900 inline-flex items-center gap-1.5 font-semibold">
                          <Gavel className="text-gold-600 size-4" aria-hidden /> Auction
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </StaffShell>
  );
}
