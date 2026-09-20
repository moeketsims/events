'use client';

import Image from 'next/image';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ImageUp, Plus, Star, Trash2 } from 'lucide-react';
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
import { toDateTimeLocal } from '@/lib/dates';
import { resizeImage } from '@/lib/images';
import {
  deleteLotImage,
  makeFirstImage,
  upsertLot,
  uploadLotImage,
  type LotActionState,
} from './actions';
import { LOT_EDITABLE_STATUSES, LOT_STATUS_LABEL } from './schema';

export type EditableLot = {
  id: string;
  lot_number: number;
  title: string;
  description: string | null;
  donor_name: string | null;
  images: string[];
  starting_bid: number;
  reserve: number | null;
  buy_now_price: number | null;
  status: string;
  closes_at: string | null;
};

/**
 * Create or edit a lot — TASKS T3.2. One dialog for both: a new lot is saved
 * first, then the same dialog stays open with the photograph controls enabled,
 * so "lot 7 with two images" is one sitting rather than two.
 *
 * The first image is the card image everywhere (grid, projection, detail), so
 * the thumbnails carry a "make first" control rather than a full reorder.
 */
export function LotEditor({
  eventId,
  auctionId,
  lot,
  nextLotNumber,
  defaultClosesAt,
  trigger,
}: {
  eventId: string;
  auctionId: string;
  lot?: EditableLot;
  nextLotNumber: number;
  defaultClosesAt: string | null;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<LotActionState, FormData>(upsertLot, {});
  const [images, setImages] = useState<string[]>(lot?.images ?? []);
  const [imageError, setImageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const lotId = lot?.id ?? state.lotId;
  const settled = lot?.status === 'closed' || lot?.status === 'unsold';

  // Controlled fields. React 19 resets an uncontrolled form the moment its
  // action succeeds, which would blank a lot the organiser has just created
  // while the dialog stays open for its photographs.
  const [draft, setDraft] = useState(() => toDraft(lot, nextLotNumber, defaultClosesAt));
  const field = (name: keyof Draft) => ({
    name,
    value: draft[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft((d) => ({ ...d, [name]: e.target.value })),
  });

  useEffect(() => {
    if (lot) setDraft(toDraft(lot, nextLotNumber, defaultClosesAt));
  }, [lot, nextLotNumber, defaultClosesAt]);

  // The row behind the dialog re-renders on save; keep the thumbnails in step
  // with what the server now holds.
  useEffect(() => {
    if (lot) setImages(lot.images);
  }, [lot]);

  async function onFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0 || !lotId) return;

    setImageError(null);
    setBusy(true);
    try {
      for (const file of files) {
        const resized = await resizeImage(file);
        const data = new FormData();
        data.set('eventId', eventId);
        data.set('auctionId', auctionId);
        data.set('lotId', lotId);
        data.set('file', resized);
        const result = await uploadLotImage(data);
        if (result.error) {
          setImageError(result.error);
          break;
        }
        if (result.images) setImages(result.images);
      }
      router.refresh();
    } catch {
      setImageError('That image could not be read. Try a JPEG or PNG.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(url: string) {
    if (!lotId) return;
    setImageError(null);
    const result = await deleteLotImage({ eventId, lotId, url });
    if (result.error) setImageError(result.error);
    if (result.images) setImages(result.images);
    router.refresh();
  }

  async function first(url: string) {
    if (!lotId) return;
    setImageError(null);
    const result = await makeFirstImage({ eventId, lotId, url });
    if (result.error) setImageError(result.error);
    if (result.images) setImages(result.images);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lot ? `Lot ${lot.lot_number}` : 'New lot'}</DialogTitle>
          <DialogDescription>
            {lot
              ? 'Changes show on every phone and on the projection the moment they are saved.'
              : 'Save the lot, then add its photographs. The first photograph is the one on its card.'}
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-5">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="auctionId" value={auctionId} />
          {lotId ? <input type="hidden" name="lotId" value={lotId} /> : null}

          {state.error ? (
            <p role="alert" className="rounded-md bg-red-700/10 p-3 text-sm text-red-700">
              {state.error}
            </p>
          ) : state.notice ? (
            <p role="status" className="rounded-md bg-green-600/10 p-3 text-sm text-green-600">
              {state.notice}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="lot-number">Number</Label>
              <Input
                id="lot-number"
                type="number"
                min={1}
                max={9999}
                required
                {...field('lotNumber')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lot-title">Title</Label>
              <Input id="lot-title" required maxLength={160} {...field('title')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lot-description">Description</Label>
            <textarea
              id="lot-description"
              rows={3}
              maxLength={4000}
              {...field('description')}
              placeholder="What it is, what it includes, and any conditions."
              className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 w-full rounded-md border bg-white p-3 text-sm focus:ring-4 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lot-donor">Donated by</Label>
            <Input id="lot-donor" maxLength={160} {...field('donorName')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Money id="lot-starting" label="Starting bid" required {...field('startingBid')} />
            <Money id="lot-reserve" label="Reserve" hint="Blank for none." {...field('reserve')} />
            <Money
              id="lot-buy-now"
              label="Buy now"
              hint="Not offered in the proof of concept."
              {...field('buyNowPrice')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lot-status">Status</Label>
              {settled ? (
                <p className="text-ink-700 h-9 text-sm leading-9">
                  {LOT_STATUS_LABEL[lot!.status]}{' '}
                  <span className="text-ink-500">— settled, so it stays as it is.</span>
                </p>
              ) : (
                <select
                  id="lot-status"
                  {...field('status')}
                  className="border-hairline-strong focus:border-cut-700 focus:ring-cut-700/20 h-9 w-full rounded-md border bg-white px-3 text-sm focus:ring-4 focus:outline-none"
                >
                  {LOT_EDITABLE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {LOT_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              )}
              {settled ? <input type="hidden" name="status" value="open" /> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lot-closes">Closes</Label>
              <Input id="lot-closes" type="datetime-local" {...field('closesAt')} />
              <p className="text-ink-500 text-sm">A bid in the soft-close window extends it.</p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Close
              </Button>
            </DialogClose>
            <Save creating={!lotId} />
          </DialogFooter>
        </form>

        <div className="border-hairline mt-2 border-t pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="label-caps text-ink-500">Photographs</p>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onFiles}
              className="sr-only"
              aria-label="Choose photographs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!lotId || busy}
              onClick={() => fileInput.current?.click()}
            >
              <ImageUp className="size-4" aria-hidden /> {busy ? 'Uploading…' : 'Add photographs'}
            </Button>
          </div>

          {!lotId ? (
            <p className="text-ink-500 text-sm">
              Save the lot first, then add its photographs here.
            </p>
          ) : images.length === 0 ? (
            <p className="text-ink-500 text-sm">
              No photographs yet. Each is resized to 1600 px before it is uploaded.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((url, index) => (
                <li key={url} className="group relative">
                  <div className="bg-cut-100 relative aspect-[4/3] overflow-hidden rounded-lg">
                    <Image src={url} alt="" fill sizes="160px" className="object-cover" />
                    {index === 0 ? (
                      <span className="bg-gold-500 text-cut-950 absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.08em] uppercase">
                        Card
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => first(url)}
                      disabled={index === 0}
                      className="text-cut-700 hover:bg-cut-50 inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold disabled:opacity-40"
                    >
                      <Star className="size-3.5" aria-hidden /> Make first
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(url)}
                      aria-label="Remove this photograph"
                      className="text-ink-500 inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold hover:bg-red-700/10 hover:text-red-700"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {imageError ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {imageError}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Draft = {
  lotNumber: string;
  title: string;
  description: string;
  donorName: string;
  startingBid: string;
  reserve: string;
  buyNowPrice: string;
  status: string;
  closesAt: string;
};

function toDraft(
  lot: EditableLot | undefined,
  nextLotNumber: number,
  defaultClosesAt: string | null,
): Draft {
  const money = (value: number | null | undefined) =>
    value === null || value === undefined ? '' : String(value);
  return {
    lotNumber: String(lot?.lot_number ?? nextLotNumber),
    title: lot?.title ?? '',
    description: lot?.description ?? '',
    donorName: lot?.donor_name ?? '',
    startingBid: money(lot?.starting_bid),
    reserve: money(lot?.reserve),
    buyNowPrice: money(lot?.buy_now_price),
    status: lot && LOT_EDITABLE_STATUSES.includes(lot.status as never) ? lot.status : 'upcoming',
    closesAt: toDateTimeLocal(lot?.closes_at ?? defaultClosesAt),
  };
}

function Money({
  id,
  name,
  label,
  hint,
  required,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="text-ink-500 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
          R
        </span>
        <Input
          id={id}
          name={name}
          type="number"
          min={0}
          step={1}
          required={required}
          value={value}
          onChange={onChange}
          className="pl-7"
        />
      </div>
      {hint ? <p className="text-ink-500 text-sm">{hint}</p> : null}
    </div>
  );
}

function Save({ creating }: { creating: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        'Saving…'
      ) : creating ? (
        <>
          <Plus className="size-4" aria-hidden /> Create lot
        </>
      ) : (
        'Save lot'
      )}
    </Button>
  );
}
