'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Copy, MonitorPlay, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_URL } from '@/lib/env';
import { regenerateDisplayKey, type AuctionActionState } from './actions';

/**
 * The projection link — TASKS T3.2. The display key in the URL is the
 * projector's only credential, so the card lets the operator copy it without
 * reading it aloud and rotate it if a link has gone where it should not.
 */
export function DisplayCard({
  eventId,
  auctionId,
  displayKey,
}: {
  eventId: string;
  auctionId: string;
  displayKey: string;
}) {
  const url = `${APP_URL}/display/${auctionId}?k=${displayKey}`;
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState<AuctionActionState, FormData>(regenerateDisplayKey, {});
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.notice || state.error) setConfirming(false);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
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
      <div className="flex gap-2">
        <input
          ref={field}
          readOnly
          value={url}
          aria-label="Projection link"
          onFocus={(e) => e.currentTarget.select()}
          className="border-hairline-strong text-ink-700 h-10 min-w-0 flex-1 rounded-md border bg-white px-3 font-mono text-xs"
        />
        <Button type="button" variant="outline" onClick={copy} className="h-10 shrink-0">
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <Button asChild variant="outline" className="h-10">
        <a href={url} target="_blank" rel="noreferrer">
          <MonitorPlay className="size-4" aria-hidden /> Open the projection
        </a>
      </Button>

      <p className="text-ink-500 text-sm">
        Open this on the laptop connected to the projector and press F11. Anyone holding the link
        can show the board, so treat it like a key.
      </p>

      {state.error ? (
        <p role="alert" className="rounded-md bg-red-700/10 p-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : state.notice ? (
        <p role="status" className="rounded-md bg-green-600/10 p-3 text-sm text-green-600">
          {state.notice}
        </p>
      ) : null}

      {confirming ? (
        <form
          action={action}
          className="border-gold-500/40 bg-gold-500/10 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
        >
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="auctionId" value={auctionId} />
          <p className="text-gold-600 text-sm">
            A projection already open on the old link will go dark until it is reopened with the new
            one.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Regenerate />
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-ink-500 hover:text-cut-900 inline-flex h-9 items-center gap-1.5 text-sm font-semibold transition-colors"
        >
          <RefreshCw className="size-4" aria-hidden /> Regenerate key
        </button>
      )}
    </div>
  );
}

function Regenerate() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Issuing…' : 'Issue a new link'}
    </Button>
  );
}
