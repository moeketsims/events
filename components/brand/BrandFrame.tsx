import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

/**
 * The navy top band used by every attendee-facing page. DESIGN-SYSTEM §5.2 v2:
 * hero gradient with the watermark, the logo on a white plate, the event title
 * in display type; content on the canvas surface below, single column, max
 * 480 px centred on desktop.
 */
export function BrandFrame({
  title,
  subtitle,
  eyebrow,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
  /** Auction grids need more than the 480 px pass-page measure. */
  wide?: boolean;
}) {
  const measure = wide ? 'max-w-3xl' : 'max-w-[480px]';

  return (
    <div className="bg-canvas flex min-h-dvh flex-col">
      <header className="bg-hero watermark relative overflow-hidden px-4 pt-5 pb-10 text-white">
        <div className={cn('relative z-10 mx-auto w-full', measure)}>
          <span className="shadow-plate inline-flex rounded-xl bg-white p-2.5">
            <Logo variant="horizontal" size="sm" priority />
          </span>
          {eyebrow ? <p className="eyebrow eyebrow-on-dark mt-6">{eyebrow}</p> : null}
          <h1 className="font-display mt-2 text-[2rem] leading-[1.05] font-bold tracking-tight text-balance text-white">
            {title}
          </h1>
          {subtitle ? <p className="mt-2 text-[0.9375rem] text-white/75">{subtitle}</p> : null}
        </div>
      </header>

      <main className={cn('animate-fade-up mx-auto -mt-5 w-full flex-1 px-4', measure)}>
        {children}
      </main>

      <BrandFooter wide={wide} />
    </div>
  );
}

export function BrandFooter({ wide = false }: { wide?: boolean }) {
  return (
    <footer className="border-hairline text-ink-500 mt-10 border-t bg-white px-4 py-8 text-sm">
      <div className={cn('mx-auto w-full', wide ? 'max-w-3xl' : 'max-w-[480px]')}>
        <p className="font-display text-cut-900 text-lg font-semibold tracking-wide">
          Thinking Beyond
        </p>
        <p className="mt-2">Central University of Technology, Free State</p>
        <p>Bloemfontein +27 51 507 3911 · Welkom +27 57 910 3500</p>
        <p className="mt-2">
          <Link href="https://www.cut.ac.za" className="text-cut-700 underline underline-offset-4">
            www.cut.ac.za
          </Link>
        </p>
      </div>
    </footer>
  );
}
