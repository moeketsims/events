'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Check, CalendarPlus, X } from 'lucide-react';
import { submitRsvp, type RsvpState } from './actions';

export type RsvpQuestion = {
  id: string;
  label: string;
  type: string;
  options: string[] | null;
  required: boolean;
};

export type RsvpFormProps = {
  token: string;
  firstName: string;
  allowPlusOnes: boolean;
  hasPhone: boolean;
  consentWording: string;
  questions: RsvpQuestion[];
  existing: {
    attending: boolean;
    guestCount: number;
    whatsappOptIn: boolean;
    answers: Record<string, string | string[]>;
  } | null;
  /** Pass link for a guest who has already accepted, so a revisit is useful. */
  existingPassUrl: string | null;
  icsHref: string;
  auctionEnabled: boolean;
};

/**
 * The guest's reply — TASKS T2.4, on the cinematic layer of DESIGN-SYSTEM §2.5.
 *
 * Revisiting the link shows the answer already given and lets it be changed
 * until the deadline, which is why every control is seeded from `existing`
 * rather than from a blank form.
 */
export function RsvpForm(props: RsvpFormProps) {
  const [state, action] = useActionState<RsvpState, FormData>(submitRsvp, {});
  const [attending, setAttending] = useState<'yes' | 'no'>(
    props.existing ? (props.existing.attending ? 'yes' : 'no') : 'yes',
  );
  const [guestCount, setGuestCount] = useState(props.existing?.guestCount ?? 1);

  if (state.result) {
    return (
      <Outcome
        result={state.result}
        firstName={props.firstName}
        icsHref={props.icsHref}
        auctionEnabled={props.auctionEnabled}
      />
    );
  }

  const answers = props.existing?.answers ?? {};

  return (
    <form action={action} className="glass-panel rounded-3xl p-6 sm:p-8">
      <input type="hidden" name="token" value={props.token} />

      {props.existing ? (
        <div className="mb-6 rounded-lg border border-white/12 bg-white/5 px-4 py-3 text-sm text-white/75">
          <p>
            You have already replied{' '}
            <strong className="font-semibold text-white">
              {props.existing.attending ? 'yes' : 'no'}
            </strong>
            . You can change your answer here until replies close.
          </p>
          {props.existingPassUrl ? (
            <Link
              href={props.existingPassUrl}
              className="text-gold-500 mt-2 inline-block font-semibold underline underline-offset-4"
            >
              Open the pass you already have
            </Link>
          ) : null}
        </div>
      ) : null}

      <fieldset>
        <legend className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/60 uppercase">
          Will you join us?
        </legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Choice
            name="attending"
            value="yes"
            checked={attending === 'yes'}
            onChange={() => setAttending('yes')}
            icon={<Check className="size-4" aria-hidden />}
            label="Yes, I will be there"
          />
          <Choice
            name="attending"
            value="no"
            checked={attending === 'no'}
            onChange={() => setAttending('no')}
            icon={<X className="size-4" aria-hidden />}
            label="With regret, I cannot"
          />
        </div>
      </fieldset>

      {attending === 'yes' ? (
        <>
          {props.allowPlusOnes ? (
            <div className="mt-8">
              <label
                htmlFor="guestCount"
                className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/60 uppercase"
              >
                How many seats, including your own?
              </label>
              <select
                id="guestCount"
                name="guestCount"
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="input-dark mt-3 h-12 w-full rounded-lg px-3 text-base"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n} className="text-ink-900">
                    {n === 1 ? 'Just me' : `${n} seats`}
                  </option>
                ))}
              </select>

              {guestCount > 1 ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: guestCount - 1 }, (_, i) => (
                    <div key={i}>
                      <label
                        htmlFor={`guestName-${i}`}
                        className="mb-1.5 block text-sm text-white/70"
                      >
                        Guest {i + 1}&rsquo;s name <span className="text-white/60">(optional)</span>
                      </label>
                      <input
                        id={`guestName-${i}`}
                        name="guestNames"
                        maxLength={120}
                        placeholder="So the door knows who to expect"
                        className="input-dark h-12 w-full rounded-lg px-3 text-base"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {props.questions.length > 0 ? (
            <div className="mt-8 space-y-5">
              {props.questions.map((question) => (
                <Question key={question.id} question={question} value={answers[question.id]} />
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <div className="mt-8 border-t border-white/10 pt-6">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-white/70">
          <input
            type="checkbox"
            name="whatsappOptIn"
            defaultChecked={props.existing?.whatsappOptIn ?? props.hasPhone}
            className="accent-gold-500 mt-1 size-4 shrink-0"
          />
          <span>{props.consentWording}</span>
        </label>
        {!props.hasPhone ? (
          <p className="mt-2 pl-7 text-xs text-white/60">
            We do not have a number for you, so this covers email only.
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="mt-6 rounded-lg bg-red-700/25 px-4 py-3 text-sm text-white">
          {state.error}
        </p>
      ) : null}

      <Submit attending={attending} existing={Boolean(props.existing)} />
    </form>
  );
}

function Submit({ attending, existing }: { attending: 'yes' | 'no'; existing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-gold-500 text-cut-950 hover:bg-gold-600 mt-8 h-14 w-full rounded-xl text-base font-semibold shadow-[0_10px_30px_-12px_rgba(251,185,39,0.8)] transition-colors disabled:opacity-60"
    >
      {pending
        ? 'Sending your reply…'
        : existing
          ? 'Change my reply'
          : attending === 'yes'
            ? 'Yes, count me in'
            : 'Send my regrets'}
    </button>
  );
}

function Choice({
  name,
  value,
  checked,
  onChange,
  icon,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <label
      className={
        'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base transition-colors ' +
        (checked
          ? 'border-gold-500/70 bg-gold-500/15 text-white'
          : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30')
      }
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        aria-hidden
        className={
          'flex size-7 shrink-0 items-center justify-center rounded-full ' +
          (checked ? 'bg-gold-500 text-cut-950' : 'bg-white/10 text-white/60')
        }
      >
        {icon}
      </span>
      {label}
    </label>
  );
}

function Question({
  question,
  value,
}: {
  question: RsvpQuestion;
  value: string | string[] | undefined;
}) {
  const name = `answer:${question.id}`;
  const id = `q-${question.id}`;
  const chosen = Array.isArray(value) ? value : value ? [value] : [];

  if (question.type === 'boolean') {
    // min-h-11 so the row is a 44 px target on a phone rather than a 23 px one:
    // the checkbox itself is 16 px, and the label is what a thumb actually hits.
    return (
      <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm leading-relaxed text-white/75">
        <input
          type="checkbox"
          name={name}
          value="yes"
          defaultChecked={chosen.includes('yes')}
          className="accent-gold-500 size-4 shrink-0"
        />
        <span>{question.label}</span>
      </label>
    );
  }

  if (question.type === 'select' || question.type === 'multiselect') {
    const options = question.options ?? [];
    if (question.type === 'multiselect') {
      return (
        <fieldset>
          <legend className="mb-2 text-sm text-white/70">
            {question.label}
            {question.required ? <span className="text-gold-500"> *</span> : null}
          </legend>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <label
                key={option}
                className="has-[:checked]:border-gold-500/70 has-[:checked]:bg-gold-500/15 flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white/75 transition-colors"
              >
                <input
                  type="checkbox"
                  name={name}
                  value={option}
                  defaultChecked={chosen.includes(option)}
                  className="accent-gold-500 size-4"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }

    return (
      <div>
        <label htmlFor={id} className="mb-2 block text-sm text-white/70">
          {question.label}
          {question.required ? <span className="text-gold-500"> *</span> : null}
        </label>
        <select
          id={id}
          name={name}
          required={question.required}
          defaultValue={chosen[0] ?? ''}
          className="input-dark h-12 w-full rounded-lg px-3 text-base"
        >
          <option value="" className="text-ink-900">
            Choose…
          </option>
          {options.map((option) => (
            <option key={option} value={option} className="text-ink-900">
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-white/70">
        {question.label}
        {question.required ? <span className="text-gold-500"> *</span> : null}
      </label>
      <input
        id={id}
        name={name}
        required={question.required}
        defaultValue={chosen[0] ?? ''}
        maxLength={300}
        className="input-dark h-12 w-full rounded-lg px-3 text-base"
      />
    </div>
  );
}

function Outcome({
  result,
  firstName,
  icsHref,
  auctionEnabled,
}: {
  result: NonNullable<RsvpState['result']>;
  firstName: string;
  icsHref: string;
  auctionEnabled: boolean;
}) {
  if (result.outcome === 'declined') {
    return (
      <div className="glass-panel rounded-3xl p-8 text-center">
        <p className="font-display text-[2rem] leading-tight font-semibold text-white">
          Thank you for letting us know.
        </p>
        <p className="mt-4 leading-relaxed text-white/70">
          We are sorry you cannot join us, {firstName}. If your plans change before replies close,
          open this link again and say so — your seat is yours until then.
        </p>
      </div>
    );
  }

  if (result.outcome === 'waitlisted') {
    return (
      <div className="glass-panel rounded-3xl p-8 text-center">
        <p className="font-display text-[2rem] leading-tight font-semibold text-white">
          You are on the waiting list.
        </p>
        <p className="mt-4 leading-relaxed text-white/70">
          The room is full, {firstName}. We have recorded your reply and the Advancement team will
          be in touch the moment a seat opens.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-3xl p-6 text-center sm:p-8">
      <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/60 uppercase">
        You are on the list
      </p>
      <p className="font-display mt-4 text-[2.25rem] leading-tight font-semibold text-white">
        We will see you there, {firstName}.
      </p>
      <p className="mt-4 leading-relaxed text-white/70">
        {result.guestCount && result.guestCount > 1
          ? `${result.guestCount} seats are held in your name. Your pass covers your own entry; each guest arrives with you.`
          : 'Your entry pass is ready. There is nothing to install.'}
      </p>

      {result.passUrl ? (
        <Link
          href={result.passUrl}
          className="bg-gold-500 text-cut-950 hover:bg-gold-600 mt-8 flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold shadow-[0_10px_30px_-12px_rgba(251,185,39,0.8)] transition-colors"
        >
          Open my pass
        </Link>
      ) : null}

      <a
        href={icsHref}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-white/16"
      >
        <CalendarPlus className="size-4" aria-hidden /> Add to my calendar
      </a>

      <p className="mt-6 text-sm text-white/60">
        {result.sent?.email || result.sent?.whatsapp
          ? `We have sent it to you${result.sent.email ? ' by email' : ''}${
              result.sent.email && result.sent.whatsapp ? ' and' : ''
            }${result.sent.whatsapp ? ' on WhatsApp' : ''} as well.`
          : 'Keep this page open, or bookmark your pass link — it is your entry.'}
      </p>

      {auctionEnabled ? (
        <p className="mt-2 text-sm text-white/60">
          Bidding opens once you have checked in at the door.
        </p>
      ) : null}
    </div>
  );
}
