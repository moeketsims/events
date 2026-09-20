import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Completes a magic link.
 *
 * Supabase's own `/auth/v1/verify` URL returns the session in the URL fragment,
 * which a server component can never see — following one of those links lands
 * the visitor back on /login with no session and no explanation. The supported
 * server-side path is to take the `token_hash` from
 * `auth.admin.generateLink()` and exchange it here, which is what the seed
 * script and the staff invitation form both build their links against.
 *
 *   /auth/confirm?token_hash=…&type=magiclink&next=/dashboard
 *
 * Staff normally sign in with the six-digit code on /login. This route exists
 * for the printed links the seed produces, which are the way in before custom
 * SMTP is configured (BUILD-SPEC §4.9).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');

  // Same-origin paths only, so the link cannot be used as an open redirect.
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  if (!tokenHash || !type) {
    redirect('/login?error=link_incomplete');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error('magic link exchange failed', error.message);
    redirect('/login?error=link_expired');
  }

  redirect(destination);
}
