'use client';

import { useEffect, useRef, useState } from 'react';
import { formatZAR } from '@/lib/money';

// A named mode rather than a function: this is a client component and server
// components cannot pass functions across the boundary.
const FORMATS = {
  int: (n: number) => String(Math.round(n)),
  zar: (n: number) => formatZAR(Math.round(n)),
} as const;

/**
 * Animates a number from a lower value to `value` when it enters the viewport.
 * The formatter turns the interim number into text (ZAR, plain, percent). With
 * reduced motion the final value renders immediately.
 */
export function CountUp({
  value,
  format = 'int',
  duration = 1800,
  from,
  className,
}: {
  value: number;
  format?: keyof typeof FORMATS;
  duration?: number;
  /** Start point; defaults to 55 % of the value so the run is visible but short. */
  from?: number;
  className?: string;
}) {
  const start = from ?? Math.max(0, value * 0.55);
  const [display, setDisplay] = useState(start);
  const ref = useRef<HTMLSpanElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplay(value);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || ran.current) return;
        ran.current = true;
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 4);
          setDisplay(start + (value - start) * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, start, duration]);

  return (
    <span ref={ref} className={className}>
      {FORMATS[format](display)}
    </span>
  );
}
