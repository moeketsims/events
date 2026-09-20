'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
 * The contact picker — TASKS T2.3. The filtering happens on the server, in the
 * page's own search and tag parameters, exactly as `/contacts` does; this
 * component only keeps the ticks and submits them.
 */
export function AddInviteesForm({
  eventId,
  contacts,
  totalAvailable,
}: {
  eventId: string;
  contacts: PickableContact[];
  totalAvailable: number;
}) {
  const [state, action] = useActionState<GuestActionState, FormData>(addInvitees, {});
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allShown = contacts.length > 0 && contacts.every((c) => chosen.has(c.id));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="eventId" value={eventId} />

      <div className="card overflow-hidden">
        <div className="border-hairline bg-cut-50 flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <label className="text-ink-700 flex items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={allShown}
              onChange={() =>
                setChosen((current) => {
                  const next = new Set(current);
                  if (allShown) contacts.forEach((c) => next.delete(c.id));
                  else contacts.forEach((c) => next.add(c.id));
                  return next;
                })
              }
              className="accent-cut-900 size-4"
              aria-label="Select everyone shown"
            />
            {allShown ? 'Clear' : 'Select all shown'}
          </label>
          <p className="text-ink-500 text-sm">
            {contacts.length} shown
            {totalAvailable > contacts.length ? ` of ${totalAvailable} not yet invited` : ''}
          </p>
        </div>

        <ul className="max-h-[26rem] overflow-y-auto">
          {contacts.map((contact) => (
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
                    {contact.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="bg-cut-100 text-cut-900 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <Feedback state={state} />

      <AddSubmit count={chosen.size} />
    </form>
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
