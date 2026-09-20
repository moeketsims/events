import Link from 'next/link';
import { ArrowRight, CalendarDays, Plus, QrCode, Radio, Users } from 'lucide-react';
import {
  ActionCard,
  DateBlock,
  PageHeader,
  SectionHeading,
  StaffShell,
  StatTile,
  StatusPill,
} from '@/components/staff/StaffShell';
import { EventHero } from '@/components/staff/EventHero';
import { Button } from '@/components/ui/button';
import { hasRole, requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { formatEventDate } from '@/lib/dates';
import { TIME_ZONE } from '@/lib/env';

export const metadata = { title: 'Dashboard' };

const TODAY = new Intl.DateTimeFormat('en-ZA', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export default async function DashboardPage() {
  const profile = await requireStaff();
  const supabase = await createClient();

  // RLS confines all of these to the signed-in user's department.
  const [{ data: events }, { count: contactCount }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, slug, starts_at, venue_name, status, auction_enabled')
      .in('status', ['published', 'live', 'draft'])
      .order('starts_at', { ascending: true })
      .limit(8),
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
  ]);

  const upcoming = events ?? [];
  const liveCount = upcoming.filter((e) => e.status === 'live').length;
  const featured = upcoming.find((e) => e.status === 'live') ?? upcoming.find((e) => e.status === 'published') ?? upcoming[0];
  const rest = upcoming.filter((e) => e.id !== featured?.id);

  const counts = featured
    ? await featuredCounts(supabase, featured.id)
    : { invited: 0, accepted: 0, attendees: 0, checkedIn: 0 };

  // Door staff cannot create events, so do not offer them the button: a control
  // that always ends in a 403 is worse than no control.
  const canOrganise = hasRole(profile, ['organiser']);
  const firstName = profile.fullName?.split(' ')[0] ?? 'there';

  return (
    <StaffShell profile={profile}>
      <PageHeader
        breadcrumb={TODAY.format(new Date())}
        title={`Good ${daypart()}, ${firstName}`}
        description={
          liveCount > 0
            ? 'Doors are open. The scanner and the broadcast desk are one tap away.'
            : 'Here is where your department stands across invitations, arrivals and giving.'
        }
        action={
          canOrganise ? (
            <Button asChild size="lg" className="h-11 px-5">
              <Link href="/events/new">
                <Plus className="size-4" aria-hidden /> Create an event
              </Link>
            </Button>
          ) : null
        }
      />

      {featured ? (
        <EventHero event={featured} counts={counts} canOrganise={canOrganise} />
      ) : (
        <EmptyHero canCreate={canOrganise} />
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Events"
          value={upcoming.length}
          hint="Open in your department"
          icon={<CalendarDays className="size-4" aria-hidden />}
        />
        <StatTile
          label="Live now"
          value={liveCount}
          hint={liveCount > 0 ? 'Doors open' : 'Nothing live'}
          icon={<Radio className="size-4" aria-hidden />}
          tone="gold"
        />
        <StatTile
          label="Accepted"
          value={counts.accepted}
          hint={featured ? `of ${counts.invited} invited` : undefined}
          icon={<Users className="size-4" aria-hidden />}
          tone="green"
        />
        <StatTile
          label="Contacts"
          value={contactCount ?? 0}
          hint="In your department"
          icon={<Users className="size-4" aria-hidden />}
          tone="sky"
        />
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeading
            eyebrow="Calendar"
            title="Upcoming events"
            action={
              <Link
                href="/events"
                className="text-cut-700 hover:text-cut-900 inline-flex items-center gap-1 text-sm font-semibold"
              >
                All events <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />

          {rest.length === 0 ? (
            <div className="border-hairline-strong rounded-xl border border-dashed bg-white/60 p-8 text-center">
              <p className="text-ink-900 font-semibold">
                {featured ? 'Nothing else scheduled' : 'No events yet'}
              </p>
              <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
                {canOrganise
                  ? 'Create the next one when it is ready. Drafts appear here too.'
                  : 'Nothing further has been published to your department.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rest.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="card card-hover flex items-center gap-5 p-4"
                  >
                    <DateBlock date={event.starts_at} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-cut-900 truncate text-[1.375rem] leading-tight font-semibold">
                        {event.title}
                      </p>
                      <p className="text-ink-500 mt-1 truncate text-sm">
                        {formatEventDate(event.starts_at)}
                        {event.venue_name ? ` · ${event.venue_name}` : ''}
                      </p>
                    </div>
                    <StatusPill status={event.status} className="hidden sm:inline-flex" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading eyebrow="Tonight" title="At the door" />
          <div className="space-y-3">
            <ActionCard
              href="/scan"
              icon={<QrCode className="size-5" aria-hidden />}
              title="Open the scanner"
              description="Scan passes, search by name, register a walk-in."
            />
            {canOrganise ? (
              <>
                <ActionCard
                  href="/contacts"
                  icon={<Users className="size-5" aria-hidden />}
                  title="Guest list"
                  description="Import contacts, search, tag, add to an event."
                />
                {featured ? (
                  <ActionCard
                    href={`/events/${featured.id}/broadcasts`}
                    icon={<Radio className="size-5" aria-hidden />}
                    title="Broadcast desk"
                    description="Reach everyone who has arrived, in-app and on WhatsApp."
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      </div>
    </StaffShell>
  );
}

async function featuredCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<{ invited: number; accepted: number; attendees: number; checkedIn: number }> {
  const [invited, accepted, attendees, checkedIn] = await Promise.all([
    supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'accepted'),
    supabase.from('attendees').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('checked_in_at', 'is', null),
  ]);
  return {
    invited: invited.count ?? 0,
    accepted: accepted.count ?? 0,
    attendees: attendees.count ?? 0,
    checkedIn: checkedIn.count ?? 0,
  };
}

function daypart(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-ZA', { timeZone: TIME_ZONE, hour: 'numeric', hour12: false }).format(
      new Date(),
    ),
  );
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function EmptyHero({ canCreate }: { canCreate: boolean }) {
  return (
    <section className="bg-hero watermark shadow-hero relative overflow-hidden rounded-2xl p-10 text-white">
      <div className="relative z-10 max-w-xl">
        <p className="eyebrow eyebrow-on-dark">Getting started</p>
        <h2 className="font-display mt-4 text-4xl leading-none font-bold sm:text-5xl">
          Your first event starts here.
        </h2>
        <p className="mt-4 text-white/75">
          {canCreate
            ? 'Create an event, import a guest list, and send invitations. Passes, the door scanner and the auction follow from there.'
            : 'Nothing has been published to your department yet.'}
        </p>
        {canCreate ? (
          <Button asChild variant="gold" size="lg" className="mt-6 h-11 px-5">
            <Link href="/events/new">
              <Plus className="size-4" aria-hidden /> Create an event
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
