import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import { PageHeader, SectionHeading, StaffShell } from '@/components/staff/StaffShell';
import { Ticket } from '@/components/staff/Ticket';
import { Button } from '@/components/ui/button';
import { hasRole, requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';

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
        <div className="border-hairline-strong rounded-xl border border-dashed p-12 text-center">
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
            <ul className="grid gap-4 xl:grid-cols-2">
              {group.rows.map((event) => (
                <li key={event.id}>
                  <Ticket event={event} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </StaffShell>
  );
}
