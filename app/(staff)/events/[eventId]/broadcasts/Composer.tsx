'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendBroadcast, type SendBroadcastState } from './actions';
import { AUDIENCES, AUDIENCE_LABEL, AUDIENCE_NOTE, type Audience } from './audience';

export type AudienceCounts = Record<Audience, { guests: number; whatsapp: number }>;

/** Past this the message is still allowed, but the count turns gold. */
const SOFT_LIMIT = 280;

/**
 * Compose and send — TASKS T3.1.
 *
 * Short by design: a broadcast is read on a phone held in one hand between
 * courses. The count turns gold past 280 characters and never blocks, because
 * the organiser knows the room better than a limit does. Sending takes two
 * presses — the number of guests is shown on the first, so nobody sends "dinner
 * is served" to the people still in traffic by accident.
 */
export function Composer({
  eventId,
  counts,
  readiness,
}: {
  eventId: string;
  counts: AudienceCounts;
  readiness: { whatsapp: boolean };
}) {
  const [state, action] = useActionState<SendBroadcastState, FormData>(sendBroadcast, {});
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('checked_in');
  const [whatsapp, setWhatsapp] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // A sent message leaves the composer empty and the report on screen, so a
  // second press cannot send the same words twice.
  useEffect(() => {
    if (state.report) {
      setBody('');
      setConfirming(false);
    }
  }, [state.report]);

  useEffect(() => {
    if (state.error) setConfirming(false);
  }, [state.error]);

  const chosen = counts[audience];
  const length = body.length;
  const ready = body.trim().length > 0 && chosen.guests > 0;

  return (
    <form action={action} className="space-y-7">
      <input type="hidden" name="eventId" value={eventId} />

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <label htmlFor="broadcast-body" className="label-caps text-ink-500">
            Message
          </label>
          <span
            aria-live="polite"
            className={
              length > SOFT_LIMIT
                ? 'text-gold-600 text-xs font-semibold tabular-nums'
                : 'text-ink-500 text-xs tabular-nums'
            }
          >
            {length} {length === 1 ? 'character' : 'characters'}
            {length > SOFT_LIMIT ? ' · long for a phone' : ''}
          </span>
        </div>
        <textarea
          id="broadcast-body"
          name="body"
          rows={4}
          maxLength={2000}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setConfirming(false);
          }}
          placeholder="Welcome to the Gala. The silent auction is open; bidding closes at 21:30. Tap Auction on your pass."
          className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 placeholder:text-ink-300 w-full rounded-md border bg-white p-3 text-[0.9375rem] leading-relaxed focus:ring-4 focus:outline-none"
        />
        <p className="text-ink-500 mt-2 text-xs">
          Appears on each guest&rsquo;s pass as written. On WhatsApp the event title goes above it.
        </p>
      </div>

      <fieldset>
        <legend className="label-caps text-ink-500 mb-2">Who</legend>
        <div className="space-y-2">
          {AUDIENCES.map((value) => (
            <label
              key={value}
              className="border-hairline hover:bg-cut-50/60 has-[:checked]:border-cut-700 has-[:checked]:bg-cut-50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
            >
              <input
                type="radio"
                name="audience"
                value={value}
                checked={audience === value}
                onChange={() => {
                  setAudience(value);
                  setConfirming(false);
                }}
                className="accent-cut-900 mt-0.5 size-4"
              />
              <span className="min-w-0">
                <span className="text-ink-900 block text-sm font-semibold">
                  {AUDIENCE_LABEL[value]}
                  <span className="text-cut-700 ml-2 font-normal tabular-nums">
                    {counts[value].guests} {counts[value].guests === 1 ? 'guest' : 'guests'}
                  </span>
                </span>
                <span className="text-ink-500 block text-xs">{AUDIENCE_NOTE[value]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label-caps text-ink-500 mb-2">How</legend>
        <div className="space-y-2">
          <label className="border-hairline bg-cut-50/40 flex items-start gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              checked
              disabled
              readOnly
              className="accent-cut-900 mt-0.5 size-4"
              aria-label="On the pass, always"
            />
            <span className="min-w-0">
              <span className="text-ink-900 block text-sm font-semibold">On the pass</span>
              <span className="text-ink-500 block text-xs">
                Always. Every guest in the audience sees it on their pass page within a second.
              </span>
            </span>
          </label>

          <label className="border-hairline hover:bg-cut-50/60 has-[:checked]:border-cut-700 has-[:checked]:bg-cut-50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors">
            <input
              type="checkbox"
              name="channels"
              value="whatsapp"
              checked={whatsapp}
              onChange={(e) => {
                setWhatsapp(e.target.checked);
                setConfirming(false);
              }}
              className="accent-cut-900 mt-0.5 size-4"
            />
            <span className="min-w-0">
              <span className="text-ink-900 block text-sm font-semibold">WhatsApp</span>
              <span className="text-ink-500 block text-xs">
                {chosen.whatsapp} of them {chosen.whatsapp === 1 ? 'has' : 'have'} a number and{' '}
                {chosen.whatsapp === 1 ? 'has' : 'have'} opted in. A household with a plus-one is
                messaged once.
              </span>
              {whatsapp ? (
                <span className="text-gold-600 mt-1 block text-xs">
                  {readiness.whatsapp
                    ? 'The test number reaches only the five phones registered with Meta, and only within 24 hours of them messaging it.'
                    : 'WhatsApp is not configured yet. Those deliveries will be recorded as failed.'}
                </span>
              ) : null}
            </span>
          </label>
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-700/10 p-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.report ? <Report report={state.report} /> : null}

      {confirming ? (
        <div
          role="group"
          aria-label="Confirm"
          className="border-cut-700 bg-cut-50 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
        >
          <p className="text-ink-900 text-sm">
            Send this to <span className="font-semibold">{chosen.guests}</span>{' '}
            {chosen.guests === 1 ? 'guest' : 'guests'} now
            {whatsapp ? `, ${chosen.whatsapp} of them on WhatsApp as well` : ''}? It cannot be
            recalled.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              Not yet
            </Button>
            <SendNow />
          </div>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            size="lg"
            className="h-11 px-5"
            disabled={!ready}
            onClick={() => setConfirming(true)}
          >
            <Radio className="size-4" aria-hidden />
            {chosen.guests === 0
              ? 'Nobody to send to'
              : `Send to ${chosen.guests} ${chosen.guests === 1 ? 'guest' : 'guests'}`}
          </Button>
        </div>
      )}
    </form>
  );
}

function SendNow() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Yes, send it'}
    </Button>
  );
}

function Report({ report }: { report: NonNullable<SendBroadcastState['report']> }) {
  const figures = [
    { label: 'Guests', value: report.recipients },
    { label: 'On the pass', value: report.inApp.sent },
    ...(report.whatsapp.sent + report.whatsapp.failed > 0
      ? [{ label: 'WhatsApp', value: report.whatsapp.sent }]
      : []),
    { label: 'Failed', value: report.inApp.failed + report.whatsapp.failed },
  ];

  return (
    <div role="status" className="border-hairline rounded-lg border bg-white p-4">
      <div
        className="ledger grid rounded-none border-x-0"
        style={{ gridTemplateColumns: `repeat(${figures.length}, minmax(0, 1fr))` }}
      >
        {figures.map((figure) => (
          <div key={figure.label} className="!px-4 !py-3">
            <p className="label-caps text-ink-500 text-[0.625rem]">{figure.label}</p>
            <p className="numeral text-cut-900 mt-1 text-3xl">{figure.value}</p>
          </div>
        ))}
      </div>

      {report.whatsapp.skipped > 0 ? (
        <p className="text-ink-500 mt-3 text-xs">
          {report.whatsapp.skipped} {report.whatsapp.skipped === 1 ? 'guest has' : 'guests have'} no
          WhatsApp number or opt-in, so they were reached on the pass only.
        </p>
      ) : null}

      {report.problems.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-red-700">
          {report.problems.map((problem, i) => (
            <li key={`${problem.name}-${problem.channel}-${i}`}>
              <span className="font-semibold">{problem.name}</span> · {problem.channel} —{' '}
              {problem.error === 'not_configured' ? 'that provider has no keys yet' : problem.error}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
