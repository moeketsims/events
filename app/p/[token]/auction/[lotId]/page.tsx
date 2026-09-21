import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { attendeeBidLotIds, loadAttendeeAuction } from '@/lib/auction/attendee';
import { auctionState } from '@/lib/auction/state';
import { formatBidderNumber, formatTime } from '@/lib/dates';
import { AuctionLive } from '../AuctionLive';
import { BidPanel } from './BidPanel';
import { LotDetail } from './LotDetail';

/**
 * One lot — TASKS T3.3, BUILD-SPEC §7.3.
 *
 * The last five bids are shown as bidder numbers and amounts. That is the
 * whole anonymity rule on this page: a guest may see that Bidder 017 is
 * winning, never who 017 is.
 */
export default async function LotPage({
  params,
}: {
  params: Promise<{ token: string; lotId: string }>;
}) {
  const { token, lotId } = await params;
  const { attendee, auction } = await loadAttendeeAuction(token);

  const admin = createAdminClient();

  const { data: lot } = await admin
    .from('lots')
    .select('id, auction_id, lot_number, title, description, donor_name, images')
    .eq('id', lotId)
    .maybeSingle();

  // A lot from another auction is not this guest's business.
  if (!lot || lot.auction_id !== auction.id) notFound();

  const [state, { data: bids }] = await Promise.all([
    auctionState(admin, auction.id, auction.incrementTable),
    admin
      .from('bids')
      .select('id, amount, placed_at, attendees(bidder_number)')
      .eq('lot_id', lotId)
      .is('voided_at', null)
      .order('placed_at', { ascending: false })
      .limit(5),
  ]);

  const bidLotIds = await attendeeBidLotIds(
    admin,
    attendee.id,
    state.lots.map((row) => row.lotId),
  );

  const recent = (bids ?? []).map((bid) => ({
    id: bid.id,
    amount: Number(bid.amount),
    at: formatTime(bid.placed_at),
    bidder: formatBidderNumber(bid.attendees?.bidder_number ?? null),
  }));

  return (
    <AuctionLive
      token={token}
      auctionId={auction.id}
      attendeeId={attendee.id}
      initial={{ ...state, bidderNumber: attendee.bidderNumber, bidLotIds }}
    >
      <Link
        href={`/p/${token}/auction`}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
      >
        <ArrowLeft className="size-4" aria-hidden /> All lots
      </Link>

      <LotDetail
        lotId={lot.id}
        lotNumber={lot.lot_number}
        title={lot.title}
        description={lot.description}
        donorName={lot.donor_name}
        images={lot.images}
        recent={recent}
      />

      <BidPanel
        token={token}
        lotId={lot.id}
        checkedIn={attendee.checkedIn}
        incrementTable={auction.incrementTable}
      />
    </AuctionLive>
  );
}
