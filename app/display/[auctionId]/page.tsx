import { cookies } from 'next/headers';
import { Logo } from '@/components/brand/Logo';
import { Board, type BoardLot } from '@/components/display/Board';
import { createAdminClient } from '@/lib/supabase/admin';
import { auctionState } from '@/lib/auction/state';
import { readIncrementTable } from '@/app/(staff)/events/[eventId]/auction/schema';
import {
  DISPLAY_COOKIE,
  authoriseDisplay,
  presentedDisplayKey,
  recentBids,
} from '@/lib/auction/display';

export const metadata = { title: 'Projection' };

/**
 * The projection — BUILD-SPEC §7.4, DESIGN-SYSTEM §5.4, docs/06 T4.1.
 *
 * Authenticated by the auction's display key, from `?k=` or the cookie the
 * middleware set from it, compared in constant time through the admin client.
 * Without either it shows a quiet navy page asking for the link, not a 404.
 * The first paint carries the real board; `Board` keeps it moving.
 */
export default async function DisplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ auctionId: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { auctionId } = await params;
  const { k } = await searchParams;
  const key = presentedDisplayKey(auctionId, k, (await cookies()).get(DISPLAY_COOKIE)?.value);

  const admin = createAdminClient();
  const auction = await authoriseDisplay(admin, auctionId, key);

  if (!auction) return <NeedsLink />;

  const [state, ticker, { data: lots }, { data: event }] = await Promise.all([
    auctionState(admin, auction.id, readIncrementTable(auction.increment_table)),
    recentBids(admin, auction.id, 8),
    admin
      .from('lots')
      .select('id, images, donor_name, sort_order, lot_number')
      .eq('auction_id', auction.id)
      .order('sort_order', { ascending: true })
      .order('lot_number', { ascending: true }),
    admin.from('events').select('title').eq('id', auction.event_id).maybeSingle(),
  ]);

  const cards: BoardLot[] = (lots ?? []).map((lot) => ({
    lotId: lot.id,
    image: lot.images[0] ?? null,
    donorName: lot.donor_name,
  }));

  return (
    <Board
      auctionId={auction.id}
      title={auction.title}
      eventTitle={event?.title ?? ''}
      cards={cards}
      initial={{
        ...state,
        mode: auction.display_mode,
        spotlightLotId: auction.spotlight_lot_id,
        recentBids: ticker,
      }}
    />
  );
}

function NeedsLink() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <span className="shadow-plate inline-flex rounded-2xl bg-white p-4">
        <Logo variant="vertical" size="md" priority />
      </span>
      <p className="font-display mt-10 text-[clamp(2rem,4vw,3.5rem)] leading-none font-bold">
        This screen needs its display link.
      </p>
      <p className="mt-4 max-w-xl text-[clamp(1rem,1.6vw,1.375rem)] text-white/70">
        Open the projection from the auction page in the console. The link carries the key; a reload
        keeps it for the evening.
      </p>
    </div>
  );
}
