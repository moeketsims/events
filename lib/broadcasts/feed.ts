import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';

/** One message on a guest's pass. Nothing else: no author, no audience, no id but the message's own. */
export type FeedItem = {
  id: string;
  body: string;
  sentAt: string;
};

export const FEED_LIMIT = 50;

/**
 * The broadcasts this attendee received — BUILD-SPEC §7.3.
 *
 * Read from the attendee's own `in_app` delivery rows joined to the message,
 * never from `broadcasts` by event: the delivery row is the record of who was
 * in the audience when the organiser pressed send. Used by the pass page for
 * first paint and by `/p/[token]/feed` for every refetch after it, so both
 * agree to the row.
 */
export async function feedFor(
  admin: ReturnType<typeof createAdminClient>,
  attendeeId: string,
): Promise<FeedItem[]> {
  const { data } = await admin
    .from('message_deliveries')
    .select('id, created_at, broadcasts(id, body, sent_at)')
    .eq('attendee_id', attendeeId)
    .eq('channel', 'in_app')
    .eq('kind', 'broadcast')
    .not('broadcast_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT);

  const items: FeedItem[] = [];
  for (const row of data ?? []) {
    const broadcast = row.broadcasts;
    if (!broadcast) continue;
    items.push({
      id: broadcast.id,
      body: broadcast.body,
      sentAt: broadcast.sent_at ?? row.created_at,
    });
  }
  return items;
}
