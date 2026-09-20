'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createEvent, type NewEventState } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create event'}
    </Button>
  );
}

export function NewEventForm() {
  const [state, action] = useActionState<NewEventState, FormData>(createEvent, {});

  return (
    <form action={action} className="space-y-5">
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-700/10 p-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required placeholder="CUT Fundraising Gala Dinner" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={4000}
          placeholder="What guests should know before they arrive."
          className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 w-full rounded-md border bg-white p-3 text-sm focus:ring-4 focus:outline-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startsAt">Starts</Label>
          <Input id="startsAt" name="startsAt" type="datetime-local" required />
          <p className="text-ink-500 text-sm">South African Standard Time.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endsAt">Ends</Label>
          <Input id="endsAt" name="endsAt" type="datetime-local" />
          <p className="text-ink-500 text-sm">Optional.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rsvpDeadline">RSVP deadline</Label>
          <Input id="rsvpDeadline" name="rsvpDeadline" type="datetime-local" />
          <p className="text-ink-500 text-sm">After this, the RSVP link stops accepting.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" name="capacity" type="number" min={1} placeholder="200" />
          <p className="text-ink-500 text-sm">
            Leave blank for no limit. Acceptances past capacity are waitlisted.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="venueName">Venue</Label>
          <Input id="venueName" name="venueName" placeholder="CUT Hotel School, Bloemfontein" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="venueAddress">Address</Label>
          <Input id="venueAddress" name="venueAddress" placeholder="1 Park Road, Bloemfontein" />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="label-caps text-ink-500 mb-1">Options</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="allowPlusOnes" className="accent-cut-900 size-4" />
          Guests may bring a plus-one
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="auctionEnabled" className="accent-cut-900 size-4" />
          This event has a silent auction
          <span className="text-ink-500">— check-in will assign bidder numbers</span>
        </label>
      </fieldset>

      <Submit />
    </form>
  );
}
