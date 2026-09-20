import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { PageHeader, SectionHeading, StaffShell } from '@/components/staff/StaffShell';
import { Arc, Ledger, LedgerFigure, SeatRow, StatusLegend } from '@/components/staff/Ledger';
import { Desk } from '@/components/staff/Desk';
import { EventHero } from '@/components/staff/EventHero';
import { Ticket } from '@/components/staff/Ticket';
import { Atmosphere } from '@/components/brand/Atmosphere';
import { Button } from '@/components/ui/button';
import { hasRole, requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
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
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  // RLS confines all of these to the signed-in user's department.
  const [{ data: events }, { count: contactCount }, { count: newContacts }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, slug, starts_at, venue_name, status, auction_enabled, capacity')
      .in('status', ['published', 'live', 'draft'])
      .order('starts_at', { ascending: true })
      .limit(8),
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),
  ]);

  const upcoming = events ?? [];
  const statusCounts = upcoming.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});
  const liveCount = statusCounts.live ?? 0;
  const featured =
    upcoming.find((e) => e.status === 'live') ??
    upcoming.find((e) => e.status === 'published') ??
    upcoming[0];
  const rest = upcoming.filter((e) => e.id !== featured?.id);

  const [counts, raised] = featured
    ? await Promise.all([featuredCounts(supabase, featured.id), raisedFor(supabase, featured.id)])
    : [{ invited: 0, accepted: 0, attendees: 0, checkedIn: 0 }, null];

  const acceptance = counts.invited ? (counts.accepted / counts.invited) * 100 : 0;

  // Door staff cannot create events, so do not offer them the button: a control
  // that always ends in a 403 is worse than no control.
  const canOrganise = hasRole(profile, ['organiser']);
  const firstName = profile.fullName?.split(' ')[0] ?? 'there';

  const desk = [
    { href: '/scan', title: 'Open the scanner', description: 'Scan passes, search by name, register a walk-in.' },
    ...(canOrganise
      ? [
          { href: '/contacts', title: 'Guest list', description: 'Import contacts, search, tag, add to an event.' },
          ...(featured
            ? [
                {
                  href: `/events/${featured.id}/broadcasts`,
                  title: 'Broadcast desk',
                  description: 'Reach everyone who has arrived, in-app and on WhatsApp.',
                },
              ]
            : []),
          ...(featured?.auction_enabled
            ? [
                {
                  href: `/events/${featured.id}/auction/console`,
                  title: 'Auction console',
                  description: 'Open and close lots, reveal a bidder, void a bid, switch the screen.',
                },
              ]
            : []),
        ]
      : []),
  ];

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
        <EventHero event={featured} counts={counts} raised={raised} canOrganise={canOrganise} />
      ) : (
        <EmptyHero canCreate={canOrganise} />
      )}

      <Ledger className="mt-10">
        <LedgerFigure
          label="Events"
          value={upcoming.length}
          note="Open in your department"
          visual={<StatusLegend counts={statusCounts} />}
        />
        <LedgerFigure
          label="Acceptance"
          value={Math.round(acceptance)}
          unit="%"
          note={featured ? `${counts.accepted} of ${counts.invited} invited` : 'No event featured'}
          visual={<Arc percent={acceptance} />}
        />
        <LedgerFigure
          label="Arrivals"
          value={counts.checkedIn}
          unit={`/ ${counts.attendees}`}
          note={liveCount > 0 ? 'Doors open' : 'Doors not yet open'}
          visual={<SeatRow taken={counts.checkedIn} total={counts.attendees} />}
        />
        <LedgerFigure
          label="Contacts"
          value={contactCount ?? 0}
          note={`${newContacts ?? 0} added in the last 30 days`}
        />
      </Ledger>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
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
            <div className="border-hairline-strong rounded-xl border border-dashed p-8 text-center">
              <p className="text-ink-900 font-semibold">
                {featured ? 'Nothing else on the calendar' : 'No events yet'}
              </p>
              <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
                {canOrganise
                  ? 'Create the next one when it is ready. Drafts appear here too.'
                  : 'Nothing further has been published to your department.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {rest.map((event) => (
                <li key={event.id}>
                  <Ticket event={event} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading eyebrow="Tonight" title="The desk" />
          <Desk items={desk} />
        </section>
      </div>
    </StaffShell>
  );
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function featuredCounts(
  supabase: Client,
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

/** Total raised for the event's auction, or null when there is no auction. */
async function raisedFor(supabase: Client, eventId: string): Promise<number | null> {
  const { data: auction } = await supabase.from('auctions').select('id').eq('event_id', eventId).maybeSingle();
  if (!auction) return null;
  const { data } = await supabase
    .from('auction_totals')
    .select('total_raised')
    .eq('auction_id', auction.id)
    .maybeSingle();
  return Number(data?.total_raised ?? 0);
}

function daypart(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-ZA', { timeZone: TIME_ZONE, hour: 'numeric', hour12: false }).format(new Date()),
  );
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function EmptyHero({ canCreate }: { canCreate: boolean }) {
  return (
    <section className="shadow-hero relative overflow-hidden rounded-2xl p-10 text-white">
      <Atmosphere intensity={0.75} />
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

