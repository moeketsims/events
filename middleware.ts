import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Refreshes the staff session cookie on every matched request. Without this a
 * Server Component can read an expired token and bounce a signed-in user to
 * /login halfway through the evening.
 *
 * It does not enforce authorisation — requireStaff() does that, per route, so
 * the check lives next to the data it protects.
 */
export async function middleware(request: NextRequest) {
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
     * Staff surfaces only. Attendee pages carry their own signed token and have
     * no session to refresh, and running this on /p or /display would add a
     * round trip to the auth server on every bid the projection renders.
     */
    '/dashboard/:path*',
    '/contacts/:path*',
    '/events/:path*',
    '/settings/:path*',
    '/scan/:path*',
    '/login',
  ],
};
