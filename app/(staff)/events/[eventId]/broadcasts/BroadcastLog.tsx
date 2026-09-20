'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { StatusPill } from '@/components/staff/StatusPill';
import { formatTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { BroadcastRecipient } from '@/app/api/events/[eventId]/broadcasts/[broadcastId]/route';

export type LogEntry = {
  id: string;
  body: string;
  sentAt: string;
  audience: string;
  author: string | null;
  inApp: { sent: number; failed: number };
  /** Null when WhatsApp was not chosen for this message. */
  whatsapp: { sent: number; failed: number } | null;
};

/**
 * The messages as they were sent — TASKS T3.1. Desk-style hairline rows, not a
 * table: each row is a message the room heard, with who it reached beneath it.
 * The per-recipient list is fetched on demand, because a desk of thirty
 * broadcasts does not need a thousand delivery rows in the page.
 */
export function BroadcastLog({ eventId, entries }: { eventId: string; entries: LogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="border-hairline-strong rounded-xl border border-dashed p-10 text-center">
        <p className="text-ink-900 font-semibold">Nothing sent yet</p>
        <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
          Every message goes on the pass page of each guest in the audience, and is logged here per
          guest and per channel.
        </p>
      </div>
    );
  }

  return (
    <ol className="border-hairline-strong border-t">
      {entries.map((entry) => (
        <Row key={entry.id} eventId={eventId} entry={entry} />
      ))}
    </ol>
  );
}

function Row({ eventId, entry }: { eventId: string; entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<BroadcastRecipient[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const failed = entry.inApp.failed + (entry.whatsapp?.failed ?? 0);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || recipients || loading) return;

    setLoading(true);
    setProblem(null);
    try {
      const response = await fetch(`/api/events/${eventId}/broadcasts/${entry.id}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { recipients: BroadcastRecipient[] };
      setRecipients(data.recipients);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The list could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="border-hairline border-b py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="text-ink-900 text-[1.0625rem] leading-relaxed whitespace-pre-wrap">
            {entry.body}
          </p>
          <p className="text-ink-500 mt-2 text-xs">
            <span className="numeral text-cut-900 text-sm">{formatTime(entry.sentAt)}</span>
            <span className="text-ink-300 mx-2">·</span>
            {entry.audience}
            {entry.author ? (
              <>
                <span className="text-ink-300 mx-2">·</span>
                {entry.author}
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Chip>{entry.inApp.sent} on the pass</Chip>
          {entry.whatsapp ? <Chip>{entry.whatsapp.sent} WhatsApp</Chip> : null}
          {failed > 0 ? <Chip tone="red">{failed} failed</Chip> : null}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="text-cut-700 hover:bg-cut-50 inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors"
          >
            Recipients
            <ChevronDown
              className={cn('size-4 transition-transform', open && 'rotate-180')}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {open ? (
        <div className="bg-cut-50/60 mt-4 rounded-lg p-4">
          {loading ? (
            <p className="text-ink-500 text-sm">Loading…</p>
          ) : problem ? (
            <p className="text-sm text-red-700">{problem}</p>
          ) : recipients && recipients.length > 0 ? (
            <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
              {recipients.map((recipient) => (
                <li key={recipient.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink-900 min-w-0 truncate">
                    {recipient.name}
                    <span className="text-ink-500 ml-2 text-xs">
                      {recipient.channel === 'in_app' ? 'pass' : recipient.channel}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {recipient.error ? (
                      <span className="text-ink-500 text-xs">
                        {recipient.error === 'not_configured'
                          ? 'provider not configured'
                          : recipient.error}
                      </span>
                    ) : null}
                    <StatusPill status={recipient.status} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 text-sm">No deliveries were recorded for this message.</p>
          )}
        </div>
      ) : null}
    </li>
  );
}

function Chip({ children, tone = 'navy' }: { children: React.ReactNode; tone?: 'navy' | 'red' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-bold tracking-[0.06em] uppercase tabular-nums',
        tone === 'red' ? 'bg-red-700/10 text-red-700' : 'bg-cut-100 text-cut-900',
      )}
    >
      {children}
    </span>
  );
}
