import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, CalendarPlus, Check, Gavel, MapPin } from 'lucide-react';
import { Atmosphere } from '@/components/brand/Atmosphere';
import { Logo } from '@/components/brand/Logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTokenOfKind } from '@/lib/auth/pass';
import { isBuilt } from '@/lib/features';
import { passQrSvg, passUrl } from '@/lib/qr';
import { formatEventDate, formatTime, formatBidderNumber } from '@/lib/dates';

export const metadata = {
  title: 'Your pass',
  // The token in the URL is the credential; it must never reach an index.
  robots: { index: false, follow: false },
};

/**
 * The attendee's pass — TASKS T2.5, DESIGN-SYSTEM §5.2 on the cinematic layer
 * of §2.5 at reduced intensity.
 *
 * No session: the signed `p.` token in the path is the credential, read through
 * the admin client, returning only the fields BUILD-SPEC §7.3 lists. No other
 * guest, no figure, no lot, and no surname but the holder's own.
 *
 * The QR is inline SVG. An <img> would cost a request and a layout shift on a
 * phone in a foyer with one bar of signal, and this is the one thing on the
 * page that has to be on screen the instant it is asked for.
 */
export default async function PassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const attendeeId = verifyTokenOfKind(token, 'p');
  if (!attendeeId) notFound();

  const admin = createAdminClient();

  const { data: attendee } = await admin
    .from('attendees')
    .select('id, event_id, display_name, is_plus_one, bidder_number, checked_in_at, pass_token')
    .eq('id', attendeeId)
    .maybeSingle();

  // The token has to match the row as well as verify: a pass regenerated for a
  // guest revokes the old link, and the old link must stop working.
  if (!attendee || attendee.pass_token !== token) notFound();

  const { data: event } = await admin
    .from('events')
    .select('id, title, starts_at, ends_at, venue_name, venue_address, status, auction_enabled')
    .eq('id', attendee.event_id)
    .maybeSingle();

  if (!event) notFound();

  const qrSvg = await passQrSvg(token);
  const checkedIn = attendee.checked_in_at !== null;
  const firstName = attendee.display_name.split(' ')[0] ?? attendee.display_name;

  return (
    <div className="relative min-h-dvh overflow-hidden text-white">
      <Atmosphere intensity={0.6} />

      <div className="relative z-10 mx-auto w-full max-w-[480px] px-4 pt-6 pb-14">
        <header className="flex items-center justify-between gap-3">
          <span className="shadow-plate inline-flex rounded-xl bg-white p-2">
            <Logo variant="horizontal" size="sm" priority />
          </span>
          <p className="text-right text-[0.625rem] font-bold tracking-[0.14em] text-white/60 uppercase">
            Your pass
          </p>
        </header>

        {/* The pass itself. White, because a QR has to be read off a screen in a
            dim foyer, and because DESIGN-SYSTEM §5.2 frames it in CUT Blue. */}
        <section
          aria-labelledby="pass-name"
          className="mt-6 overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
        >
          <div className="px-5 pt-6 pb-5 text-center">
            <p className="label-caps text-cut-700 text-[0.625rem]">
              {attendee.is_plus_one ? 'Guest pass' : 'Admit one'}
            </p>
            <h1
              id="pass-name"
              className="font-display text-cut-900 mt-2 text-[1.75rem] leading-tight font-bold"
            >
              {attendee.display_name}
            </h1>

            <div
              className="border-cut-900 mx-auto mt-5 w-[248px] rounded-lg border-4 bg-white p-1.5 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
              // The SVG comes from `qrcode`, built from our own URL. Nothing a
              // guest or an organiser types reaches it.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              role="img"
              aria-label="Your entry pass QR code"
            />

            {/* The link in text as well, for a screen reader and for a phone
                whose camera will not open. DESIGN-SYSTEM §7. */}
            <p className="text-ink-500 mt-4 text-xs break-all">
              <a href={passUrl(token)} className="inline-block py-2.5 underline underline-offset-2">
                {passUrl(token)}
              </a>
            </p>

            {attendee.bidder_number !== null ? (
              <p className="bg-cut-900 text-gold-500 mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold tracking-[0.08em] uppercase">
                Bidder {formatBidderNumber(attendee.bidder_number)}
              </p>
            ) : null}
          </div>

          <div className="border-hairline bg-cut-50 border-t px-5 py-4 text-center">
            {checkedIn ? (
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-green-600">
                <Check className="size-4" aria-hidden /> Checked in at{' '}
                {formatTime(attendee.checked_in_at)}
              </p>
            ) : (
              <p className="text-ink-500 text-sm">Show this at the door to check in.</p>
            )}
          </div>
        </section>

        {/* The event */}
        <section className="glass-panel mt-5 rounded-2xl p-5">
          <p className="font-display text-[1.375rem] leading-tight font-semibold text-white">
            {event.title}
          </p>
          <dl className="mt-4 space-y-2.5 text-[0.9375rem] text-white/75">
            <div className="flex items-start gap-3">
              <CalendarDays className="text-gold-500 mt-0.5 size-4 shrink-0" aria-hidden />
              <dd>{formatEventDate(event.starts_at)}</dd>
            </div>
            {event.venue_name ? (
              <div className="flex items-start gap-3">
                <MapPin className="text-gold-500 mt-0.5 size-4 shrink-0" aria-hidden />
                <dd>
                  {event.venue_name}
                  {event.venue_address ? (
                    <span className="block text-white/60">{event.venue_address}</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>

          <a
            href={`/p/${token}/event.ics`}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-white/16"
          >
            <CalendarPlus className="size-4" aria-hidden /> Add to my calendar
          </a>
        </section>

        {/* Bidding */}
        {event.auction_enabled ? (
          <section className="mt-5">
            {checkedIn && !isBuilt('bidding') ? (
              <p className="glass-panel rounded-2xl p-5 text-center text-sm leading-relaxed text-white/70">
                <span className="mb-1 block font-semibold text-white">Silent auction tonight</span>
                You are checked in, {firstName}. Bidding opens from this pass when the lots are
                announced.
              </p>
            ) : checkedIn ? (
              <Link
                href={`/p/${token}/auction`}
                className="bg-gold-500 text-cut-950 hover:bg-gold-600 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold shadow-[0_10px_30px_-12px_rgba(251,185,39,0.8)] transition-colors"
              >
                <Gavel className="size-4" aria-hidden /> Open the auction
              </Link>
            ) : (
              <p className="glass-panel rounded-2xl p-5 text-center text-sm leading-relaxed text-white/70">
                <span className="mb-1 block font-semibold text-white">Silent auction tonight</span>
                Bidding opens once you have checked in at the door.
              </p>
            )}
          </section>
        ) : null}

        {/* The feed. Filled in T3.1; the section exists so the page does not
            change shape when the first broadcast lands. */}
        <section aria-labelledby="feed-heading" className="mt-8">
          <h2
            id="feed-heading"
            className="text-[0.625rem] font-bold tracking-[0.16em] text-white/60 uppercase"
          >
            From the organisers
          </h2>
          <p className="glass-panel mt-3 rounded-2xl p-5 text-sm leading-relaxed text-white/60">
            {checkedIn
              ? `Nothing yet, ${firstName}. Messages from the Advancement team appear here during the event.`
              : 'Messages from the Advancement team appear here once you have arrived.'}
          </p>
        </section>

        <footer className="mt-10 text-center">
          <p className="font-display text-gold-500 text-sm font-semibold tracking-wide">
            Thinking Beyond
          </p>
          <p className="mt-1.5 text-xs text-white/60">
            Central University of Technology, Free State
          </p>
        </footer>
      </div>
    </div>
  );
}
