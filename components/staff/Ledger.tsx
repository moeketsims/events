import { cn } from '@/lib/utils';

/**
 * A printed-programme band of figures — DESIGN-SYSTEM §5.1 v3. Replaces the
 * row of identical stat tiles. Each column is a label, a display numeral and a
 * small true drawing of the figure (arc, seat row, status counts), separated by
 * vertical gold hairlines rather than boxes.
 */
export function Ledger({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('ledger lg:grid-cols-4', className)}>{children}</div>;
}

export function LedgerFigure({
  label,
  value,
  unit,
  note,
  visual,
}: {
  label: string;
  value: string | number;
  unit?: string;
  note?: string;
  visual?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="label-caps text-ink-500">{label}</p>
        <p className="numeral text-cut-900 mt-3 flex items-baseline gap-1.5 text-[3.25rem] whitespace-nowrap">
          <span>{value}</span>
          {unit ? <span className="text-ink-500 text-[1.125rem] font-semibold tracking-normal">{unit}</span> : null}
        </p>
        {note ? <p className="text-ink-500 mt-2 text-sm">{note}</p> : null}
      </div>
      {visual ? <div className="shrink-0 pt-1">{visual}</div> : null}
    </div>
  );
}

/** Ring gauge: 0–100. Gold arc on a faint navy track. */
export function Arc({ percent, size = 64 }: { percent: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,50,97,0.10)" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#FBB927"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${(c * p) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-cut-900"
        style={{ font: '700 14px var(--font-display)' }}
      >
        {Math.round(p)}%
      </text>
    </svg>
  );
}

/** A short row of seats: `taken` gold of `total`, capped for space. */
export function SeatRow({ taken, total, max = 24 }: { taken: number; total: number; max?: number }) {
  const shown = Math.min(total, max);
  const scale = total > max ? total / max : 1;
  const filled = Math.round(taken / scale);
  return (
    <div className="grid w-[7.5rem] grid-cols-8 gap-1.5" aria-hidden>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            i < filled ? 'bg-gold-500 shadow-[0_0_6px_rgba(251,185,39,0.6)]' : 'bg-cut-100 ring-1 ring-cut-900/15',
          )}
        />
      ))}
    </div>
  );
}

/** Status counts as a small legend, for the Events column. */
export function StatusLegend({ counts }: { counts: Record<string, number> }) {
  const order = ['live', 'published', 'draft'] as const;
  const dot: Record<string, string> = {
    live: 'bg-gold-500',
    published: 'bg-sky-500',
    draft: 'bg-ink-300',
  };
  return (
    <ul className="space-y-1.5 pt-1 text-sm">
      {order.map((s) => (
        <li key={s} className="text-ink-700 flex items-center gap-2">
          <span className={cn('size-2 rounded-full', dot[s])} />
          <span className="tabular w-4 text-right font-semibold">{counts[s] ?? 0}</span>
          <span className="text-ink-500 capitalize">{s}</span>
        </li>
      ))}
    </ul>
  );
}
