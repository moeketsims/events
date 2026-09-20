import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import { PageHeader, SectionHeading, StaffShell } from '@/components/staff/StaffShell';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { AddGuestsDialog } from './GuestForms';
import { GuestList, type GuestRow } from './GuestList';

export const metadata = { title: 'Guest list' };

/**
 * Everyone in the department not yet on the list is sent to the picker, capped.
 * A POC department has tens of contacts; at production scale the picker
 * searches server-side and this becomes a `not exists` view.
 */
const PICKER_LIMIT = 500;

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
}

export default async function GuestsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const profile = await requireStaff(['organiser']);
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, title, status, capacity')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) notFound();

  // The guest list, with the contact behind each invitation and the channels
  // each one has been sent through.
  const { data: invitations } = await supabase
    .from('invitations')
    .select(
      'id, status, sent_via, first_sent_at, opened_at, responded_at, contact_id, contacts(first_name, last_name, email, phone_e164, organisation)',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  const invited = invitations ?? [];
  const invitedContactIds = invited.map((row) => row.contact_id);

  const rows: GuestRow[] = invited.map((row) => {
    const contact = row.contacts;
    return {
      id: row.id,
      status: row.status,
      sent_via: row.sent_via,
      first_sent_at: row.first_sent_at,
      opened_at: row.opened_at,
      responded_at: row.responded_at,
      name: contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown contact',
      initials: contact ? initials(contact.first_name, contact.last_name) : '?',
      detail: contact?.email ?? contact?.phone_e164 ?? null,
      organisation: contact?.organisation ?? null,
    };
  });

  // The picker offers contacts who are not already on this list.
  let pickerQuery = supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone_e164, organisation, tags', {
      count: 'exact',
    })
    .order('last_name', { ascending: true })
    .limit(PICKER_LIMIT);

  if (invitedContactIds.length > 0) {
    pickerQuery = pickerQuery.not('id', 'in', `(${invitedContactIds.join(',')})`);
  }

  const { data: pickable, count: pickableCount } = await pickerQuery;

  const counts = invited.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const picker = (variant: 'default' | 'outline') => (
    <AddGuestsDialog
      eventId={eventId}
      contacts={pickable ?? []}
      totalAvailable={pickableCount ?? (pickable ?? []).length}
      variant={variant}
    />
  );

  return (
    <StaffShell profile={profile}>
      <Link
        href={`/events/${eventId}`}
        className="text-cut-700 hover:text-cut-900 mb-6 inline-flex items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" aria-hidden /> {event.title}
      </Link>

      <PageHeader
        title="Guest list"
        breadcrumb="Invitations"
        description={
          invited.length === 0
            ? 'Nobody is on the list yet. Add contacts and each gets an invitation with a personal RSVP link.'
            : `${invited.length} on the list: ${counts.accepted ?? 0} accepted, ${counts.declined ?? 0} declined, ${counts.pending ?? 0} yet to reply.`
        }
        action={
          invited.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {picker('outline')}
              <Button asChild size="lg" className="h-11 px-5">
                <Link href={`/events/${eventId}/invitations`}>
                  <Send className="size-4" aria-hidden /> Send invitations
                </Link>
              </Button>
            </div>
          ) : (
            picker('default')
          )
        }
      />

      {event.capacity && (counts.accepted ?? 0) >= event.capacity ? (
        <p className="border-hairline bg-gold-500/10 text-gold-600 mb-8 rounded-lg border px-4 py-3 text-sm">
          The event is at capacity ({event.capacity}). Further acceptances go on the waiting list.
        </p>
      ) : null}

      {invited.length === 0 ? (
        <div className="border-hairline-strong rounded-xl border border-dashed p-12 text-center">
          <p className="font-display text-cut-900 text-2xl font-semibold">An empty room, for now</p>
          <p className="text-ink-500 mx-auto mt-2 max-w-md text-[0.9375rem] leading-relaxed">
            Adding a contact creates their invitation and their personal RSVP link. Nothing is sent
            until you send it, so build the list first and send when it is ready.
          </p>
          <div className="mt-6 flex justify-center">{picker('default')}</div>
        </div>
      ) : (
        <section>
          <SectionHeading eyebrow="On the list" title="The room so far" />
          <GuestList eventId={eventId} rows={rows} />
        </section>
      )}
    </StaffShell>
  );
}
