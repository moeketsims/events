import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock, MapPin, Users } from 'lucide-react';
import { SectionHeading, StaffShell, StatusPill } from '@/components/staff/StaffShell';
import { Arc, Ledger, LedgerFigure, SeatRow } from '@/components/staff/Ledger';
import { Desk } from '@/components/staff/Desk';
import { EventHero } from '@/components/staff/EventHero';
import { hasRole, requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { formatEventDate } from '@/lib/dates';
import type { Database } from '@/lib/db/types';
import { BannerUpload, EditEventDialog, StatusControls } from './EventForms';
import { STATUS_MEANING } from './status';

export const metadata = { title: 'Event' };

export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const profile = await requireStaff();
  const supabase = await createClient();

  // RLS restricts this to the signed-in user's department, so a wrong id and
  // another department's id are the same thing here: not found.
  const { data: event } = await supabase
    .from('events')
    .select(
      'id, title, description, starts_at, ends_at, rsvp_deadline, venue_name, venue_address, capacity, allow_plus_ones, auction_enabled, status, banner_url',
    )
    .eq('id', eventId)
    .maybeSingle();

  if (!event) notFound();

  const counts = await funnel(supabase, event.id);
  const raised = event.auction_enabled ? await raisedFor(supabase, event.id) : null;

  const acceptance = counts.invited ? (counts.accepted / counts.invited) * 100 : 0;
  const canOrganise = hasRole(profile, ['organiser']);

  // Door staff may read the event but none of the organiser pages, so they get
  // the one thing they are here to do. StaffShell's rule holds everywhere: a
  // link that ends in a 403 is worse than no link.
  const desk = !canOrganise
    ? [
        {
          href: '/scan',
          title: 'Open the scanner',
          description: 'Scan passes, search by name, register a walk-in.',
        },
      ]
    : [
        {
          href: `/events/${event.id}/guests`,
          title: 'Guest list',
          description: 'Add contacts to the event and watch the replies come in.',
        },
        {
          href: `/events/${event.id}/invitations`,
          title: 'Invitations',
          description: 'Compose, preview and send by email and WhatsApp.',
        },
        {
          href: `/events/${event.id}/attendance`,
          title: 'Attendance register',
          description: 'The live list of who has arrived, and the export.',
        },
        {
          href: `/events/${event.id}/broadcasts`,
          title: 'Broadcast desk',
          description: 'Reach everyone who has arrived, in-app and on WhatsApp.',
        },
        ...(event.auction_enabled
          ? [
              {
                href: `/events/${event.id}/auction`,
                title: 'Auction and lots',
                description: 'Settings, the lot catalogue and the projection link.',
              },
              {
                href: `/events/${event.id}/auction/console`,
                title: 'Auction console',
                description: 'Open and close lots, reveal a bidder, void a bid.',
              },
            ]
          : []),
        {
          href: `/events/${event.id}/results`,
          title: 'Results and settlement',
          description: 'Winners, amounts, what has been paid.',
        },
      ];

  return (
    <StaffShell profile={profile}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/events"
          className="text-cut-700 hover:text-cut-900 inline-flex items-center gap-2 text-sm font-semibold"
        >
          <ArrowLeft className="size-4" aria-hidden /> All events
        </Link>
        {canOrganise ? <EditEventDialog event={event} /> : null}
      </div>

      <EventHero
        event={event}
        counts={counts}
        raised={raised}
        canOrganise={canOrganise}
        showOverviewLink={false}
      />

      <Ledger className="mt-10 lg:grid-cols-5">
        <LedgerFigure label="Invited" value={counts.invited} note="On the guest list" />
        <LedgerFigure
          label="Accepted"
          value={counts.accepted}
          note={
            counts.invited ? `${Math.round(acceptance)}% of those invited` : 'Nobody invited yet'
          }
          visual={<Arc percent={acceptance} />}
        />
        <LedgerFigure label="Declined" value={counts.declined} note="Sent regrets" />
        <LedgerFigure
          label="No reply"
          value={counts.pending}
          note={
            event.rsvp_deadline
              ? `Until ${formatEventDate(event.rsvp_deadline)}`
              : 'No deadline set'
          }
        />
        <LedgerFigure
          label="Arrived"
          value={counts.checkedIn}
          unit={`/ ${counts.attendees}`}
          note={counts.waitlisted > 0 ? `${counts.waitlisted} waitlisted` : 'Seats expected'}
          visual={<SeatRow taken={counts.checkedIn} total={counts.attendees} />}
        />
      </Ledger>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeading
            eyebrow={canOrganise ? 'Where next' : 'At the door'}
            title={canOrganise ? 'Run the event' : 'Your part tonight'}
          />
          <Desk items={desk} />
        </section>

        <section>
          <SectionHeading eyebrow="The event" title="Details" />

          <div className="card p-5">
            <dl className="space-y-4 text-sm">
              <Detail icon={<CalendarClock className="size-4" aria-hidden />} label="Starts">
                {formatEventDate(event.starts_at)}
                {event.ends_at ? (
                  <span className="text-ink-500 block">until {formatEventDate(event.ends_at)}</span>
                ) : null}
              </Detail>

              <Detail icon={<MapPin className="size-4" aria-hidden />} label="Venue">
                {event.venue_name ?? 'Not set'}
                {event.venue_address ? (
                  <span className="text-ink-500 block">{event.venue_address}</span>
                ) : null}
              </Detail>

              <Detail icon={<Users className="size-4" aria-hidden />} label="Capacity">
                {event.capacity ? `${event.capacity} seats` : 'No limit'}
                <span className="text-ink-500 block">
                  {event.allow_plus_ones ? 'Plus-ones allowed' : 'No plus-ones'}
                  {event.auction_enabled ? ' · Silent auction' : ''}
                </span>
              </Detail>
            </dl>

            {event.description ? (
              <p className="border-hairline text-ink-700 measure mt-5 border-t pt-5 text-sm leading-relaxed">
                {event.description}
              </p>
            ) : null}
          </div>

          <div className="card mt-6 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="label-caps text-ink-500">Status</p>
              <StatusPill status={event.status} />
            </div>
            {canOrganise ? (
              <StatusControls event={event} />
            ) : (
              <p className="text-ink-500 text-sm">{STATUS_MEANING[event.status]}</p>
            )}
          </div>

          <div className="card mt-6 overflow-hidden">
            {event.banner_url ? (
              <div className="bg-cut-100 relative aspect-[16/6]">
                <Image
                  src={event.banner_url}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 420px"
                  className="object-cover"
                />
              </div>
            ) : null}
            <div className="p-5">
              <p className="label-caps text-ink-500 mb-3">Banner</p>
              {canOrganise ? (
                <BannerUpload eventId={event.id} />
              ) : (
                <p className="text-ink-500 text-sm">
                  {event.banner_url ? 'Set by an organiser.' : 'No banner yet.'}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </StaffShell>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-cut-700 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <dt className="label-caps text-ink-500 text-[0.625rem]">{label}</dt>
        <dd className="text-ink-900 mt-0.5 font-medium">{children}</dd>
      </div>
    </div>
  );
}

type Client = Awaited<ReturnType<typeof createClient>>;

type Funnel = {
  invited: number;
  accepted: number;
  declined: number;
  pending: number;
  waitlisted: number;
  attendees: number;
  checkedIn: number;
};

async function funnel(supabase: Client, eventId: string): Promise<Funnel> {
  type InvitationStatus = Database['public']['Enums']['invitation_status'];

  const invitationCount = (status?: InvitationStatus) => {
    let q = supabase
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    if (status) q = q.eq('status', status);
    return q;
  };

  const [invited, accepted, declined, pending, waitlisted, attendees, checkedIn] =
    await Promise.all([
      invitationCount(),
      invitationCount('accepted'),
      invitationCount('declined'),
      invitationCount('pending'),
      invitationCount('waitlisted'),
      supabase
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId),
      supabase
        .from('attendees')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .not('checked_in_at', 'is', null),
    ]);

  return {
    invited: invited.count ?? 0,
    accepted: accepted.count ?? 0,
    declined: declined.count ?? 0,
    pending: pending.count ?? 0,
    waitlisted: waitlisted.count ?? 0,
    attendees: attendees.count ?? 0,
    checkedIn: checkedIn.count ?? 0,
  };
}

/** Sum of the leading bid on every lot of this event's auction. */
async function raisedFor(supabase: Client, eventId: string): Promise<number | null> {
  const { data: auction } = await supabase
    .from('auctions')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!auction) return null;

  const { data } = await supabase
    .from('auction_totals')
    .select('total_raised')
    .eq('auction_id', auction.id)
    .maybeSingle();

  return Number(data?.total_raised ?? 0);
}
