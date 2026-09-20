'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/db/types';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Browser client, publishable key. Two jobs only: staff sessions, and realtime
 * subscriptions on the public channels in BUILD-SPEC §4.6.
 *
 * It is never used to read attendee data. Attendee pages are rendered on the
 * server with the admin client and return only the fields §7.3 lists, because
 * RLS gives `anon` nothing — by design, see 0005_rls.sql.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
