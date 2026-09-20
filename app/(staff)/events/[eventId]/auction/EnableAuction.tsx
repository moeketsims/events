'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enableAuction, type AuctionActionState } from './actions';

/** The one button on the "not yet enabled" desk. */
export function EnableAuction({ eventId }: { eventId: string }) {
  const [state, action] = useActionState<AuctionActionState, FormData>(enableAuction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <Submit />
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="h-12 px-6" disabled={pending}>
      <Gavel className="size-4" aria-hidden /> {pending ? 'Enabling…' : 'Enable the silent auction'}
    </Button>
  );
}
