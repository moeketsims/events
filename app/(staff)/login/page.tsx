import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Atmosphere } from '@/components/brand/Atmosphere';
import { LiveStrip } from '@/components/brand/LiveStrip';
import { Logo } from '@/components/brand/Logo';
import { Marquee } from '@/components/brand/Marquee';
import { getStaffProfile } from '@/lib/auth/staff';
import { getShowcase } from '@/lib/public/showcase';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in' };

/**
 * Why a magic link can fail, in words a member of staff can act on.
 * /auth/confirm redirects here with one of these when the exchange fails.
 */
const LINK_ERRORS: Record<string, string> = {
  link_expired:
    'That sign-in link has already been used or has expired. Links work once. Ask for a code below instead.',
  link_incomplete:
    'That sign-in link was incomplete — it may have been cut short by an email client. Ask for a code below instead.',
};

const PILLARS = [
  'Invitations by email and WhatsApp',
  'QR passes at the door',
  'Broadcasts to the room',
  'Silent auctions on the screen',
  'Winners paid before they leave',
];

/**
 * The sign-in page is a single screen: `h-dvh` with the hero row as the only
 * flexible region, and type that scales with viewport height as well as width
 * (the `vh` term in each clamp). Nothing below the fold on any laptop from
 * 1366×768 up; on phones the columns stack and the page scrolls as normal.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const profile = await getStaffProfile();
  if (profile) redirect('/dashboard');

  const [{ next, error }, showcase] = await Promise.all([searchParams, getShowcase()]);
  // Only same-origin paths, so ?next= cannot be used as an open redirect.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : undefined;
  // Looked up rather than rendered, so the URL cannot inject arbitrary text.
  const linkError = error ? LINK_ERRORS[error] : undefined;

  return (
    <div className="relative min-h-dvh text-white lg:h-dvh lg:overflow-hidden">
      <Atmosphere />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1400px] flex-col px-6 sm:px-10 lg:h-dvh lg:px-14">
        {/* Top bar */}
        <header className="reveal flex shrink-0 items-center justify-between gap-6 pt-5">
          <Link href="/" className="shadow-plate inline-flex rounded-xl bg-white p-2">
            <Logo variant="horizontal" size="sm" priority />
          </Link>
          <p className="hidden text-[0.6875rem] font-bold tracking-[0.18em] text-white/55 uppercase sm:block">
            Institutional Advancement · Central University of Technology
          </p>
        </header>

        {/* Hero + form: the one flexible row */}
        <div className="grid flex-1 items-center gap-10 py-10 lg:min-h-0 lg:grid-cols-[1.35fr_1fr] lg:gap-14 lg:py-6">
          <section className="min-w-0">
            <p
              className="eyebrow eyebrow-on-dark reveal tracking-[0.18em]"
              style={{ '--reveal-delay': '0.1s' } as React.CSSProperties}
            >
              Events and fundraising, one platform
            </p>
            <h1
              className="font-display reveal mt-4 text-[clamp(2.75rem,min(5.4vw,10.5vh),6.25rem)] leading-[0.92] font-bold tracking-[-0.01em] text-balance"
              style={{ '--reveal-delay': '0.2s' } as React.CSSProperties}
            >
              Where CUT gathers.
              <br />
              <span className="text-gold-metallic">Where CUT gives.</span>
            </h1>
            <p
              className="reveal mt-5 max-w-xl text-[clamp(1rem,1.9vh,1.2rem)] leading-relaxed text-white/70 [@media(max-height:720px)]:hidden"
              style={{ '--reveal-delay': '0.32s' } as React.CSSProperties}
            >
              Invitations, arrivals, live moments and auctions for every event of the university,
              and the generosity that follows them. Built for Institutional Advancement and for
              every department that hosts.
            </p>

            <div className="reveal mt-7" style={{ '--reveal-delay': '0.45s' } as React.CSSProperties}>
              <LiveStrip data={showcase} compact />
            </div>
          </section>

          <section
            className="reveal glass-panel rounded-3xl p-6 sm:p-8"
            style={{ '--reveal-delay': '0.35s' } as React.CSSProperties}
            aria-labelledby="signin-title"
          >
            <p className="eyebrow eyebrow-on-dark">Staff sign in</p>
            <h2 id="signin-title" className="font-display mt-3 text-[2.125rem] leading-none font-bold">
              Welcome back
            </h2>
            <p className="mt-2 text-[0.9375rem] text-white/60">
              Your CUT email address is your key. We send a code; there is no password.
            </p>

            {linkError ? (
              <p role="alert" className="mt-5 rounded-lg border border-red-700/40 bg-red-700/15 p-3 text-sm text-red-100">
                {linkError}
              </p>
            ) : null}

            <div className="mt-6">
              <LoginForm next={safeNext} />
            </div>

            <div className="hairline-gold mt-6" />
            <p className="mt-4 text-sm text-white/50">
              Guests never sign in. Your invitation link is your RSVP and your pass link is your
              entry.
            </p>
          </section>
        </div>

        {/* Foot ticker */}
        <footer className="reveal shrink-0 pb-5" style={{ '--reveal-delay': '0.6s' } as React.CSSProperties}>
          <div className="hairline-gold mb-4" />
          <div className="flex items-center justify-between gap-6">
            <Marquee speed={48} className="min-w-0 flex-1">
              {PILLARS.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-4 text-[0.75rem] font-semibold tracking-[0.14em] text-white/55 uppercase whitespace-nowrap"
                >
                  <span className="text-gold-500 text-[9px]">◆</span>
                  {p}
                </span>
              ))}
            </Marquee>
            <span className="font-display text-gold-500 shrink-0 text-lg font-semibold tracking-wide">
              Thinking Beyond
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
