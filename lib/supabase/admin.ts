import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';
import { SUPABASE_URL, serverEnv } from '@/lib/env';

/**
 * Service-role client. Bypasses RLS entirely, so it is confined to:
 *
 *  - attendee-facing pages and routes, which authenticate with a signed pass or
 *    RSVP token rather than a session and must return only the fields
 *    BUILD-SPEC §7.3 lists;
 *  - the projection route, authenticated by the auction's display key;
 *  - calls to place_bid, check_in_attendee and the other security-definer
 *    functions, which 0004 grants to service_role alone;
 *  - the seed script and provider webhooks.
 *
 * `server-only` makes an accidental import from a client component a build
 * error rather than a leaked key.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(SUPABASE_URL, serverEnv('SUPABASE_SECRET_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
