import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader, SectionHeading, StaffShell } from '@/components/staff/StaffShell';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { channelReadiness } from '@/lib/messaging';
import { APP_URL } from '@/lib/env';
import { formatEventDate, formatTime } from '@/lib/dates';
import { Composer, type AudienceCounts } from './Composer';

export const metadata = { title: 'Invitations' };

const DELIVERY_TONE: Record<string, string> = {
  queued: 'text-ink-500',
  sent: 'text-ink-700',
  delivered: 'text-green-600',
  read: 'text-green-600',
  failed: 'text-red-700',
  bounced: 'text-red-700',
};

export default async function InvitationsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const profile = await requireStaff(['organiser']);
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, title, starts_at, venue_name, status')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) notFound();

  const { data: invitations } = await supabase
    .from('invitations')
    .select(
      'id, token, status, first_sent_at, contact_id, contacts(first_name, last_name, email, phone_e164, whatsapp_opt_in)',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  const rows = invitations ?? [];

  // What each choice would actually reach, so the button can promise a number
  // rather than a hope. A guest with no email is not an email recipient.
  const counts: AudienceCounts = {
    not_sent: tally(rows.filter((row) => row.first_sent_at === null)),
    pending: tally(rows.filter((row) => row.status === 'pending')),
    everyone: tally(rows),
  };

  const sample = rows.find((row) => row.contacts) ?? null;

  const { data: deliveries } = await supabase
    .from('message_deliveries')
    .select('id, channel, recipient, status, error, sent_at, updated_at, kind')
    .eq('event_id', eventId)
    .in('kind', ['invite', 'reminder'])
    .order('updated_at', { ascending: false })
    .limit(60);

  return (
    <StaffShell profile={profile}>
      <Link
        href={`/events/${eventId}`}
        className="text-cut-700 hover:text-cut-900 mb-6 inline-flex items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" aria-hidden /> {event.title}
      </Link>

      <PageHeader
        title="Invitations"
        breadcrumb="Send"
        description={
          rows.length === 0
            ? 'There is nobody on the guest list yet.'
            : `${rows.length} on the guest list, ${rows.filter((r) => r.first_sent_at).length} already sent to.`
        }
      />

      {rows.length === 0 ? (
        <div className="border-hairline-strong rounded-xl border border-dashed p-12 text-center">
          <p className="text-ink-900 font-semibold">Build the guest list first</p>
          <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
            Invitations go to the people on the list, each with their own RSVP link.
          </p>
          <Link
            href={`/events/${eventId}/guests`}
            className="text-cut-700 mt-4 inline-block text-sm font-semibold underline"
          >
            Go to the guest list
          </Link>
        </div>
      ) : (
        <>
          {event.status === 'draft' ? (
            <p className="border-hairline bg-gold-500/10 text-gold-600 mb-8 rounded-lg border px-4 py-3 text-sm">
              This event is still a draft. Publish it on the overview before inviting anyone.
            </p>
          ) : null}

          <Composer
            event={{
              id: event.id,
              title: event.title,
              startsAt: formatEventDate(event.starts_at),
              venue: event.venue_name ?? '',
              sample: sample?.contacts
                ? {
                    firstName: sample.contacts.first_name,
                    lastName: sample.contacts.last_name,
                    rsvpUrl: `${APP_URL}/rsvp/${sample.token}`,
                  }
                : null,
            }}
            counts={counts}
            readiness={channelReadiness()}
          />

          <section className="mt-16">
            <SectionHeading eyebrow="Delivery" title="What has gone out" />

            {(deliveries ?? []).length === 0 ? (
              <div className="border-hairline-strong rounded-xl border border-dashed p-10 text-center">
                <p className="text-ink-900 font-semibold">Nothing sent yet</p>
                <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
                  Every message this platform sends is logged here, per guest and per channel.
                </p>
              </div>
            ) : (
              <div className="card table-card overflow-hidden">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Recipient</th>
                      <th scope="col">Channel</th>
                      <th scope="col">Status</th>
                      <th scope="col">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(deliveries ?? []).map((delivery) => (
                      <tr key={delivery.id}>
                        <td className="text-ink-900">{delivery.recipient}</td>
                        <td className="text-ink-700">{delivery.channel}</td>
                        <td>
                          <span
                            className={`font-semibold ${DELIVERY_TONE[delivery.status] ?? 'text-ink-700'}`}
                          >
                            {delivery.status}
                          </span>
                          {delivery.error ? (
                            <span className="text-ink-500 block text-xs">
                              {delivery.error === 'not_configured'
                                ? 'provider not configured'
                                : delivery.error}
                            </span>
                          ) : null}
                        </td>
                        <td className="text-ink-500 text-xs">
                          {formatTime(delivery.sent_at ?? delivery.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </StaffShell>
  );
}

type Row = {
  contacts: { email: string | null; phone_e164: string | null; whatsapp_opt_in: boolean } | null;
};

function tally(rows: Row[]) {
  return {
    guests: rows.length,
    email: rows.filter((row) => row.contacts?.email).length,
    whatsapp: rows.filter((row) => row.contacts?.phone_e164 && row.contacts.whatsapp_opt_in).length,
  };
}
