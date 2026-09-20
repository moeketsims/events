import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTokenOfKind } from '@/lib/auth/pass';
import { buildIcs, icsFilename } from '@/lib/ics';
import { APP_URL } from '@/lib/env';

/**
 * "Add to my calendar" — a .ics for the guest whose RSVP token this is.
 *
 * Token-authenticated like the page itself. It carries no personal data beyond
 * the event, but it is scoped to a valid invitation anyway: an open endpoint
 * that answers for any event id would let anyone enumerate the calendar.
 */
export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const invitationId = verifyTokenOfKind(token, 'r');
  if (!invitationId) return new Response('Not found', { status: 404 });

  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from('invitations')
    .select('id, event_id')
    .eq('id', invitationId)
    .maybeSingle();

  if (!invitation) return new Response('Not found', { status: 404 });

  const { data: event } = await admin
    .from('events')
    .select('id, title, description, starts_at, ends_at, venue_name, venue_address')
    .eq('id', invitation.event_id)
    .maybeSingle();

  if (!event) return new Response('Not found', { status: 404 });

  const ics = buildIcs({
    // Stable across downloads, so re-adding updates the entry rather than
    // creating a second one.
    uid: `event-${event.id}@cut-events`,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    location: [event.venue_name, event.venue_address].filter(Boolean).join(', ') || null,
    description: event.description,
    url: `${APP_URL}/rsvp/${token}`,
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${icsFilename(event.title)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
