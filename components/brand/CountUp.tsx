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
 * Animates a number from a lower value to `value` when it enters the viewport,
 * and from the number on screen to the new one whenever `value` changes after
 * that, so a live figure (the projection's total) keeps moving rather than
 * freezing at its first value. The formatter turns the interim number into
 * text (ZAR, plain, percent). With reduced motion the final value renders
 * immediately.
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
  const shown = useRef(start);
  const ref = useRef<HTMLSpanElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      shown.current = value;
      setDisplay(value);
      return;
    }

    let frame = 0;
    const run = (from: number) => {
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 4);
        shown.current = from + (value - from) * eased;
        setDisplay(shown.current);
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    // After the first run, a changed value animates from wherever the number is.
    if (ran.current) {
      run(shown.current);
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || ran.current) return;
        ran.current = true;
        run(start);
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, start, duration]);

  return (
    <span ref={ref} className={className}>
      {FORMATS[format](display)}
    </span>
  );
}
