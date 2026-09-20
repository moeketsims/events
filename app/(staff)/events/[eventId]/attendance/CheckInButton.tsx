'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { manualCheckIn, type ManualCheckInState } from './actions';

/** Check a guest in from the register — the path for a dead battery. */
export function CheckInButton({
  eventId,
  attendeeId,
  name,
}: {
  eventId: string;
  attendeeId: string;
  name: string;
}) {
  const [state, action] = useActionState<ManualCheckInState, FormData>(manualCheckIn, {});

  return (
    <form action={action} className="flex items-center justify-end gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="attendeeId" value={attendeeId} />
      {state.error ? (
        <span role="alert" className="text-xs text-red-700">
          {state.error}
        </span>
      ) : null}
      <Submit name={name} />
    </form>
  );
}

function Submit({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Check ${name} in`}
      className="border-hairline-strong text-cut-900 hover:border-cut-700 hover:bg-cut-50 h-9 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50"
    >
      {pending ? 'Checking in…' : 'Check in'}
    </button>
  );
}
