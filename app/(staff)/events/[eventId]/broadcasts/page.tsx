import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader, SectionHeading, StaffShell } from '@/components/staff/StaffShell';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { channelReadiness } from '@/lib/messaging';
import { audienceLabel, type Audience } from './audience';
import { Composer, type AudienceCounts } from './Composer';
import { BroadcastLog, type LogEntry } from './BroadcastLog';

export const metadata = { title: 'Broadcasts' };

/**
 * The broadcast desk — TASKS T3.1. Reach the room, and see what reached it.
 *
 * Organiser-only, per BUILD-SPEC §4.5: `broadcasts` and `message_deliveries`
 * have no policy for any other role, and a desk whose send button always fails
 * for an operator would read as a bug.
 */
export default async function BroadcastsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const profile = await requireStaff(['organiser']);
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, title, status')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) notFound();

  const { data: attendees } = await supabase
    .from('attendees')
    .select('id, contact_id, checked_in_at, contacts(phone_e164, whatsapp_opt_in)')
    .eq('event_id', eventId);

  const rows = attendees ?? [];
  const counts: AudienceCounts = {
    checked_in: tally(rows.filter((row) => row.checked_in_at !== null)),
    all_accepted: tally(rows),
    not_arrived: tally(rows.filter((row) => row.checked_in_at === null)),
  };

  const { data: broadcasts } = await supabase
    .from('broadcasts')
    .select('id, body, audience, channels, sent_at, created_at, profiles(full_name)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(100);

  const sent = broadcasts ?? [];
  const ids = sent.map((row) => row.id);

  const { data: deliveries } = ids.length
    ? await supabase
        .from('message_deliveries')
        .select('broadcast_id, channel, status')
        .in('broadcast_id', ids)
    : { data: [] };

  const entries: LogEntry[] = sent.map((row) => {
    const own = (deliveries ?? []).filter((d) => d.broadcast_id === row.id);
    const count = (channel: string, ok: boolean) =>
      own.filter((d) => d.channel === channel && (d.status === 'failed') !== ok).length;
    const segment =
      row.audience && typeof row.audience === 'object' && 'segment' in row.audience
        ? (row.audience as { segment?: unknown }).segment
        : null;
    return {
      id: row.id,
      body: row.body,
      sentAt: row.sent_at ?? row.created_at,
      audience: audienceLabel(segment),
      author: row.profiles?.full_name ?? null,
      inApp: { sent: count('in_app', true), failed: count('in_app', false) },
      whatsapp: row.channels.includes('whatsapp')
        ? { sent: count('whatsapp', true), failed: count('whatsapp', false) }
        : null,
    };
  });

  const inRoom = counts.checked_in.guests;

  return (
    <StaffShell profile={profile}>
      <Link
        href={`/events/${eventId}`}
        className="text-cut-700 hover:text-cut-900 mb-6 inline-flex items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" aria-hidden /> {event.title}
      </Link>

      <PageHeader
        title="Broadcasts"
        breadcrumb="The room"
        description={
          inRoom === 0
            ? `${counts.all_accepted.guests} guests hold a pass. Nobody has arrived yet.`
            : `${inRoom} ${inRoom === 1 ? 'guest is' : 'guests are'} in the room, ${counts.not_arrived.guests} still to arrive.`
        }
      />

      {event.status === 'draft' ? (
        <p className="border-hairline bg-gold-500/10 text-gold-600 mb-8 rounded-lg border px-4 py-3 text-sm">
          This event is still a draft. Publish it on the overview before broadcasting.
        </p>
      ) : null}

      <div className="card p-6 sm:p-8">
        <Composer eventId={event.id} counts={counts} readiness={channelReadiness()} />
      </div>

      <section className="mt-16">
        <SectionHeading eyebrow="Sent" title="What the room has heard" />
        <BroadcastLog eventId={event.id} entries={entries} />
      </section>
    </StaffShell>
  );
}

type Row = {
  contact_id: string | null;
  contacts: { phone_e164: string | null; whatsapp_opt_in: boolean } | null;
};

/** Guests in the segment, and how many distinct households WhatsApp can reach. */
function tally(rows: Row[]): AudienceCounts[Audience] {
  const households = new Set<string>();
  for (const row of rows) {
    if (row.contact_id && row.contacts?.phone_e164 && row.contacts.whatsapp_opt_in) {
      households.add(row.contact_id);
    }
  }
  return { guests: rows.length, whatsapp: households.size };
}
