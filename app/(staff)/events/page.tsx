import Link from 'next/link';
import { PageHeader, StaffShell } from '@/components/staff/StaffShell';
import { Button } from '@/components/ui/button';
import { hasRole, requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { formatEventDate } from '@/lib/dates';

export const metadata = { title: 'Events' };

const ORDER = ['live', 'published', 'draft', 'closed', 'archived'] as const;

export default async function EventsPage() {
  const profile = await requireStaff();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from('events')
    .select('id, title, starts_at, venue_name, status, auction_enabled, capacity')
    .order('starts_at', { ascending: true });

  const grouped = ORDER.map((status) => ({
    status,
    rows: (events ?? []).filter((e) => e.status === status),
  })).filter((g) => g.rows.length > 0);

  const canCreate = hasRole(profile, ['organiser']);

  return (
    <StaffShell profile={profile}>
      <PageHeader
        title="Events"
        breadcrumb={profile.departmentName ?? 'Department'}
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/events/new">Create an event</Link>
            </Button>
          ) : null
        }
      />

      {grouped.length === 0 ? (
        <div className="border-ink-300 rounded-lg border border-dashed bg-white p-10 text-center">
          <p className="text-ink-900 font-semibold">No events yet</p>
          <p className="measure text-ink-500 mx-auto mt-1 text-sm">
            {canCreate
              ? 'Create one, or run pnpm seed to load the demo gala.'
              : 'Nothing has been published to your department yet.'}
          </p>
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.status} className="mb-8">
            <h2 className="label-caps text-ink-500 mb-3">{group.status}</h2>
            <ul className="space-y-3">
              {group.rows.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="border-ink-300 hover:border-cut-700 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-white p-4 transition-colors"
                  >
                    <div>
                      <p className="font-display text-cut-900 text-xl font-semibold">
                        {event.title}
                      </p>
                      <p className="text-ink-500 text-sm">
                        {formatEventDate(event.starts_at)}
                        {event.venue_name ? ` · ${event.venue_name}` : ''}
                        {event.capacity ? ` · capacity ${event.capacity}` : ''}
                      </p>
                    </div>
                    {event.auction_enabled ? (
                      <span className="label-caps bg-cut-100 text-cut-900 rounded-full px-3 py-1">
                        Auction
                      </span>
                    ) : null}
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
