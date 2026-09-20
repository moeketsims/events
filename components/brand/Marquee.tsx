import { cn } from '@/lib/utils';

/**
 * An endless horizontal ticker. Children are rendered twice so the loop is
 * seamless; the CSS animation lives in globals.css (`.marquee-track`).
 */
export function Marquee({
  children,
  className,
  speed = 40,
}: {
  children: React.ReactNode;
  className?: string;
  /** Seconds for one full loop. */
  speed?: number;
}) {
  return (
    <div className={cn('marquee', className)}>
      <div className="marquee-track" style={{ animationDuration: `${speed}s` }}>
        <div className="flex shrink-0 items-center gap-12">{children}</div>
        <div className="flex shrink-0 items-center gap-12" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
