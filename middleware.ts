import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Two jobs, by path.
 *
 * On staff surfaces it refreshes the session cookie. Without that a Server
 * Component can read an expired token and bounce a signed-in user to /login
 * halfway through the evening. It does not enforce authorisation —
 * requireStaff() does that, per route, so the check lives next to the data it
 * protects.
 *
 * On attendee surfaces it mirrors the pass token into an httpOnly cookie and
 * returns before any Supabase client is built.
 */

/** A pass token's shape: `p.<22>.<22>`. The signature is verified downstream. */
const PASS_TOKEN = /^p\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{22}$/;

/** Ninety days. Long enough to cover an event and its settlement afterwards. */
const PASS_COOKIE_MAX_AGE = 90 * 24 * 60 * 60;

export async function middleware(request: NextRequest) {
  // Attendee surfaces: mirror the token from the path into an httpOnly cookie
  // so `/api/bid` and the sub-pages can read it without the token travelling in
  // a `Referer` header to an analytics script or an outbound link.
  //
  // BUILD-SPEC §5 puts this in the pass layout. Next 15 forbids writing a
  // cookie from a Server Component, so it happens here instead — and here is
  // cheaper anyway, because no Supabase call is involved. The value is taken
  // from the URL unverified: it is a convenience, never an authorisation, and
  // every consumer re-verifies the HMAC with `verifyTokenOfKind`.
  if (request.nextUrl.pathname.startsWith('/p/')) {
    const token = request.nextUrl.pathname.split('/')[2] ?? '';
    const response = NextResponse.next({ request });

    if (PASS_TOKEN.test(token) && request.cookies.get('cut_pass')?.value !== token) {
      response.cookies.set('cut_pass', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: PASS_COOKIE_MAX_AGE,
      });
    }

    return response;
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Staff surfaces, which need the session refreshed, plus /p, which needs no
     * session at all and returns before the Supabase client is built. /display
     * is left out entirely: it authenticates with the auction's display key and
     * must not pay for a round trip on every board it renders.
     */
    '/p/:path*',
    '/dashboard/:path*',
    '/contacts/:path*',
    '/events/:path*',
    '/settings/:path*',
    '/scan/:path*',
    '/login',
  ],
};
