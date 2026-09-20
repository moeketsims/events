import { cn } from '@/lib/utils';

/**
 * Status pill for event, invitation and lot states — DESIGN-SYSTEM §2.4: tints,
 * not fills, with `live` the one exception because the room needs to see it.
 * Colour is never the only signal; the word is always in the pill.
 *
 * In its own file, with no server-only import, so client components such as
 * the guest list can render it. `StaffShell` re-exports it.
 */
const PILL: Record<string, string> = {
  // events
  draft: 'bg-ink-100 text-ink-700',
  published: 'bg-sky-500/12 text-sky-500',
  live: 'bg-gold-500 text-cut-950',
  closed: 'bg-green-600/12 text-green-600',
  archived: 'bg-ink-100 text-ink-500',
  // invitations
  pending: 'bg-ink-100 text-ink-700',
  accepted: 'bg-green-600/12 text-green-600',
  declined: 'bg-red-700/10 text-red-700',
  waitlisted: 'bg-gold-500/15 text-gold-600',
  cancelled: 'bg-ink-100 text-ink-500',
  // lots
  upcoming: 'bg-ink-100 text-ink-700',
  open: 'bg-gold-500 text-cut-950',
  unsold: 'bg-ink-100 text-ink-500',
  withdrawn: 'bg-ink-100 text-ink-500',
};

export function StatusPill({
  status,
  className,
  children,
}: {
  status: string;
  className?: string;
  /** A label to show instead of the raw status word. */
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.6875rem] font-bold tracking-[0.1em] uppercase',
        PILL[status] ?? PILL.draft,
        className,
      )}
    >
      {status === 'live' || status === 'open' ? <span className="live-dot bg-cut-950" /> : null}
      {children ?? status}
    </span>
  );
}
