'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Copy, Power, Printer, QrCode, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setSelfRegistration, type JoinControlState } from './actions';

function Feedback({ state }: { state: JoinControlState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-md bg-red-700/10 p-3 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (!state.notice) return null;
  return (
    <p role="status" className="rounded-md bg-green-600/10 p-3 text-sm text-green-600">
      {state.notice}
    </p>
  );
}

function Pending({
  children,
  variant,
  size,
}: {
  children: React.ReactNode;
  variant?: 'outline';
  size?: 'sm';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? 'One moment…' : children}
    </Button>
  );
}

/** The one button shown while self-registration is off. */
export function EnableControl({ eventId }: { eventId: string }) {
  const [state, action] = useActionState<JoinControlState, FormData>(setSelfRegistration, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="intent" value="enable" />
      <Feedback state={state} />
      <Pending>
        <QrCode className="size-4" aria-hidden /> Turn on self-registration
      </Pending>
    </form>
  );
}

/**
 * The link, the copy button, the print sheet and the two secondary actions —
 * docs/07 §2.5. Regenerating takes a second press, the same two-press pattern
 * as the broadcast composer, because it stops every printed code.
 */
export function JoinControls({
  eventId,
  joinUrl,
  printHref,
}: {
  eventId: string;
  joinUrl: string;
  printHref: string;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState<JoinControlState, FormData>(setSelfRegistration, {});
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.notice || state.error) setConfirming(false);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission: select the text so a manual copy is one keystroke.
      field.current?.focus();
      field.current?.select();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="label-caps text-ink-500 mb-2">The link behind the code</p>
        <div className="flex gap-2">
          <input
            ref={field}
            readOnly
            value={joinUrl}
            aria-label="Self-registration link"
            onFocus={(e) => e.currentTarget.select()}
            className="border-hairline-strong text-ink-700 h-10 min-w-0 flex-1 rounded-md border bg-white px-3 font-mono text-xs"
          />
          <Button type="button" variant="outline" onClick={copy} className="h-10 shrink-0">
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </div>

      <Button asChild className="h-10">
        <a href={printHref} target="_blank" rel="noreferrer">
          <Printer className="size-4" aria-hidden /> Print sheet
        </a>
      </Button>

      <p className="text-ink-500 text-sm">
        One sheet per table. A guest scans it with their own camera, types their name and email, and
        is checked in with a bidder number in the same moment.
      </p>

      <Feedback state={state} />

      <div className="border-hairline flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-4">
        {confirming ? (
          <form
            action={action}
            className="border-gold-500/40 bg-gold-500/10 flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="intent" value="regenerate" />
            <p className="text-gold-600 text-sm">
              Every printed code stops working. Print the new one before the event.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                Keep it
              </Button>
              <Pending size="sm">Issue a new code</Pending>
            </div>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-ink-500 hover:text-cut-900 inline-flex h-9 items-center gap-1.5 text-sm font-semibold transition-colors"
            >
              <RefreshCw className="size-4" aria-hidden /> Regenerate code
            </button>
            <form action={action}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="intent" value="disable" />
              <TurnOff />
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function TurnOff() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-ink-500 inline-flex h-9 items-center gap-1.5 text-sm font-semibold transition-colors hover:text-red-700 disabled:opacity-60"
    >
      <Power className="size-4" aria-hidden /> {pending ? 'Turning off…' : 'Turn off'}
    </button>
  );
}
