import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
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
    <div className="bg-cut-50 flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo variant="vertical" size="sm" priority />
        </div>

        <div className="border-ink-300 rounded-lg border bg-white p-6">
          <h1 className="text-cut-900 mb-1 text-center text-3xl">CUT Events</h1>
          <p className="text-ink-500 mb-6 text-center text-sm">Staff sign in</p>

          {linkError ? (
            <p role="alert" className="mb-4 rounded-md bg-red-700/10 p-3 text-sm text-red-700">
              {linkError}
            </p>
          ) : null}

          <LoginForm next={safeNext} />
        </div>

        <p className="text-ink-500 mt-6 text-center text-sm">
          Guests do not sign in. Your invitation link is your RSVP and your pass link is your entry.
        </p>
      </div>
    </div>
  );
}
