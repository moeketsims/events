'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { addInvitees, removeInvitee, type GuestActionState } from './actions';

export type PickableContact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone_e164: string | null;
  organisation: string | null;
  tags: string[];
};

function Feedback({ state }: { state: GuestActionState }) {
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

/**
 * The contact picker — TASKS T2.3 — in a dialog.
 *
 * It used to share the page with the list in a second column, which at laptop
 * widths left it too narrow to read. In a dialog it has the full width, and the
 * list has the page. Search and tag filtering happen in the browser over the
 * contacts the server already sent (everyone in the department not yet on this
 * list, capped), so the dialog never has to reload and lose its ticks.
 */
export function AddGuestsDialog({
  eventId,
  contacts,
  totalAvailable,
  variant = 'default',
}: {
  eventId: string;
  contacts: PickableContact[];
  totalAvailable: number;
  variant?: 'default' | 'outline' | 'gold';
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<GuestActionState, FormData>(addInvitees, {});
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');

  // After a successful add the server re-renders the page and the people
  // chosen leave the picker, so the ticks that pointed at them go too.
  useEffect(() => {
    if (state.notice) setChosen(new Set());
  }, [state]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of contacts) for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [contacts]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (tag && !c.tags.includes(tag)) return false;
      if (!q) return true;
      return (
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.organisation ?? '').toLowerCase().includes(q)
      );
    });
  }, [contacts, query, tag]);

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allShown = shown.length > 0 && shown.every((c) => chosen.has(c.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="lg" className="h-11 px-5">
          <UserPlus className="size-4" aria-hidden /> Add guests
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-cut-900 text-2xl font-bold">
            Add guests
          </DialogTitle>
          <DialogDescription>
            Choose from your department&apos;s contacts. Each person added gets an invitation with
            their own RSVP link. Nothing is sent until you send it.
          </DialogDescription>
        </DialogHeader>

        {contacts.length === 0 ? (
          <div className="border-hairline-strong rounded-xl border border-dashed p-10 text-center">
            <p className="text-ink-900 font-semibold">Everyone is already invited</p>
            <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
              Every contact in your department is on this guest list. Import more on the{' '}
              <a href="/contacts" className="text-cut-700 underline">
                contacts page
              </a>
              .
            </p>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="eventId" value={eventId} />
            {/* A tick on someone the filter has hidden must still be posted: the
                checkbox that carried it is not in the form while they are hidden. */}
            {[...chosen]
              .filter((id) => !shown.some((c) => c.id === id))
              .map((id) => (
                <input key={id} type="hidden" name="contactIds" value={id} />
              ))}

            <label className="relative block">
              <Search
                className="text-ink-500 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email or organisation"
                aria-label="Search contacts to invite"
                className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 h-11 w-full rounded-md border bg-white pr-3 pl-9 text-sm focus:ring-4 focus:outline-none"
              />
            </label>

            {tags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <TagChip
                  active={tag === ''}
                  onClick={() => setTag('')}
                  label="All"
                  count={contacts.length}
                />
                {tags.map(([name, n]) => (
                  <TagChip
                    key={name}
                    active={tag === name}
                    onClick={() => setTag(tag === name ? '' : name)}
                    label={name}
                    count={n}
                  />
                ))}
              </div>
            ) : null}

            <div className="card overflow-hidden">
              <div className="border-hairline bg-cut-50 flex items-center justify-between gap-3 border-b px-4 py-2.5">
                <label className="text-ink-700 flex items-center gap-2.5 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={allShown}
                    disabled={shown.length === 0}
                    onChange={() =>
                      setChosen((current) => {
                        const next = new Set(current);
                        if (allShown) shown.forEach((c) => next.delete(c.id));
                        else shown.forEach((c) => next.add(c.id));
                        return next;
                      })
                    }
                    className="accent-cut-900 size-4"
                    aria-label="Select everyone shown"
                  />
                  {allShown ? 'Clear' : 'Select all shown'}
                </label>
                <p className="text-ink-500 text-sm">
                  {shown.length} shown
                  {totalAvailable > contacts.length ? ` · ${totalAvailable} not yet invited` : ''}
                </p>
              </div>

              {shown.length === 0 ? (
                <p className="text-ink-500 p-8 text-center text-sm">
                  Nothing matches that.{' '}
                  <button
                    type="button"
                    className="text-cut-700 underline"
                    onClick={() => {
                      setQuery('');
                      setTag('');
                    }}
                  >
                    Clear the filter
                  </button>
                  .
                </p>
              ) : (
                <ul className="max-h-[22rem] overflow-y-auto">
                  {shown.map((contact) => (
                    <li key={contact.id} className="border-hairline border-b last:border-0">
                      <label className="hover:bg-cut-50/70 flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors">
                        <input
                          type="checkbox"
                          name="contactIds"
                          value={contact.id}
                          checked={chosen.has(contact.id)}
                          onChange={() => toggle(contact.id)}
                          className="accent-cut-900 size-4 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-ink-900 block truncate text-sm font-semibold">
                            {contact.first_name} {contact.last_name}
                          </span>
                          <span className="text-ink-500 block truncate text-xs">
                            {contact.email ?? contact.phone_e164 ?? 'No contact details'}
                            {contact.organisation ? ` · ${contact.organisation}` : ''}
                          </span>
                        </span>
                        {contact.tags.length > 0 ? (
                          <span className="hidden shrink-0 gap-1 sm:flex">
                            {contact.tags.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="bg-cut-100 text-cut-900 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold"
                              >
                                {t}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Ticks on people filtered out of view still count; say so. */}
            <Feedback state={state} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-ink-500 text-sm">
                {chosen.size === 0
                  ? 'Nobody chosen yet.'
                  : `${chosen.size} chosen${
                      shown.filter((c) => chosen.has(c.id)).length !== chosen.size
                        ? ', some outside the current filter'
                        : ''
                    }.`}
              </p>
              <AddSubmit count={chosen.size} />
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TagChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-cut-900 text-white'
          : 'border-hairline-strong text-ink-700 hover:border-cut-700 border bg-white',
      )}
    >
      {label}
      <span className={active ? 'ml-1.5 text-white/60' : 'text-ink-500 ml-1.5'}>{count}</span>
    </button>
  );
}

function AddSubmit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="h-11 px-5" disabled={pending || count === 0}>
      <UserPlus className="size-4" aria-hidden />
      {pending ? 'Adding…' : count === 0 ? 'Add to the event' : `Add ${count} to the event`}
    </Button>
  );
}

/** Remove a guest who has not yet replied. */
export function RemoveInviteeButton({
  eventId,
  invitationId,
  name,
}: {
  eventId: string;
  invitationId: string;
  name: string;
}) {
  const [state, action] = useActionState<GuestActionState, FormData>(removeInvitee, {});

  return (
    <form action={action}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <RemoveSubmit name={name} />
      {state.error ? (
        <span role="alert" className="block text-xs text-red-700">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function RemoveSubmit({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={`Remove ${name} from the guest list`}
      aria-label={`Remove ${name} from the guest list`}
      className="text-ink-500 flex size-9 items-center justify-center rounded-lg transition-colors hover:text-red-700 disabled:opacity-50"
    >
      <X className="size-4" aria-hidden />
    </button>
  );
}
