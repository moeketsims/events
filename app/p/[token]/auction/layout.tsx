import Link from 'next/link';
import { Atmosphere } from '@/components/brand/Atmosphere';
import { Logo } from '@/components/brand/Logo';
import { loadAttendeeAuction } from '@/lib/auction/attendee';
import { formatBidderNumber } from '@/lib/dates';
import { AuctionNav } from './AuctionNav';

export const metadata = {
  title: 'The auction',
  robots: { index: false, follow: false },
};

/**
 * The frame every bidding page sits in — TASKS T3.3, DESIGN-SYSTEM §5.2.
 *
 * The token is verified once here, and again in each page and route below it,
 * because a layout's work is not a guarantee for the routes it wraps. A guest
 * who has not been through the door gets the pages read-only with the banner:
 * the bidder number is assigned at check-in, so there is nothing to bid with.
 */
export default async function AuctionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { attendee, event, auction } = await loadAttendeeAuction(token);

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
              {auction.title}
            </p>
            {attendee.bidderNumber !== null ? (
              <p className="text-gold-500 text-sm font-bold tracking-[0.08em] uppercase">
                Bidder {formatBidderNumber(attendee.bidderNumber)}
              </p>
            ) : null}
          </div>
        </header>

        <p className="mt-2 text-xs text-white/60">{event.title}</p>

        {!attendee.checkedIn ? (
          <p className="glass-panel mt-5 rounded-2xl p-4 text-sm leading-relaxed text-white/75">
            <span className="mb-1 block font-semibold text-white">You can look, not yet bid</span>
            Bidding opens once you have checked in at the door. Your bidder number is handed out
            there.
          </p>
        ) : null}

        <div className="mt-5">{children}</div>
      </div>

      <AuctionNav token={token} />
    </div>
  );
}
