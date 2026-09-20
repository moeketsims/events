import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTokenOfKind } from '@/lib/auth/pass';
import { buildIcs, icsFilename } from '@/lib/ics';
import { APP_URL } from '@/lib/env';

/**
 * "Add to my calendar" from the pass page. The same file as the RSVP route
 * serves, scoped to a valid pass token rather than an invitation token, and
 * pointing back at the pass so the entry carries the guest's own link.
 */
export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const attendeeId = verifyTokenOfKind(token, 'p');
  if (!attendeeId) return new Response('Not found', { status: 404 });

  const admin = createAdminClient();

  const { data: attendee } = await admin
    .from('attendees')
    .select('id, event_id, pass_token')
    .eq('id', attendeeId)
    .maybeSingle();

  if (!attendee || attendee.pass_token !== token) {
    return new Response('Not found', { status: 404 });
  }

  const { data: event } = await admin
    .from('events')
    .select('id, title, description, starts_at, ends_at, venue_name, venue_address')
    .eq('id', attendee.event_id)
    .maybeSingle();

  if (!event) return new Response('Not found', { status: 404 });

  const ics = buildIcs({
    uid: `event-${event.id}@cut-events`,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    location: [event.venue_name, event.venue_address].filter(Boolean).join(', ') || null,
    description: event.description,
    url: `${APP_URL}/p/${token}`,
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${icsFilename(event.title)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
