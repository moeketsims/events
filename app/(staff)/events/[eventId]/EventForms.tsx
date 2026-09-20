'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ImageUp, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setEventStatus, updateEvent, uploadBanner, type EventActionState } from './actions';
import { NEXT_STATUS, STATUS_ACTION_LABEL, STATUS_MEANING, type EventStatus } from './status';

export type EditableEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  rsvp_deadline: string | null;
  venue_name: string | null;
  venue_address: string | null;
  capacity: number | null;
  allow_plus_ones: boolean;
  auction_enabled: boolean;
  status: EventStatus;
};

/**
 * A `timestamptz` back into the `YYYY-MM-DDTHH:mm` a datetime-local input wants,
 * rendered in SAST. Doing this with `toISOString().slice(0,16)` would show the
 * organiser 16:00 for an event that starts at 18:00.
 */
function toLocalInput(value: string | null): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  // en-ZA formats hour 24 as "24" at midnight; the input wants "00".
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

function Feedback({ state }: { state: EventActionState }) {
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

function Pending({ children, variant }: { children: React.ReactNode; variant?: 'outline' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? 'Saving…' : children}
    </Button>
  );
}

/** Edit every field of the event. Organiser only; the page decides that. */
export function EditEventDialog({ event }: { event: EditableEvent }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<EventActionState, FormData>(updateEvent, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-11 px-5">
          <Pencil className="size-4" aria-hidden /> Edit
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
          <DialogDescription>
            Times are South African Standard Time. Changing the date does not re-send anything; tell
            your guests yourself from the broadcast desk.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-5">
          <input type="hidden" name="eventId" value={event.id} />
          <Feedback state={state} />

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required defaultValue={event.title} maxLength={160} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={4000}
              defaultValue={event.description ?? ''}
              placeholder="What guests should know before they arrive."
              className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 w-full rounded-md border bg-white p-3 text-sm focus:ring-4 focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="startsAt">Starts</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={toLocalInput(event.starts_at)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endsAt">Ends</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={toLocalInput(event.ends_at)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rsvpDeadline">RSVP deadline</Label>
              <Input
                id="rsvpDeadline"
                name="rsvpDeadline"
                type="datetime-local"
                defaultValue={toLocalInput(event.rsvp_deadline)}
              />
              <p className="text-ink-500 text-sm">After this, the RSVP link stops accepting.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                defaultValue={event.capacity ?? ''}
              />
              <p className="text-ink-500 text-sm">
                Blank for no limit. Acceptances past it are waitlisted.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="venueName">Venue</Label>
              <Input id="venueName" name="venueName" defaultValue={event.venue_name ?? ''} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="venueAddress">Address</Label>
              <Input
                id="venueAddress"
                name="venueAddress"
                defaultValue={event.venue_address ?? ''}
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="label-caps text-ink-500 mb-1">Options</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="allowPlusOnes"
                defaultChecked={event.allow_plus_ones}
                className="accent-cut-900 size-4"
              />
              Guests may bring a plus-one
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="auctionEnabled"
                defaultChecked={event.auction_enabled}
                className="accent-cut-900 size-4"
              />
              This event has a silent auction
              <span className="text-ink-500">— check-in assigns bidder numbers</span>
            </label>
          </fieldset>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Close
              </Button>
            </DialogClose>
            <Pending>Save changes</Pending>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The one or two transitions an event in this status may make. */
export function StatusControls({ event }: { event: { id: string; status: EventStatus } }) {
  const [state, action] = useActionState<EventActionState, FormData>(setEventStatus, {});
  const options = NEXT_STATUS[event.status];

  if (options.length === 0) {
    return <p className="text-ink-500 text-sm">{STATUS_MEANING[event.status]}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((status, i) => (
          <form key={status} action={action}>
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="status" value={status} />
            <Pending variant={i === 0 ? undefined : 'outline'}>
              {STATUS_ACTION_LABEL[status]}
            </Pending>
          </form>
        ))}
      </div>
      <p className="text-ink-500 text-sm">{STATUS_MEANING[options[0] ?? event.status]}</p>
      <Feedback state={state} />
    </div>
  );
}

const MAX_EDGE = 1600;

/**
 * Banner upload. The image is resized in the browser to 1600 px on its longest
 * edge before it is sent (BUILD-SPEC §11b): a 6 MB photo straight off a phone
 * would otherwise cross the Server Action body limit and spend the free tier's
 * storage on pixels nobody sees.
 */
export function BannerUpload({ eventId }: { eventId: string }) {
  const [state, action] = useActionState<EventActionState, FormData>(uploadBanner, {});
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalError(null);
    setBusy(true);
    try {
      const resized = await resize(file);
      const data = new DataTransfer();
      data.items.add(resized);
      if (fileInput.current) fileInput.current.files = data.files;
      formRef.current?.requestSubmit();
    } catch {
      setLocalError('That image could not be read. Try a JPEG or PNG.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="eventId" value={eventId} />
      <input
        ref={fileInput}
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onChange}
        className="sr-only"
        aria-label="Choose a banner image"
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
      >
        <ImageUp className="size-4" aria-hidden /> {busy ? 'Preparing…' : 'Upload a banner'}
      </Button>
      {localError ? (
        <p role="alert" className="text-sm text-red-700">
          {localError}
        </p>
      ) : (
        <Feedback state={state} />
      )}
    </form>
  );
}

/** Longest edge to 1600 px, re-encoded as JPEG. Returns the original if smaller. */
async function resize(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  if (scale === 1 && file.size <= 1_500_000) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new Error('encode failed');

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}
