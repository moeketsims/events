import Link from 'next/link';
import { CalendarDays, QrCode, Users } from 'lucide-react';
import { PageHeader, StaffShell, StatTile } from '@/components/staff/StaffShell';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS, hasRole, requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { formatEventDate } from '@/lib/dates';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const profile = await requireStaff();
  const supabase = await createClient();

  // RLS confines all three of these to the signed-in user's department.
  const [{ data: events }, { count: contactCount }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, slug, starts_at, venue_name, status, auction_enabled')
      .order('starts_at', { ascending: true })
      .limit(8),
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
  ]);

  const upcoming = events ?? [];
  const live = upcoming.filter((e) => e.status === 'live').length;
  // Door staff cannot create events, so do not offer them the button: a control
  // that always ends in a 403 is worse than no control.
  const canCreate = hasRole(profile, ['organiser']);

  return (
    <StaffShell profile={profile}>
      <PageHeader
        title={`Welcome, ${profile.fullName?.split(' ')[0] ?? 'there'}`}
        breadcrumb={profile.departmentName ?? 'CUT Events'}
        description={`Signed in as ${profile.email} · ${ROLE_LABELS[profile.role]}`}
        action={
          canCreate ? (
            <Button asChild>
              <Link href="/events/new">Create an event</Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile label="Events" value={upcoming.length} hint="Visible to your department" />
        <StatTile label="Live now" value={live} hint="Doors open" />
        <StatTile label="Contacts" value={contactCount ?? 0} />
      </div>

      <section>
        <h2 className="text-cut-900 mb-4">Upcoming events</h2>

        {upcoming.length === 0 ? (
          <div className="border-ink-300 rounded-lg border border-dashed bg-white p-10 text-center">
            <CalendarDays className="text-ink-300 mx-auto size-8" aria-hidden />
            <p className="text-ink-900 mt-3 font-semibold">No events yet</p>
            <p className="measure text-ink-500 mx-auto mt-1 text-sm">
              {canCreate
                ? 'Create one, or run pnpm seed to load the demo gala.'
                : 'Nothing has been published to your department yet.'}
            </p>
            {canCreate ? (
              <Button asChild className="mt-4">
                <Link href="/events/new">Create an event</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="border-ink-300 hover:border-cut-700 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-white p-4 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-display text-cut-900 text-xl font-semibold">{event.title}</p>
                    <p className="text-ink-500 text-sm">
                      {formatEventDate(event.starts_at)}
                      {event.venue_name ? ` · ${event.venue_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.auction_enabled ? (
                      <span className="label-caps bg-cut-100 text-cut-900 rounded-full px-3 py-1">
                        Auction
                      </span>
                    ) : null}
                    <StatusPill status={event.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-cut-900 mb-4">At the door</h2>
        <Link
          href="/scan"
          className="border-ink-300 hover:border-cut-700 flex items-center gap-4 rounded-lg border bg-white p-4 transition-colors"
        >
          <QrCode className="text-cut-900 size-8 shrink-0" aria-hidden />
          <div>
            <p className="text-ink-900 font-semibold">Open the scanner</p>
            <p className="text-ink-500 text-sm">Scan passes, search by name, register a walk-in.</p>
          </div>
        </Link>
        {canCreate ? (
          <Link
            href="/contacts"
            className="border-ink-300 hover:border-cut-700 mt-3 flex items-center gap-4 rounded-lg border bg-white p-4 transition-colors"
          >
            <Users className="text-cut-900 size-8 shrink-0" aria-hidden />
            <div>
              <p className="text-ink-900 font-semibold">Contacts</p>
              <p className="text-ink-500 text-sm">Import a guest list, search, tag.</p>
            </div>
          </Link>
        ) : null}
      </section>
    </StaffShell>
  );
}

const PILL: Record<string, string> = {
  draft: 'bg-ink-100 text-ink-700',
  published: 'bg-sky-500 text-white',
  live: 'bg-gold-500 text-ink-900',
  closed: 'bg-green-600 text-white',
  archived: 'bg-ink-300 text-ink-700',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`label-caps rounded-full px-3 py-1 ${PILL[status] ?? PILL.draft}`}>
      {status === 'live' ? (
        <span className="bg-ink-900 mr-1.5 inline-block size-2 animate-pulse rounded-full align-middle" />
      ) : null}
      {status}
    </span>
  );
}
