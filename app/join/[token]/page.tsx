import { notFound } from 'next/navigation';
import { CalendarDays, MapPin } from 'lucide-react';
import { Atmosphere } from '@/components/brand/Atmosphere';
import { Logo } from '@/components/brand/Logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveJoinToken } from '@/lib/auth/join';
import { formatEventDate } from '@/lib/dates';
import { consentWording } from '@/lib/consent';
import { JoinForm } from './JoinForm';

export const metadata = {
  title: 'Register',
  // The token in the URL is the credential. It must not reach a search index,
  // and vercel.json strips the referrer on this path.
  robots: { index: false, follow: false },
};

/**
 * The page behind the QR on the table — docs/07 §2.3, DESIGN-SYSTEM §2.5.
 *
 * No session and no account: the `j.` token in the path is resolved against
 * the event row on every request, and the page reads through the admin client
 * only the columns the plan lists. Nothing here names another guest, a count,
 * an amount or a lot.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await resolveJoinToken(createAdminClient(), token);
  if (!event) notFound();

  const open = event.status === 'published' || event.status === 'live';

  return (
    <div className="relative min-h-dvh overflow-hidden text-white">
      <Atmosphere intensity={0.6} />

      <div className="relative z-10 mx-auto w-full max-w-[480px] px-4 pt-8 pb-16">
        <header className="reveal flex items-center justify-between gap-4">
          <span className="shadow-plate inline-flex rounded-xl bg-white p-2.5">
            <Logo variant="horizontal" size="sm" priority />
          </span>
          <p className="text-right text-[0.6875rem] font-bold tracking-[0.16em] text-white/60 uppercase">
            Institutional
            <br />
            Advancement
          </p>
        </header>

        <p
          className="eyebrow eyebrow-on-dark reveal mt-10 tracking-[0.18em]"
          style={{ '--reveal-delay': '0.1s' } as React.CSSProperties}
        >
          You are here
        </p>

        <h1
          className="font-display reveal mt-4 text-[clamp(2.5rem,9vw,3.5rem)] leading-[0.94] font-bold tracking-[-0.01em] text-balance"
          style={{ '--reveal-delay': '0.2s' } as React.CSSProperties}
        >
          {event.title}
        </h1>

        <dl
          className="reveal mt-6 space-y-2 text-[1.0625rem] text-white/75"
          style={{ '--reveal-delay': '0.3s' } as React.CSSProperties}
        >
          <div className="flex items-start gap-3">
            <CalendarDays className="text-gold-500 mt-1 size-[18px] shrink-0" aria-hidden />
            <dd>{formatEventDate(event.starts_at)}</dd>
          </div>
          {event.venue_name ? (
            <div className="flex items-start gap-3">
              <MapPin className="text-gold-500 mt-1 size-[18px] shrink-0" aria-hidden />
              <dd>{event.venue_name}</dd>
            </div>
          ) : null}
        </dl>

        <div className="reveal mt-8" style={{ '--reveal-delay': '0.4s' } as React.CSSProperties}>
          {open ? (
            <JoinForm
              token={token}
              consentWording={consentWording()}
              auctionEnabled={event.auction_enabled}
            />
          ) : (
            <div className="glass-panel rounded-3xl p-8 text-center">
              <p className="font-display text-[2rem] leading-tight font-semibold text-white">
                Registration for this event is closed.
              </p>
            </div>
          )}
        </div>

        <footer className="mt-16 border-t border-white/10 pt-6 text-center">
          <p className="font-display text-gold-500 text-base font-semibold tracking-wide">
            Thinking Beyond
          </p>
          <p className="mt-2 text-sm text-white/60">
            Central University of Technology, Free State · Institutional Advancement
          </p>
        </footer>
      </div>
    </div>
  );
}
