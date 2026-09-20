import Image from 'next/image';
import { cn } from '@/lib/utils';

type Variant = 'horizontal' | 'vertical';
type Size = 'sm' | 'md' | 'lg';

/**
 * The CUT identity. DESIGN-SYSTEM §4.
 *
 * The symbol and the university name are an inseparable unit — this component
 * is the only way the logo enters the product, so the rules travel with it:
 *
 *  - Minimum width 160 px horizontal, 120 px vertical (working minimums for the
 *    35 mm / 25 mm print minimums at 96 dpi).
 *  - The supplied files are RGB on white with no transparency, so on any
 *    non-white background the logo sits on a white plate (`plate`), which is
 *    also the CI rule: "a white area ... must be created for the CUT identity
 *    to live on."
 *  - Isolation area: nothing within one logotype-character height of the mark.
 *    The plate padding and the `isolate` margin below enforce it.
 */

// Every size draws from the largest supplied file and lets the Next image
// optimiser produce the density variants. The smaller PNGs (logo-h-sm at
// 175 px, logo-v-sm at 170 px) are barely wider than their own minimum display
// size, so using them directly is soft on any 2x screen. They stay in
// public/brand for email HTML and the favicon set, where a fixed URL is needed.
const SOURCES: Record<Variant, Record<Size, { src: string; width: number }>> = {
  horizontal: {
    sm: { src: '/brand/logo-h-lg.png', width: 160 },
    md: { src: '/brand/logo-h-lg.png', width: 220 },
    lg: { src: '/brand/logo-h-lg.png', width: 320 },
  },
  vertical: {
    sm: { src: '/brand/logo-v-lg.png', width: 120 },
    md: { src: '/brand/logo-v-lg.png', width: 180 },
    lg: { src: '/brand/logo-v-lg.png', width: 280 },
  },
};

// Intrinsic aspect ratios of the supplied files.
const RATIO: Record<Variant, number> = {
  horizontal: 1181 / 738,
  vertical: 640 / 594,
};

export function Logo({
  variant = 'horizontal',
  size = 'md',
  plate = false,
  priority = false,
  className,
}: {
  variant?: Variant;
  size?: Size;
  /** Place the logo on a white rounded plate — required on cut-900/cut-950. */
  plate?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const { src, width } = SOURCES[variant][size];
  const height = Math.round(width / RATIO[variant]);

  const image = (
    <Image
      src={src}
      alt="Central University of Technology, Free State"
      width={width}
      height={height}
      priority={priority}
      quality={90}
      sizes={`${width}px`}
      style={{ width, height: 'auto' }}
    />
  );

  if (!plate) {
    return <span className={cn('inline-block', className)}>{image}</span>;
  }

  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-lg bg-white p-4', className)}
    >
      {image}
    </span>
  );
}
