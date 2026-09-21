import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DISPLAY_COOKIE,
  authoriseDisplay,
  lotBids,
  presentedDisplayKey,
} from '@/lib/auction/display';

/**
 * The last five bids on one lot, for the spotlight — docs/06 T4.1. Numbers
 * only, never a name. The lot must belong to the auction the key opens.
 */

export const runtime = 'nodejs';

const params = z.object({ auctionId: z.uuid(), lotId: z.uuid() });

export async function GET(
  request: Request,
  context: { params: Promise<{ auctionId: string; lotId: string }> },
) {
  const parsed = params.safeParse(await context.params);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { auctionId, lotId } = parsed.data;

  const key = presentedDisplayKey(
    auctionId,
    new URL(request.url).searchParams.get('k'),
    (await cookies()).get(DISPLAY_COOKIE)?.value,
  );

  const admin = createAdminClient();
  const auction = await authoriseDisplay(admin, auctionId, key);
  if (!auction) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data: lot } = await admin
    .from('lots')
    .select('id')
    .eq('id', lotId)
    .eq('auction_id', auction.id)
    .maybeSingle();
  if (!lot) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json(
    { lotId, bids: await lotBids(admin, lotId, 5) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
