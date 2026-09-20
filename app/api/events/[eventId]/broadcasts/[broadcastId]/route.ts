import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffProfile, hasRole } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';

/**
 * Who a broadcast reached, per channel — TASKS T3.1, for the log's expandable
 * recipient list. Staff surface, so names are allowed; the session client
 * applies RLS, which gives `message_deliveries` to the organiser alone.
 */

export const runtime = 'nodejs';

const params = z.object({ eventId: z.uuid(), broadcastId: z.uuid() });

export type BroadcastRecipient = {
  id: string;
  name: string;
  channel: string;
  status: string;
  error: string | null;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string; broadcastId: string }> },
) {
  const profile = await getStaffProfile();
  if (!profile) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  if (!hasRole(profile, ['organiser'])) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = params.safeParse(await context.params);
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase
    .from('message_deliveries')
    .select('id, channel, status, error, recipient, attendees(display_name)')
    .eq('event_id', parsed.data.eventId)
    .eq('broadcast_id', parsed.data.broadcastId)
    .order('channel', { ascending: true })
    .order('created_at', { ascending: true });

  const recipients: BroadcastRecipient[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.attendees?.display_name ?? row.recipient,
    channel: row.channel,
    status: row.status,
    error: row.error,
  }));

  return NextResponse.json({ recipients }, { headers: { 'Cache-Control': 'no-store' } });
}
