'use client';

import { useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';
import { auctionTerms, AUCTION_TERMS_VERSION } from '@/lib/consent';
import { formatBidderNumber } from '@/lib/dates';
import { bidStep, formatZAR, nextMinBid, type IncrementRow } from '@/lib/money';
import type { BidResponse } from '@/app/api/bid/route';
import { messageStale } from '@/lib/auction/outbid';
import { useLive } from '../AuctionLive';
import { cn } from '@/lib/utils';

/**
 * The bid button — TASKS T3.3, DESIGN-SYSTEM §5.2.
 *
 * One 56 px button carrying the amount it will place, because a guest holding
 * a phone in a dim room should not have to work out what to type. "Enter a
 * different amount" reveals an input that enforces the same increment the
 * database will, and the server re-validates anyway: `place_bid` is the
 * authority and this is a courtesy.
 *
 * Every `result` the contract names has its own sentence. "Too low" in
 * particular says what the minimum is *now*, because by the time a rejection
 * comes back someone else has usually moved the board.
 *
 * A sentence is true of one high bid. Each carries the high bid it was said
 * about, and the moment the board moves past it the sentence goes and the
 * derived state (leading, outbid) speaks instead: "You are leading" must not
 * outlive the lead.
 */
export function BidPanel({
  token,
  lotId,
  checkedIn,
  incrementTable,
}: {
  token: string;
  lotId: string;
  checkedIn: boolean;
  incrementTable: IncrementRow[];
}) {
  const { lots, bidderNumber, outbid, refresh } = useLive();
  const lot = lots.find((row) => row.lotId === lotId);

  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    tone: 'ok' | 'warn' | 'error';
    text: string;
    /** The lot's high bid this sentence was true of. */
    atHighBid: number | null;
  } | null>(null);
  const [terms, setTerms] = useState<{ amount: number } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const leading = lot?.highBidderNumber !== null && lot?.highBidderNumber === bidderNumber;
  const lostThisLot = outbid.has(lotId) && !leading;
  const proposed = lot?.nextMin ?? 0;

  // The proposed amount moves with the board; the custom field follows it until
  // the guest types something of their own.
  useEffect(() => {
    if (!custom) setAmount('');
  }, [custom]);

  // The board moved past what the message was about: drop it. An error about
  // the network is not about the board and stays until the next attempt.
  const highBid = lot?.highBid ?? null;
  useEffect(() => {
    setMessage((current) => (messageStale(current, highBid) ? null : current));
  }, [highBid]);

  if (!lot) return null;

  const closed = lot.status !== 'open';

  async function place(value: number, acceptTerms = false) {
    if (pending) return;
    if (Date.now() < cooldownUntil) {
      say('warn', 'One moment — that is a lot of bids in a few seconds.');
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotId, amount: value, token, acceptTerms }),
      });
      const data = (await response.json()) as BidResponse;
      apply(data, value);
    } catch {
      say('error', 'That did not reach us. Check your signal and try again.');
    } finally {
      setPending(false);
    }
  }

  /** A sentence about the board as it stands, unless `at` says otherwise. */
  function say(tone: 'ok' | 'warn' | 'error', text: string, at: number | null = highBid) {
    setMessage({ tone, text, atHighBid: at });
  }

  function apply(data: BidResponse, attempted: number) {
    switch (data.result) {
      case 'ok': {
        setTerms(null);
        setCustom(false);
        setAmount('');
        const placed = data.highBid ?? attempted;
        say('ok', `You are leading at ${formatZAR(placed)}.`, placed);
        refresh();
        break;
      }
      case 'terms_required':
        setTerms({ amount: attempted });
        break;
      case 'too_low':
        // True of the high bid the server saw, which the refetch brings here;
        // it stays until someone moves the board again.
        say(
          'warn',
          `The minimum is ${formatZAR(data.nextMin)} now — someone got there first.`,
          data.highBid,
        );
        refresh();
        break;
      case 'lot_closed':
        say('warn', 'Bidding on this lot has closed.');
        refresh();
        break;
      case 'not_checked_in':
        say('warn', 'Bidding opens once you have checked in at the door.');
        break;
      case 'not_an_attendee':
        say('error', 'This pass is for a different event.');
        break;
      case 'no_contact':
        say('error', 'This pass is not linked to a guest record. Ask at the desk.');
        break;
      case 'rate_limited':
        setCooldownUntil(Date.now() + 10_000);
        say('warn', 'One moment — that is a lot of bids in a few seconds.');
        break;
      default:
        say('error', 'That bid could not be placed. Try again.');
    }
  }

  const typed = Number(amount);
  const typedValid = Number.isFinite(typed) && typed >= proposed && isOnStep(typed);

  function isOnStep(value: number): boolean {
    if (lot!.highBid === null) return value >= lot!.startingBid;
    const step = bidStep(incrementTable, lot!.highBid);
    const over =
      value - nextMinBid({ startingBid: lot!.startingBid, highBid: lot!.highBid, incrementTable });
    return over >= 0 && Math.abs(over % step) < 1e-9;
  }

  if (!checkedIn) {
    return (
      <p className="glass-panel mt-6 rounded-2xl p-5 text-center text-sm leading-relaxed text-white/75">
        <span className="mb-1 block font-semibold text-white">Bidding opens at the door</span>
        Show your pass to be checked in, and your bidder number comes with it.
      </p>
    );
  }

  if (closed) {
    return (
      <div className="glass-panel mt-6 rounded-2xl p-5 text-center">
        <p className="font-semibold text-white">
          {lot.status === 'closed' && lot.highBidderNumber !== null && lot.reserveMet
            ? `Sold to Bidder ${formatBidderNumber(lot.highBidderNumber)} · ${formatZAR(lot.highBid)}`
            : lot.status === 'upcoming'
              ? 'This lot has not opened yet'
              : 'Not sold'}
        </p>
        {leading && lot.status === 'closed' && lot.reserveMet ? (
          <p className="text-gold-500 mt-1 text-sm font-semibold">That is you. Congratulations.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6">
      {message ? (
        <p
          role="status"
          className={cn(
            'mb-3 rounded-xl p-3 text-center text-sm',
            message.tone === 'ok' && 'bg-gold-500/15 text-gold-500 font-semibold',
            message.tone === 'warn' && 'bg-white/10 text-white',
            message.tone === 'error' && 'bg-red-700/25 text-white',
          )}
        >
          {message.text}
        </p>
      ) : leading ? (
        <p className="text-gold-500 mb-3 text-center text-sm font-semibold">
          You are leading at {formatZAR(lot.highBid)}.
        </p>
      ) : lostThisLot ? (
        // The grid card carries a badge; on the lot itself the guest is looking
        // at one lot and deserves the sentence.
        <p className="mb-3 rounded-xl bg-red-700/25 p-3 text-center text-sm font-semibold text-white">
          You have been outbid. {formatZAR(lot.nextMin)} takes the lead.
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => place(custom && typedValid ? typed : proposed)}
        className="bg-cut-900 hover:bg-cut-700 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white ring-1 ring-white/15 transition-colors disabled:opacity-60"
      >
        <Gavel className="size-4" aria-hidden />
        {pending ? 'Placing…' : `Bid ${formatZAR(custom && typedValid ? typed : proposed)}`}
      </button>

      {custom ? (
        <div className="mt-3">
          <label htmlFor="bid-amount" className="mb-1.5 block text-xs text-white/60">
            Your amount, {formatZAR(proposed)} or more, in steps of{' '}
            {formatZAR(bidStep(incrementTable, lot.highBid ?? lot.startingBid))}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-white/60">
              R
            </span>
            <input
              id="bid-amount"
              type="number"
              inputMode="numeric"
              min={proposed}
              step={bidStep(incrementTable, lot.highBid ?? lot.startingBid)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(proposed)}
              className="input-dark h-12 w-full rounded-xl pl-7 text-base"
            />
          </div>
          {amount && !typedValid ? (
            <p className="text-gold-500 mt-1.5 text-xs">
              {typed < proposed
                ? `The minimum is ${formatZAR(proposed)}.`
                : 'Bids rise in whole increments from the minimum.'}
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCustom(true)}
          className="mt-3 flex h-11 w-full items-center justify-center text-sm font-semibold text-white/70 underline underline-offset-4 hover:text-white"
        >
          Enter a different amount
        </button>
      )}

      {terms ? (
        <TermsDialog
          amount={terms.amount}
          pending={pending}
          onCancel={() => setTerms(null)}
          onAgree={() => place(terms.amount, true)}
        />
      ) : null}
    </div>
  );
}

function TermsDialog({
  amount,
  pending,
  onCancel,
  onAgree,
}: {
  amount: number;
  pending: boolean;
  onCancel: () => void;
  onAgree: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <div className="glass-panel w-full max-w-[420px] rounded-2xl p-5">
        <h2 id="terms-title" className="font-display text-[1.25rem] font-semibold text-white">
          Before your first bid
        </h2>
        <p className="mt-3 max-h-56 overflow-y-auto text-sm leading-relaxed text-white/75">
          {auctionTerms()}
        </p>
        <p className="mt-2 text-[0.6875rem] text-white/60">
          Auction terms {AUCTION_TERMS_VERSION}. Recorded with your agreement.
        </p>

        <button
          type="button"
          onClick={onAgree}
          disabled={pending}
          className="bg-gold-500 text-cut-950 hover:bg-gold-600 mt-5 flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold transition-colors disabled:opacity-60"
        >
          {pending ? 'Placing…' : `I agree and place my bid of ${formatZAR(amount)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 flex h-11 w-full items-center justify-center text-sm font-semibold text-white/70 hover:text-white"
        >
          Not yet
        </button>
      </div>
    </div>
  );
}
