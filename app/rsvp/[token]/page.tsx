import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import { Atmosphere } from '@/components/brand/Atmosphere';
import { Logo } from '@/components/brand/Logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTokenOfKind } from '@/lib/auth/pass';
import { formatEventDate } from '@/lib/dates';
import { consentWording } from '@/lib/consent';
import { RsvpForm, type RsvpQuestion } from './RsvpForm';

export const metadata = {
  title: 'Your invitation',
  // The token in the URL is the credential. It must not reach a search index,
  // and vercel.json already strips the referrer on this path.
  robots: { index: false, follow: false },
};

const PILLARS = ['Fundraising', 'Development', 'Alumni Relations', 'Stewardship'];

/**
 * The invitation a guest opens — TASKS T2.4, DESIGN-SYSTEM §2.5.
 *
 * No session and no account: the signed `r.` token in the path is the whole
 * credential, so the page reads through the admin client and returns only what
 * BUILD-SPEC §7.3 lists. Nothing here exposes another guest, a figure, or the
 * size of the room.
 */
export default async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitationId = verifyTokenOfKind(token, 'r');
  if (!invitationId) notFound();

  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from('invitations')
    .select('id, event_id, status, contacts(first_name, last_name, email, phone_e164)')
    .eq('id', invitationId)
    .maybeSingle();

  if (!invitation || !invitation.contacts) notFound();

  const { data: event } = await admin
    .from('events')
    .select(
      'id, title, description, starts_at, ends_at, venue_name, venue_address, capacity, rsvp_deadline, allow_plus_ones, status, auction_enabled, banner_url',
    )
    .eq('id', invitation.event_id)
    .maybeSingle();

  if (!event) notFound();

  const [{ data: rsvp }, { data: questions }, { data: attendees }] = await Promise.all([
    admin
      .from('rsvps')
      .select('attending, guest_count, whatsapp_opt_in, answers')
      .eq('invitation_id', invitation.id)
      .maybeSingle(),
    admin
      .from('event_questions')
      .select('id, label, type, options, required')
      .eq('event_id', event.id)
      .order('sort_order', { ascending: true }),
    admin
      .from('attendees')
      .select('pass_token, is_plus_one')
      .eq('invitation_id', invitation.id)
      .eq('is_plus_one', false)
      .maybeSingle(),
  ]);

  const contact = invitation.contacts;
  const closed =
    (event.rsvp_deadline !== null && new Date(event.rsvp_deadline) < new Date()) ||
    event.status === 'closed' ||
    event.status === 'archived';

  return (
    <div className="relative min-h-dvh overflow-hidden text-white">
      <Atmosphere intensity={0.85} />

      <div className="relative z-10 mx-auto w-full max-w-[1100px] px-5 pt-8 pb-16 sm:px-8">
        <header className="reveal flex items-center justify-between gap-4">
          <span className="shadow-plate inline-flex rounded-xl bg-white p-2.5">
            <Logo variant="horizontal" size="sm" priority />
          </span>
          <p className="text-right text-[0.6875rem] font-bold tracking-[0.16em] text-white/50 uppercase">
            Institutional
            <br />
            Advancement
          </p>
        </header>

        <div className="grid items-start gap-10 pt-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-16">
          <div>
            <p
              className="eyebrow eyebrow-on-dark reveal tracking-[0.18em]"
              style={{ '--reveal-delay': '0.1s' } as React.CSSProperties}
            >
              An invitation for {contact.first_name}
            </p>

            <h1
              className="font-display reveal mt-6 text-[clamp(2.75rem,6vw,4.75rem)] leading-[0.94] font-bold tracking-[-0.01em] text-balance"
              style={{ '--reveal-delay': '0.2s' } as React.CSSProperties}
            >
              {event.title}
            </h1>

            <dl
              className="reveal mt-8 space-y-3 text-[1.0625rem] text-white/75"
              style={{ '--reveal-delay': '0.3s' } as React.CSSProperties}
            >
              <div className="flex items-start gap-3">
                <CalendarDays className="text-gold-500 mt-1 size-[18px] shrink-0" aria-hidden />
                <dd>{formatEventDate(event.starts_at)}</dd>
              </div>
              {event.venue_name ? (
                <div className="flex items-start gap-3">
                  <MapPin className="text-gold-500 mt-1 size-[18px] shrink-0" aria-hidden />
                  <dd>
                    {event.venue_name}
                    {event.venue_address ? (
                      <span className="block text-white/50">{event.venue_address}</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>

            {event.description ? (
              <p
                className="reveal mt-8 max-w-xl text-[1.0625rem] leading-relaxed text-white/65"
                style={{ '--reveal-delay': '0.4s' } as React.CSSProperties}
              >
                {event.description}
              </p>
            ) : null}

            {event.rsvp_deadline && !closed ? (
              <p
                className="reveal mt-8 text-sm text-white/45"
                style={{ '--reveal-delay': '0.45s' } as React.CSSProperties}
              >
                Please reply by {formatEventDate(event.rsvp_deadline)}.
              </p>
            ) : null}
          </div>

          <div className="reveal" style={{ '--reveal-delay': '0.5s' } as React.CSSProperties}>
            {closed ? (
              <div className="glass-panel rounded-3xl p-8 text-center">
                <p className="font-display text-[2rem] leading-tight font-semibold text-white">
                  Replies have closed.
                </p>
                <p className="mt-4 leading-relaxed text-white/70">
                  {rsvp?.attending
                    ? 'You are on the list. Your pass is below.'
                    : 'Please contact Institutional Advancement if your plans have changed.'}
                </p>
                {rsvp?.attending && attendees?.pass_token ? (
                  <Link
                    href={`/p/${attendees.pass_token}`}
                    className="bg-gold-500 text-cut-950 hover:bg-gold-600 mt-8 flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold transition-colors"
                  >
                    Open my pass
                  </Link>
                ) : null}
              </div>
            ) : (
              <RsvpForm
                token={token}
                firstName={contact.first_name}
                allowPlusOnes={event.allow_plus_ones}
                hasPhone={Boolean(contact.phone_e164)}
                consentWording={consentWording()}
                questions={(questions ?? []) as RsvpQuestion[]}
                existing={
                  rsvp
                    ? {
                        attending: rsvp.attending,
                        guestCount: rsvp.guest_count,
                        whatsappOptIn: rsvp.whatsapp_opt_in,
                        answers: (rsvp.answers ?? {}) as Record<string, string | string[]>,
                      }
                    : null
                }
                existingPassUrl={attendees?.pass_token ? `/p/${attendees.pass_token}` : null}
                icsHref={`/rsvp/${token}/event.ics`}
                auctionEnabled={event.auction_enabled}
              />
            )}
          </div>
        </div>

        <footer className="mt-20 border-t border-white/10 pt-8 text-center">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-white/45 uppercase">
            {PILLARS.map((pillar, i) => (
              <li key={pillar} className="inline-flex items-center gap-6">
                {i > 0 ? (
                  <span aria-hidden className="text-gold-500 text-[8px]">
                    ◆
                  </span>
                ) : null}
                {pillar}
              </li>
            ))}
          </ul>
          <p className="font-display text-gold-500 mt-6 text-base font-semibold tracking-wide">
            Thinking Beyond
          </p>
          <p className="mt-2 text-sm text-white/40">
            Central University of Technology, Free State · Bloemfontein +27 51 507 3911 · Welkom +27
            57 910 3500
          </p>
        </footer>
      </div>
    </div>
  );
}
