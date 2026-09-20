import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

/**
 * The navy top band used by every attendee-facing page. DESIGN-SYSTEM §5.2:
 * `cut-900` band with the logo on a white plate and the event title, content on
 * white below, single column, max 480 px centred on desktop.
 */
export function BrandFrame({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Auction grids need more than the 480 px pass-page measure. */
  wide?: boolean;
}) {
  return (
    <div className="bg-cut-50 flex min-h-dvh flex-col">
      <header className="bg-cut-900 px-4 py-5 text-white">
        <div className={cn('mx-auto w-full', wide ? 'max-w-3xl' : 'max-w-[480px]')}>
          <Logo variant="horizontal" size="sm" plate priority className="mb-4" />
          <h1 className="font-display text-2xl leading-tight font-bold text-white">{title}</h1>
          {subtitle ? <p className="text-cut-100 mt-1 text-sm">{subtitle}</p> : null}
        </div>
      </header>

      <main className={cn('mx-auto w-full flex-1 px-4 py-6', wide ? 'max-w-3xl' : 'max-w-[480px]')}>
        {children}
      </main>

      <BrandFooter wide={wide} />
    </div>
  );
}

export function BrandFooter({ wide = false }: { wide?: boolean }) {
  return (
    <footer className="border-ink-300 text-ink-500 mt-8 border-t bg-white px-4 py-6 text-sm">
      <div className={cn('mx-auto w-full', wide ? 'max-w-3xl' : 'max-w-[480px]')}>
        <p className="font-display text-cut-900 text-base font-semibold tracking-wide">
          Thinking Beyond
        </p>
        <p className="mt-2">Central University of Technology, Free State</p>
        <p>Bloemfontein +27 51 507 3911 · Welkom +27 57 910 3500</p>
        <p className="mt-2">
          <Link href="https://www.cut.ac.za" className="text-cut-700 underline">
            www.cut.ac.za
          </Link>
        </p>
      </div>
    </footer>
  );
}
