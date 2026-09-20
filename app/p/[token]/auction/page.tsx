import { createAdminClient } from '@/lib/supabase/admin';
import { loadAttendeeAuction } from '@/lib/auction/attendee';
import { auctionState } from '@/lib/auction/state';
import { formatZAR } from '@/lib/money';
import { AuctionLive, LotGrid, type LotCard } from './AuctionLive';

/**
 * The lot grid — TASKS T3.3, BUILD-SPEC §7.3.
 *
 * Rendered on the server so the first paint carries the real board, then
 * handed to `AuctionLive`, which keeps it moving. The images and donor names
 * are static, so they are loaded once here rather than through every refetch.
 */
export default async function AuctionGridPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { attendee, auction } = await loadAttendeeAuction(token);

  const admin = createAdminClient();
  const [state, { data: lots }] = await Promise.all([
    auctionState(admin, auction.id, auction.incrementTable),
    admin
      .from('lots')
      .select('id, images, donor_name, sort_order, lot_number')
      .eq('auction_id', auction.id)
      .order('sort_order', { ascending: true })
      .order('lot_number', { ascending: true }),
  ]);

  const cards: LotCard[] = (lots ?? []).map((lot) => ({
    lotId: lot.id,
    image: lot.images[0] ?? null,
    donorName: lot.donor_name,
  }));

  // The catalogue's own order, which the organiser sets by dragging.
  const order = new Map((lots ?? []).map((lot, index) => [lot.id, index]));
  const ordered = {
    ...state,
    lots: [...state.lots].sort((a, b) => (order.get(a.lotId) ?? 0) - (order.get(b.lotId) ?? 0)),
    bidderNumber: attendee.bidderNumber,
  };

  const open = ordered.lots.filter((lot) => lot.status === 'open').length;

  return (
    <AuctionLive token={token} auctionId={auction.id} attendeeId={attendee.id} initial={ordered}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-[0.625rem] font-bold tracking-[0.16em] text-white/60 uppercase">
          {open} {open === 1 ? 'lot open' : 'lots open'}
        </p>
        <p className="text-xs text-white/60">
          Raised so far{' '}
          <span className="numeral text-gold-metallic text-base">
            {formatZAR(ordered.totalRaised)}
          </span>
        </p>
      </div>

      {ordered.lots.length === 0 ? (
        <p className="glass-panel rounded-2xl p-5 text-sm leading-relaxed text-white/70">
          The lots are still being set up. This page fills in as they open.
        </p>
      ) : (
        <LotGrid token={token} cards={cards} />
      )}
    </AuctionLive>
  );
}
