import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Atmosphere } from '@/components/brand/Atmosphere';
import { Logo } from '@/components/brand/Logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadAttendeeAuction } from '@/lib/auction/attendee';
import { auctionState } from '@/lib/auction/state';
import { formatBidderNumber, formatTime } from '@/lib/dates';
import { formatZAR } from '@/lib/money';
import { AuctionNav } from '../auction/AuctionNav';

export const metadata = {
  title: 'My bids',
  robots: { index: false, follow: false },
};

/**
 * What this guest has bid — TASKS T3.3, BUILD-SPEC §7.3.
 *
 * Grouped by lot, newest first, with the board's verdict on each: leading,
 * outbid, won, or withdrawn by the desk. A voided bid is struck through rather
 * than hidden, because a bid that disappeared without explanation is the kind
 * of thing a guest asks the Advancement office about a week later.
 */
export default async function MyBidsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;
  const { attendee, auction } = await loadAttendeeAuction(token);

  const admin = createAdminClient();

  const [state, { data: bids }, { data: settlements }] = await Promise.all([
    auctionState(admin, auction.id, auction.incrementTable),
    admin
      .from('bids')
      .select('id, lot_id, amount, placed_at, voided_at, void_reason, is_proxy')
      .eq('attendee_id', attendee.id)
      .order('placed_at', { ascending: false }),
    admin
      .from('settlements')
      .select('id, lot_id, amount, status, checkout_url, paid_at')
      .eq('attendee_id', attendee.id),
  ]);

  const byLot = new Map(state.lots.map((lot) => [lot.lotId, lot]));
  const settlementByLot = new Map((settlements ?? []).map((row) => [row.lot_id, row]));

  // One group per lot this guest has touched, ordered by their latest bid.
  const groups = new Map<
    string,
    { lotId: string; bids: NonNullable<typeof bids>; latest: string }
  >();
  for (const bid of bids ?? []) {
    const group = groups.get(bid.lot_id);
    if (group) group.bids.push(bid);
    else groups.set(bid.lot_id, { lotId: bid.lot_id, bids: [bid], latest: bid.placed_at });
  }

  const ordered = [...groups.values()].sort((a, b) => b.latest.localeCompare(a.latest));

  return (
    <div className="relative min-h-dvh overflow-hidden text-white">
      <Atmosphere intensity={0.6} />

      <div className="relative z-10 mx-auto w-full max-w-[480px] px-4 pt-6 pb-28">
        <header className="flex items-center justify-between gap-3">
          <Link
            href={`/p/${token}`}
            aria-label="Your pass"
            className="shadow-plate inline-flex rounded-xl bg-white p-2"
          >
            <Logo variant="horizontal" size="sm" priority />
          </Link>
          <div className="text-right">
            <p className="text-[0.625rem] font-bold tracking-[0.14em] text-white/60 uppercase">
              My bids
            </p>
            {attendee.bidderNumber !== null ? (
              <p className="text-gold-500 text-sm font-bold tracking-[0.08em] uppercase">
                Bidder {formatBidderNumber(attendee.bidderNumber)}
              </p>
            ) : null}
          </div>
        </header>

        <Link
          href={`/p/${token}/auction`}
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden /> All lots
        </Link>

        {paid === '1' ? (
          <p className="bg-gold-500/15 text-gold-500 mt-4 rounded-2xl p-4 text-center text-sm font-semibold">
            Thank you. Your payment is being confirmed and will show here in a moment.
          </p>
        ) : null}

        {ordered.length === 0 ? (
          <p className="glass-panel mt-5 rounded-2xl p-5 text-sm leading-relaxed text-white/70">
            You have not bid on anything yet. Open the lots and place your first bid.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {ordered.map((group) => {
              const lot = byLot.get(group.lotId);
              const settlement = settlementByLot.get(group.lotId);
              const live = group.bids.filter((bid) => bid.voided_at === null);
              const mine =
                live.length > 0 ? Math.max(...live.map((bid) => Number(bid.amount))) : null;
              const leading =
                lot?.highBidderNumber !== null &&
                lot?.highBidderNumber === attendee.bidderNumber &&
                mine !== null;
              const won = settlement !== undefined;

              return (
                <li key={group.lotId} className="glass-panel rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.625rem] font-bold tracking-[0.14em] text-white/60 uppercase">
                        Lot {String(lot?.lotNumber ?? 0).padStart(2, '0')}
                      </p>
                      <Link
                        href={`/p/${token}/auction/${group.lotId}`}
                        className="font-display block text-[1.125rem] leading-tight font-semibold text-white underline-offset-4 hover:underline"
                      >
                        {lot?.title ?? 'A lot'}
                      </Link>
                    </div>
                    <Verdict won={won} leading={leading} closed={lot?.status !== 'open'} />
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[0.625rem] font-bold tracking-[0.14em] text-white/60 uppercase">
                        Your highest
                      </p>
                      <p className="numeral text-[1.5rem] text-white">{formatZAR(mine)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[0.625rem] font-bold tracking-[0.14em] text-white/60 uppercase">
                        On the board
                      </p>
                      <p className="numeral text-gold-metallic text-[1.5rem]">
                        {formatZAR(lot?.highBid ?? lot?.startingBid ?? 0)}
                      </p>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-4">
                    {group.bids.map((bid) => (
                      <li
                        key={bid.id}
                        className="flex items-baseline justify-between gap-3 text-sm text-white/75"
                      >
                        <span className={bid.voided_at ? 'text-white/50 line-through' : ''}>
                          {formatZAR(Number(bid.amount))}
                          {bid.is_proxy ? ' · placed at the desk' : ''}
                        </span>
                        <span className="text-white/60 tabular-nums">
                          {formatTime(bid.placed_at)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {group.bids.some((bid) => bid.voided_at) ? (
                    <p className="mt-2 text-xs text-white/60">
                      A struck-through bid was withdrawn by the auction desk.
                    </p>
                  ) : null}

                  {won ? (
                    <PayNow
                      amount={Number(settlement!.amount)}
                      status={settlement!.status}
                      checkoutUrl={settlement!.checkout_url}
                      paidAt={settlement!.paid_at}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AuctionNav token={token} />
    </div>
  );
}

function Verdict({ won, leading, closed }: { won: boolean; leading: boolean; closed: boolean }) {
  if (won) {
    return (
      <span className="bg-gold-500 text-cut-950 shrink-0 rounded-full px-2.5 py-1 text-[0.625rem] font-bold tracking-[0.12em] uppercase">
        Won
      </span>
    );
  }
  if (leading) {
    return (
      <span className="bg-gold-500 text-cut-950 shrink-0 rounded-full px-2.5 py-1 text-[0.625rem] font-bold tracking-[0.12em] uppercase">
        Leading
      </span>
    );
  }
  return <span className={cnBadge(closed)}>{closed ? 'Not won' : 'Outbid'}</span>;
}

function cnBadge(closed: boolean): string {
  return closed
    ? 'shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[0.625rem] font-bold tracking-[0.12em] text-white/70 uppercase'
    : 'shrink-0 rounded-full bg-red-700 px-2.5 py-1 text-[0.625rem] font-bold tracking-[0.12em] text-white uppercase';
}

function PayNow({
  amount,
  status,
  checkoutUrl,
  paidAt,
}: {
  amount: number;
  status: string;
  checkoutUrl: string | null;
  paidAt: string | null;
}) {
  if (status === 'paid') {
    return (
      <p className="mt-4 rounded-xl bg-green-600/20 p-3 text-center text-sm font-semibold text-white">
        Paid{paidAt ? ` at ${formatTime(paidAt)}` : ''}. Thank you.
      </p>
    );
  }

  if (!checkoutUrl) {
    return (
      <p className="mt-4 rounded-xl bg-white/10 p-3 text-center text-sm text-white/75">
        {formatZAR(amount)} to pay. The payment link is on its way from the Advancement desk.
      </p>
    );
  }

  return (
    <a
      href={checkoutUrl}
      className="bg-gold-500 text-cut-950 hover:bg-gold-600 mt-4 flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold transition-colors"
    >
      Pay {formatZAR(amount)}
    </a>
  );
}
