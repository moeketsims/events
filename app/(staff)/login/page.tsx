import { redirect } from 'next/navigation';
import { BrandPanel } from '@/components/brand/BrandPanel';
import { getStaffProfile } from '@/lib/auth/staff';
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const profile = await getStaffProfile();
  if (profile) redirect('/dashboard');

  const { next, error } = await searchParams;
  // Only same-origin paths, so ?next= cannot be used as an open redirect.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : undefined;
  // Looked up rather than rendered, so the URL cannot inject arbitrary text.
  const linkError = error ? LINK_ERRORS[error] : undefined;

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel
        eyebrow="CUT Events"
        headline={
          <>
            Every CUT event.
            <br />
            One <span className="text-gold-500">platform</span>.
          </>
        }
        copy="Invitations and RSVP, QR passes at the door, live broadcasts to the room, and silent auctions on the screen. Built for Institutional Advancement and every department."
        points={[
          'Send invitations by email and WhatsApp, track every reply.',
          'Replace the paper register with a scan at the door.',
          'Reach only the people who have actually arrived.',
          'Run the auction on phones and project it live, without names.',
        ]}
        className="min-h-[38vh] lg:min-h-dvh"
      />

      <div className="animate-fade-up flex items-center justify-center px-6 py-14 sm:px-12">
        <div className="w-full max-w-sm">
          <p className="eyebrow">Staff sign in</p>
          <h2 className="text-cut-900 mt-3 text-[2.25rem] leading-none font-bold">Welcome back</h2>
          <p className="text-ink-500 mt-3 text-[0.9375rem]">
            Use your CUT email address. We send a six-digit code; there is no password.
          </p>

          {linkError ? (
            <p role="alert" className="mt-6 rounded-lg bg-red-700/8 p-3 text-sm text-red-700">
              {linkError}
            </p>
          ) : null}

          <div className="mt-8">
            <LoginForm next={safeNext} />
          </div>

          <p className="text-ink-500 border-hairline mt-10 border-t pt-6 text-sm">
            Guests never sign in. Your invitation link is your RSVP and your pass link is your entry.
          </p>
        </div>
      </div>
    </div>
  );
}
