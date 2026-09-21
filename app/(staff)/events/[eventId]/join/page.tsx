import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import QRCode from 'qrcode';
import { SectionHeading, StaffShell } from '@/components/staff/StaffShell';
import { Ledger, LedgerFigure, SeatRow } from '@/components/staff/Ledger';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { joinUrl } from '@/lib/auth/join';
import { EnableControl, JoinControls } from './JoinControls';

export const metadata = { title: 'Self-registration QR' };

/**
 * The code that goes on the tables — docs/07 §2.5. Organiser only. Shows the
 * QR and the link, prints the sheet, and turns self-registration on and off.
 * The two figures are counts of people, never amounts.
 */
export default async function JoinPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const profile = await requireStaff(['organiser']);
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, title, status, join_token')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) notFound();

  const [selfRegistered, arrived] = await Promise.all([
    supabase
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .eq('is_walk_in', true)
      .is('checked_in_by', null)
      .not('checked_in_at', 'is', null),
    supabase
      .from('attendees')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .not('checked_in_at', 'is', null),
  ]);

  const url = event.join_token ? joinUrl(event.join_token) : null;
  const qrSvg = url
    ? await QRCode.toString(url, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        color: { dark: '#001738', light: '#FFFFFF' },
      })
    : null;

  const open = event.status === 'published' || event.status === 'live';

  return (
    <StaffShell profile={profile}>
      <div className="mb-6">
        <Link
          href={`/events/${event.id}`}
          className="text-cut-700 hover:text-cut-900 inline-flex items-center gap-2 text-sm font-semibold"
        >
          <ArrowLeft className="size-4" aria-hidden /> Event
        </Link>
      </div>

      <SectionHeading eyebrow={event.title} title="Self-registration QR" />

      {!url ? (
        <div className="card measure p-6">
          <p className="text-ink-700 leading-relaxed">
            Guests who scan this code register themselves, are checked in and, for an auction, get a
            bidder number. It only works while the event is published or live.
          </p>
          <div className="mt-6">
            <EnableControl eventId={event.id} />
          </div>
        </div>
      ) : (
        <div className="card grid gap-8 p-6 md:grid-cols-[auto_1fr] md:gap-10">
          <div>
            <div
              className="border-cut-900 w-[248px] rounded-lg border-4 bg-white p-1 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
              // The SVG comes from `qrcode`, built from our own URL.
              dangerouslySetInnerHTML={{ __html: qrSvg! }}
              role="img"
              aria-label="Self-registration QR code"
            />
            {!open ? (
              <p className="text-gold-600 mt-3 max-w-[248px] text-sm">
                The event is {event.status}. The code will work once it is published or live.
              </p>
            ) : null}
          </div>
          <JoinControls
            eventId={event.id}
            joinUrl={url}
            printHref={`/events/${event.id}/join/print`}
          />
        </div>
      )}

      <Ledger className="mt-10" columns={3}>
        <LedgerFigure
          label="Self-registered"
          value={selfRegistered.count ?? 0}
          note="Scanned the table code"
        />
        <LedgerFigure
          label="Tonight's arrivals"
          value={arrived.count ?? 0}
          note="Everyone checked in"
          visual={<SeatRow taken={arrived.count ?? 0} total={arrived.count ?? 0} />}
        />
      </Ledger>
    </StaffShell>
  );
}
