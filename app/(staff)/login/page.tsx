import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { getStaffProfile } from '@/lib/auth/staff';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const profile = await getStaffProfile();
  if (profile) redirect('/dashboard');

  const { next } = await searchParams;
  // Only same-origin paths, so ?next= cannot be used as an open redirect.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : undefined;

  return (
    <div className="bg-cut-50 flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo variant="vertical" size="sm" priority />
        </div>

        <div className="border-ink-300 rounded-lg border bg-white p-6">
          <h1 className="text-cut-900 mb-1 text-center text-3xl">CUT Events</h1>
          <p className="text-ink-500 mb-6 text-center text-sm">Staff sign in</p>

          <LoginForm next={safeNext} />
        </div>

        <p className="text-ink-500 mt-6 text-center text-sm">
          Guests do not sign in. Your invitation link is your RSVP and your pass link is your entry.
        </p>
      </div>
    </div>
  );
}
