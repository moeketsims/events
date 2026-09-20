import { NextResponse } from 'next/server';
import { verifyTokenOfKind } from '@/lib/auth/pass';
import { createAdminClient } from '@/lib/supabase/admin';
import { feedFor } from '@/lib/broadcasts/feed';

/**
 * The attendee's broadcast feed — BUILD-SPEC §7.3.
 *
 * Token-authenticated like the pass page itself: the signature is verified,
 * then the token must still match the attendee row, so a reissued pass revokes
 * the old link here too. Returns `id, body, sentAt` and nothing else. Never
 * cached: a guest asking again is asking because something changed.
 */

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const attendeeId = verifyTokenOfKind(token, 'p');
  if (!attendeeId) return NextResponse.json({ error: 'invalid' }, { status: 404 });

  const admin = createAdminClient();

  const { data: attendee } = await admin
    .from('attendees')
    .select('id, pass_token')
    .eq('id', attendeeId)
    .maybeSingle();

  if (!attendee || attendee.pass_token !== token) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 });
  }

  const items = await feedFor(admin, attendee.id);

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
}
