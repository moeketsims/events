'use client';

import { useEffect, useRef } from 'react';

/**
 * Sets `--mx` and `--my` (−1…1) on its root as the pointer moves, so layers
 * inside can translate by depth with pure CSS (`.px-near`, `.px-mid`,
 * `.px-far` in globals.css). Throttled to one update per frame. Does nothing
 * on touch devices or under reduced motion, where the scene simply stays still.
 */
export function Parallax({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let frame = 0;
    let mx = 0;
    let my = 0;

    const apply = () => {
      frame = 0;
      node.style.setProperty('--mx', mx.toFixed(3));
      node.style.setProperty('--my', my.toFixed(3));
    };
    const onMove = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      mx = 0;
      my = 0;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
