'use client';

import { useActionState, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_INVITE_BODY, MERGE_FIELDS, render } from '@/lib/messaging/templates';
import { sendInvitations, type SendInvitationsState } from './actions';
import { AUDIENCES, AUDIENCE_LABEL, AUDIENCE_NOTE, type Audience } from './audience';

export type ComposerEvent = {
  id: string;
  title: string;
  startsAt: string;
  venue: string;
  /** A real guest, so the preview shows the merge fields resolved. */
  sample: { firstName: string; lastName: string; rsvpUrl: string } | null;
};

export type AudienceCounts = Record<Audience, { guests: number; email: number; whatsapp: number }>;

/**
 * Compose, preview and send — TASKS T2.3.
 *
 * The preview renders through the same `render('invite', …)` the Server Action
 * will use, with a real guest's merge fields resolved, so what the organiser
 * approves is the message that leaves. The email preview goes into a sandboxed
 * iframe: it is the only honest way to show markup that Gmail will render, and
 * the sandbox means even a mistake in a template cannot run script in the
 * console.
 */
export function Composer({
  event,
  counts,
  readiness,
}: {
  event: ComposerEvent;
  counts: AudienceCounts;
  readiness: { email: boolean; whatsapp: boolean };
}) {
  const [state, action] = useActionState<SendInvitationsState, FormData>(sendInvitations, {});
  const [body, setBody] = useState(DEFAULT_INVITE_BODY);
  const [audience, setAudience] = useState<Audience>('not_sent');
  const [channels, setChannels] = useState<{ email: boolean; whatsapp: boolean }>({
    email: true,
    whatsapp: false,
  });
  const [tab, setTab] = useState<'email' | 'whatsapp'>('email');
  const textarea = useRef<HTMLTextAreaElement>(null);

  const preview = useMemo(
    () =>
      render('invite', {
        firstName: event.sample?.firstName ?? 'Naledi',
        lastName: event.sample?.lastName ?? 'Mokoena',
        eventTitle: event.title,
        startsAt: event.startsAt,
        venue: event.venue,
        rsvpUrl: event.sample?.rsvpUrl ?? 'https://example.test/rsvp/…',
        body,
      }),
    [body, event],
  );

  const chosen = counts[audience];
  const willReach = (channels.email ? chosen.email : 0) + (channels.whatsapp ? chosen.whatsapp : 0);

  function insertField(field: string) {
    const element = textarea.current;
    if (!element) return;
    const start = element.selectionStart ?? body.length;
    const end = element.selectionEnd ?? body.length;
    const next = body.slice(0, start) + field + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + field.length, start + field.length);
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
      <form action={action} className="space-y-6">
        <input type="hidden" name="eventId" value={event.id} />

        <div>
          <label htmlFor="body" className="label-caps text-ink-500 mb-2 block">
            Message
          </label>
          <textarea
            ref={textarea}
            id="body"
            name="body"
            rows={6}
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 w-full rounded-md border bg-white p-3 text-sm leading-relaxed focus:ring-4 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-ink-500 text-xs">Insert:</span>
            {MERGE_FIELDS.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => insertField(field)}
                className="border-hairline-strong text-cut-700 hover:border-cut-700 hover:bg-cut-50 rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] transition-colors"
              >
                {field}
              </button>
            ))}
          </div>
          <p className="text-ink-500 mt-2 text-xs">
            The greeting, the event details, the button and the CUT footer are added around this.
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
                  onChange={() => setAudience(value)}
                  className="accent-cut-900 mt-0.5 size-4"
                />
                <span className="min-w-0">
                  <span className="text-ink-900 block text-sm font-semibold">
                    {AUDIENCE_LABEL[value]}
                    <span className="text-cut-700 ml-2 font-normal">
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
            <ChannelToggle
              name="channels"
              value="email"
              label="Email"
              detail={`${chosen.email} of them have an email address`}
              checked={channels.email}
              onChange={(next) => setChannels((c) => ({ ...c, email: next }))}
              warning={readiness.email ? null : 'No email provider is configured yet.'}
            />
            <ChannelToggle
              name="channels"
              value="whatsapp"
              label="WhatsApp"
              detail={`${chosen.whatsapp} of them have a number and have opted in`}
              checked={channels.whatsapp}
              onChange={(next) => setChannels((c) => ({ ...c, whatsapp: next }))}
              warning={
                readiness.whatsapp
                  ? 'The test number reaches only the five phones registered with Meta, and only within 24 hours of them messaging it.'
                  : 'WhatsApp is not configured yet.'
              }
            />
          </div>
        </fieldset>

        {state.error ? (
          <p role="alert" className="rounded-md bg-red-700/10 p-3 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        {state.report ? <Report report={state.report} /> : null}

        <SendButton count={willReach} />
      </form>

      <section aria-label="Preview">
        <div className="mb-3 flex items-center gap-2">
          {(['email', 'whatsapp'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-pressed={tab === value}
              className={
                tab === value
                  ? 'bg-cut-900 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white'
                  : 'border-hairline-strong text-ink-700 hover:border-cut-700 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors'
              }
            >
              {value === 'email' ? 'Email' : 'WhatsApp'}
            </button>
          ))}
        </div>

        {tab === 'email' ? (
          <div className="card overflow-hidden">
            <div className="border-hairline bg-cut-50 border-b px-4 py-2.5">
              <p className="label-caps text-ink-500 text-[0.625rem]">Subject</p>
              <p className="text-ink-900 text-sm font-semibold">{preview.subject}</p>
            </div>
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={preview.html}
              className="h-[32rem] w-full bg-white"
            />
          </div>
        ) : (
          <div className="card p-4">
            <div className="rounded-xl rounded-tl-sm bg-[#DCF8C6] p-3.5">
              <p className="text-ink-900 text-sm leading-relaxed whitespace-pre-wrap">
                {preview.whatsappText}
              </p>
            </div>
            <p className="text-ink-500 mt-3 text-xs">
              WhatsApp shows *stars* as bold. The link previews as a card in the app.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ChannelToggle({
  name,
  value,
  label,
  detail,
  checked,
  onChange,
  warning,
}: {
  name: string;
  value: string;
  label: string;
  detail: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  warning: string | null;
}) {
  return (
    <label className="border-hairline hover:bg-cut-50/60 has-[:checked]:border-cut-700 has-[:checked]:bg-cut-50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors">
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-cut-900 mt-0.5 size-4"
      />
      <span className="min-w-0">
        <span className="text-ink-900 block text-sm font-semibold">{label}</span>
        <span className="text-ink-500 block text-xs">{detail}</span>
        {checked && warning ? (
          <span className="text-gold-600 mt-1 block text-xs">{warning}</span>
        ) : null}
      </span>
    </label>
  );
}

function SendButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <div>
      <Button type="submit" size="lg" className="h-11 px-5" disabled={pending || count === 0}>
        <Send className="size-4" aria-hidden />
        {pending
          ? 'Sending…'
          : count === 0
            ? 'Nobody to send to'
            : `Send ${count} ${count === 1 ? 'message' : 'messages'}`}
      </Button>
      <p className="text-ink-500 mt-2 text-xs">
        Sending cannot be undone. Each guest gets their own RSVP link.
      </p>
    </div>
  );
}

function Report({ report }: { report: NonNullable<SendInvitationsState['report']> }) {
  return (
    <div role="status" className="border-hairline rounded-lg border bg-white p-4">
      <div className="ledger grid grid-cols-3 rounded-none border-x-0">
        {[
          { label: 'Guests', value: report.recipients },
          { label: 'Sent', value: report.sent },
          { label: 'Failed', value: report.failed },
        ].map((figure) => (
          <div key={figure.label} className="!px-4 !py-3">
            <p className="label-caps text-ink-500 text-[0.625rem]">{figure.label}</p>
            <p className="numeral text-cut-900 mt-1 text-3xl">{figure.value}</p>
          </div>
        ))}
      </div>

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
