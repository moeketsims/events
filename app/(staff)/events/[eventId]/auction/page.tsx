import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Gavel, Plus } from 'lucide-react';
import { PageHeader, SectionHeading, StaffShell } from '@/components/staff/StaffShell';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { isBuilt } from '@/lib/features';
import { formatZAR, nextMinBid } from '@/lib/money';
import { AuctionSettingsForm } from './AuctionSettingsForm';
import { DisplayCard } from './DisplayCard';
import { EnableAuction } from './EnableAuction';
import { LotEditor } from './LotEditor';
import { LotList, type LotRow } from './LotList';
import { readIncrementTable } from './schema';

export const metadata = { title: 'Auction' };

/**
 * The auction editor — TASKS T3.2. Settings, the lot catalogue, and the
 * projection link. Organisers and auction operators, per BUILD-SPEC §4.5; the
 * session client's RLS decides the rest.
 */
export default async function AuctionPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const profile = await requireStaff(['organiser', 'auction_operator']);
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, title, status, auction_enabled')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) notFound();

  const { data: auction } = await supabase
    .from('auctions')
    .select('id, title, closes_at, soft_close_seconds, increment_table, display_key, display_mode')
    .eq('event_id', eventId)
    .maybeSingle();

  const back = (
    <Link
      href={`/events/${eventId}`}
      className="text-cut-700 hover:text-cut-900 mb-6 inline-flex items-center gap-2 text-sm font-semibold"
    >
      <ArrowLeft className="size-4" aria-hidden /> {event.title}
    </Link>
  );

  if (!auction || !event.auction_enabled) {
    return (
      <StaffShell profile={profile}>
        {back}
        <PageHeader
          title="Silent auction"
          breadcrumb="Not yet enabled"
          description="Enable the auction to set the increments, list the lots and get the projection link. Check-in starts assigning bidder numbers the moment it is on."
        />
        <div className="card p-8 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-md">
              <p className="eyebrow mb-2">One switch</p>
              <h2 className="text-cut-900 text-[1.75rem] leading-none font-semibold">
                Enable the silent auction
              </h2>
              <p className="text-ink-500 mt-3 text-sm leading-relaxed">
                Creates the auction with the standard increments and a two-minute soft close.
                Nothing is shown to guests until a lot is open.
              </p>
            </div>
            <EnableAuction eventId={eventId} />
          </div>
        </div>
      </StaffShell>
    );
  }

  const incrementTable = readIncrementTable(auction.increment_table);

  const [{ data: lots }, { data: states }, { data: totals }] = await Promise.all([
    supabase
      .from('lots')
      .select(
        'id, lot_number, title, description, donor_name, images, starting_bid, reserve, buy_now_price, status, closes_at, sort_order',
      )
      .eq('auction_id', auction.id)
      .order('sort_order', { ascending: true })
      .order('lot_number', { ascending: true }),
    supabase
      .from('lot_state')
      .select('lot_id, high_bid, high_bidder_number, bid_count')
      .eq('auction_id', auction.id),
    supabase
      .from('auction_totals')
      .select('total_raised, lots_with_bids')
      .eq('auction_id', auction.id)
      .maybeSingle(),
  ]);

  const stateByLot = new Map((states ?? []).map((row) => [row.lot_id, row]));
  const rows: LotRow[] = (lots ?? []).map((lot) => {
    const state = stateByLot.get(lot.id);
    const highBid =
      state?.high_bid === null || state?.high_bid === undefined ? null : Number(state.high_bid);
    return {
      ...lot,
      starting_bid: Number(lot.starting_bid),
      reserve: lot.reserve === null ? null : Number(lot.reserve),
      buy_now_price: lot.buy_now_price === null ? null : Number(lot.buy_now_price),
      high_bid: highBid,
      high_bidder_number: state?.high_bidder_number ?? null,
      bid_count: Number(state?.bid_count ?? 0),
      next_min: nextMinBid({ startingBid: Number(lot.starting_bid), highBid, incrementTable }),
    };
  });

  const open = rows.filter((lot) => lot.status === 'open').length;
  const raised = Number(totals?.total_raised ?? 0);
  const nextLotNumber = rows.reduce((max, lot) => Math.max(max, lot.lot_number), 0) + 1;

  return (
    <StaffShell profile={profile}>
      {back}

      <PageHeader
        title={auction.title}
        breadcrumb="Silent auction"
        description={
          rows.length === 0
            ? 'No lots yet. Add the first one below.'
            : `${rows.length} ${rows.length === 1 ? 'lot' : 'lots'}, ${open} open · ${formatZAR(raised)} on the board.`
        }
        action={
          isBuilt('console') ? (
            <Button asChild variant="outline" size="lg" className="h-11 px-5">
              <Link href={`/events/${eventId}/auction/console`}>
                <Gavel className="size-4" aria-hidden /> Open the console
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <SectionHeading
            eyebrow="The catalogue"
            title="Lots"
            action={
              <LotEditor
                eventId={eventId}
                auctionId={auction.id}
                nextLotNumber={nextLotNumber}
                defaultClosesAt={auction.closes_at}
                trigger={
                  <Button size="lg" className="h-11 px-5">
                    <Plus className="size-4" aria-hidden /> Add a lot
                  </Button>
                }
              />
            }
          />
          <LotList
            eventId={eventId}
            auctionId={auction.id}
            lots={rows}
            defaultClosesAt={auction.closes_at}
          />
        </section>

        <section className="space-y-10">
          <div>
            <SectionHeading eyebrow="On the night" title="The projection" />
            <div className="card p-5">
              <DisplayCard
                eventId={eventId}
                auctionId={auction.id}
                displayKey={auction.display_key}
              />
            </div>
          </div>

          <div>
            <SectionHeading eyebrow="Rules" title="Settings" />
            <div className="card p-5">
              <AuctionSettingsForm
                eventId={eventId}
                auction={{
                  id: auction.id,
                  title: auction.title,
                  closes_at: auction.closes_at,
                  soft_close_seconds: auction.soft_close_seconds,
                  increment_table: incrementTable,
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
