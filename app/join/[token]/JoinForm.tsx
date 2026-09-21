'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { formatBidderNumber } from '@/lib/dates';
import { joinEvent, type JoinState } from './actions';

export type JoinFormProps = {
  token: string;
  consentWording: string;
  auctionEnabled: boolean;
};

/**
 * The form a guest fills at the table — docs/07 §2.3, on the cinematic layer
 * of DESIGN-SYSTEM §2.5. Three things to type and one box to tick; the pass
 * link and the bidder number come back on this same panel.
 */
export function JoinForm(props: JoinFormProps) {
  const [state, action] = useActionState<JoinState, FormData>(joinEvent, {});

  if (state.result) {
    return <Outcome result={state.result} auctionEnabled={props.auctionEnabled} />;
  }

  return (
    <form action={action} className="glass-panel relative rounded-3xl p-6 sm:p-8">
      <input type="hidden" name="token" value={props.token} />

      <div className="space-y-5">
        <Field id="firstName" label="First name" autoComplete="given-name" />
        <Field id="lastName" label="Surname" autoComplete="family-name" />
        <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email" />
      </div>

      <div className="mt-8 border-t border-white/10 pt-6">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-white/70">
          <input
            type="checkbox"
            name="consent"
            required
            className="accent-gold-500 mt-1 size-4 shrink-0"
          />
          <span>
            <span className="block font-semibold text-white">I agree</span>
            {props.consentWording}
          </span>
        </label>
      </div>

      {/* Honeypot: never shown to a person. A bot that fills it is thanked and ignored. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error ? (
        <p role="alert" className="mt-6 rounded-lg bg-red-700/25 px-4 py-3 text-sm text-white">
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}

function Field({
  id,
  label,
  type = 'text',
  autoComplete,
  inputMode,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'email' | 'text';
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/60 uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        maxLength={id === 'email' ? 254 : 80}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="input-dark mt-2 h-12 w-full rounded-lg px-3 text-base"
      />
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-gold-500 text-cut-950 hover:bg-gold-600 mt-8 h-12 w-full rounded-xl text-base font-semibold shadow-[0_10px_30px_-12px_rgba(251,185,39,0.8)] transition-colors disabled:opacity-60"
    >
      {pending ? 'One moment…' : 'Register and get my pass'}
    </button>
  );
}

function Outcome({
  result,
  auctionEnabled,
}: {
  result: NonNullable<JoinState['result']>;
  auctionEnabled: boolean;
}) {
  if (result.outcome === 'ignored') {
    return (
      <div className="glass-panel rounded-3xl p-8 text-center">
        <p className="font-display text-[2rem] leading-tight font-semibold text-white">
          Thank you.
        </p>
      </div>
    );
  }

  const heading =
    result.outcome === 'existing'
      ? `Welcome back, ${result.firstName}.`
      : `You are checked in, ${result.firstName}.`;

  return (
    <div className="glass-panel rounded-3xl p-6 text-center sm:p-8">
      <p className="font-display text-[2.25rem] leading-tight font-semibold text-white">
        {heading}
      </p>

      {auctionEnabled && result.bidderNumber !== null && result.bidderNumber !== undefined ? (
        <>
          <p className="bg-cut-900 text-gold-500 mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-base font-bold tracking-[0.08em] uppercase">
            Bidder {formatBidderNumber(result.bidderNumber)}
          </p>
          <p className="mt-3 text-sm text-white/70">Your bidder number for tonight.</p>
        </>
      ) : null}

      {result.passPath ? (
        <Link
          href={result.passPath}
          className="bg-gold-500 text-cut-950 hover:bg-gold-600 mt-8 flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold shadow-[0_10px_30px_-12px_rgba(251,185,39,0.8)] transition-colors"
        >
          Open your pass
        </Link>
      ) : null}

      {result.passUrl ? (
        <p className="mt-4 text-xs break-all text-white/60 select-all">{result.passUrl}</p>
      ) : null}

      <p className="mt-6 text-sm text-white/70">
        {result.sent?.email
          ? `We have also emailed it to ${result.email}.`
          : 'Keep this page open; the link above is your pass.'}
      </p>
    </div>
  );
}
