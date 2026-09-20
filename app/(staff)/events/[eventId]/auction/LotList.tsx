'use client';

import Image from 'next/image';
import { useActionState, useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ImageOff, Pencil, Trash2 } from 'lucide-react';
import { StatusPill } from '@/components/staff/StatusPill';
import { formatEventDate } from '@/lib/dates';
import { formatBidderNumber } from '@/lib/dates';
import { formatZAR } from '@/lib/money';
import { cn } from '@/lib/utils';
import { deleteLot, reorderLots, type AuctionActionState } from './actions';
import { LotEditor, type EditableLot } from './LotEditor';

export type LotRow = EditableLot & {
  high_bid: number | null;
  high_bidder_number: number | null;
  bid_count: number;
  next_min: number;
};

/**
 * The lot catalogue — TASKS T3.2. Its own vocabulary: a card list where each
 * row is a lot with its card image, number and title, the board's view of it,
 * and a handle. Drag to reorder with the pointer, or focus the handle and use
 * space and the arrow keys; either way `reorderLots` writes `sort_order`.
 */
export function LotList({
  eventId,
  auctionId,
  lots,
  defaultClosesAt,
}: {
  eventId: string;
  auctionId: string;
  lots: LotRow[];
  defaultClosesAt: string | null;
}) {
  const [order, setOrder] = useState(lots.map((lot) => lot.id));
  const [saving, setSaving] = useState<string | null>(null);
  const dndId = useId();

  useEffect(() => {
    setOrder(lots.map((lot) => lot.id));
  }, [lots]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = new Map(lots.map((lot) => [lot.id, lot]));
  const nextLotNumber = lots.reduce((max, lot) => Math.max(max, lot.lot_number), 0) + 1;

  // dnd-kit announces raw ids by default, which reads as a string of hex to a
  // screen reader. These say what a sighted user sees: which lot, and where in
  // the catalogue it now sits.
  const name = (id: string | number) => {
    const lot = byId.get(String(id));
    return lot ? `lot ${lot.lot_number}, ${lot.title}` : 'the lot';
  };
  const position = (id: string | number | undefined) => {
    if (id === undefined) return '';
    const index = order.indexOf(String(id));
    return index === -1 ? '' : ` Position ${index + 1} of ${order.length}.`;
  };
  const announcements = {
    onDragStart: ({ active }: { active: { id: string | number } }) =>
      `Picked up ${name(active.id)}.${position(active.id)} Use the arrow keys to move it, space to drop it, escape to cancel.`,
    onDragOver: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over?: { id: string | number } | null;
    }) =>
      // Skip the first event, which fires over the item itself and would
      // otherwise talk over the "picked up" announcement.
      over && over.id !== active.id ? `Now above ${name(over.id)}.${position(over.id)}` : undefined,
    onDragEnd: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over?: { id: string | number } | null;
    }) =>
      over
        ? `${name(active.id)} dropped above ${name(over.id)}.`
        : `${name(active.id)} returned to where it was.`,
    onDragCancel: ({ active }: { active: { id: string | number } }) =>
      `Move cancelled. ${name(active.id)} is back where it was.`,
  };

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const previous = order;
    const next = arrayMove(order, from, to);
    setOrder(next);
    setSaving('Saving order…');

    // A dropped request must not leave the list showing an order the database
    // does not hold: on any failure the rows go back where they were and say so.
    try {
      const result = await reorderLots({ eventId, auctionId, orderedIds: next });
      if (result.error) {
        setOrder(previous);
        setSaving(result.error);
        return;
      }
      setSaving('Order saved.');
      setTimeout(() => setSaving(null), 1500);
    } catch {
      setOrder(previous);
      setSaving('The new order could not be saved. Check your connection and try again.');
    }
  }

  if (lots.length === 0) {
    return (
      <div className="border-hairline-strong rounded-xl border border-dashed p-10 text-center">
        <p className="text-ink-900 font-semibold">No lots yet</p>
        <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">
          Add the first lot: a title, a starting bid, and the photograph that goes on its card.
        </p>
      </div>
    );
  }

  return (
    <div>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ announcements }}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {order.map((id) => {
              const lot = byId.get(id);
              return lot ? (
                <SortableLot
                  key={id}
                  eventId={eventId}
                  auctionId={auctionId}
                  lot={lot}
                  nextLotNumber={nextLotNumber}
                  defaultClosesAt={defaultClosesAt}
                />
              ) : null;
            })}
          </ol>
        </SortableContext>
      </DndContext>
      <p className="text-ink-500 mt-3 min-h-5 text-xs" aria-live="polite">
        {saving ?? 'Drag the handle to reorder, or focus it and press space, then the arrow keys.'}
      </p>
    </div>
  );
}

function SortableLot({
  eventId,
  auctionId,
  lot,
  nextLotNumber,
  defaultClosesAt,
}: {
  eventId: string;
  auctionId: string;
  lot: LotRow;
  nextLotNumber: number;
  defaultClosesAt: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lot.id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const image = lot.images[0];

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'card flex items-center gap-4 p-3 sm:p-4',
        isDragging && 'ring-cut-700/30 relative z-10 shadow-lg ring-2',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Reorder lot ${lot.lot_number}`}
        className="text-ink-300 hover:text-cut-900 focus-visible:ring-cut-700/40 flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" aria-hidden />
      </button>

      <div className="bg-cut-100 relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg sm:w-28">
        {image ? (
          <Image src={image} alt="" fill sizes="112px" className="object-cover" />
        ) : (
          <span className="text-ink-300 flex h-full items-center justify-center">
            <ImageOff className="size-5" aria-hidden />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="label-caps text-cut-700 text-[0.625rem]">
          Lot{' '}
          {formatBidderNumber(lot.lot_number)
            .replace(/^0+(?=\d)/, '')
            .padStart(2, '0')}
        </p>
        <p className="text-ink-900 font-display truncate text-[1.125rem] leading-tight font-semibold">
          {lot.title}
        </p>
        <p className="text-ink-500 truncate text-xs">
          {lot.donor_name ? `${lot.donor_name} · ` : ''}
          {lot.closes_at ? `closes ${formatEventDate(lot.closes_at)}` : 'no close time'}
          {lot.images.length > 1 ? ` · ${lot.images.length} photographs` : ''}
        </p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        {lot.high_bid !== null ? (
          <>
            <p className="numeral text-cut-900 text-[1.5rem]">{formatZAR(lot.high_bid)}</p>
            <p className="text-ink-500 text-xs">
              Bidder {formatBidderNumber(lot.high_bidder_number)} · {lot.bid_count}{' '}
              {lot.bid_count === 1 ? 'bid' : 'bids'}
            </p>
          </>
        ) : (
          <>
            <p className="numeral text-ink-500 text-[1.5rem]">{formatZAR(lot.starting_bid)}</p>
            <p className="text-ink-500 text-xs">opening bid · no bids yet</p>
          </>
        )}
      </div>

      <StatusPill status={lot.status} className="hidden shrink-0 md:inline-flex" />

      <div className="flex shrink-0 items-center gap-1">
        <LotEditor
          eventId={eventId}
          auctionId={auctionId}
          lot={lot}
          nextLotNumber={nextLotNumber}
          defaultClosesAt={defaultClosesAt}
          trigger={
            <button
              type="button"
              aria-label={`Edit lot ${lot.lot_number}`}
              className="text-cut-700 hover:bg-cut-50 flex size-9 items-center justify-center rounded-md transition-colors"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
          }
        />
        {lot.bid_count === 0 ? <DeleteLot eventId={eventId} lot={lot} /> : null}
      </div>
    </li>
  );
}

function DeleteLot({ eventId, lot }: { eventId: string; lot: LotRow }) {
  const [state, action] = useActionState<AuctionActionState, FormData>(deleteLot, {});
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state.error) setConfirming(false);
  }, [state.error]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete lot ${lot.lot_number}`}
        title={state.error ?? undefined}
        className="text-ink-500 flex size-9 items-center justify-center rounded-md transition-colors hover:bg-red-700/10 hover:text-red-700"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="lotId" value={lot.id} />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-ink-500 h-9 rounded-md px-2 text-xs font-semibold"
      >
        Keep
      </button>
      <ConfirmDelete />
    </form>
  );
}

function ConfirmDelete() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-md bg-red-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
