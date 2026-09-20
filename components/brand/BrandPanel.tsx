import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

/**
 * The navy editorial panel used by the sign-in page and the public landing
 * page. Hero gradient, the CUT watermark, the logo on a white plate, a display
 * headline, and the motto at the foot. DESIGN-SYSTEM §2.4.
 */
export function BrandPanel({
  eyebrow,
  headline,
  copy,
  points,
  className,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  copy?: string;
  points?: string[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        'bg-hero watermark relative flex flex-col justify-between overflow-hidden p-8 text-white sm:p-12',
        className,
      )}
    >
      <div className="relative z-10">
        <span className="shadow-plate inline-flex rounded-xl bg-white p-3">
          <Logo variant="horizontal" size="sm" priority />
        </span>
      </div>

      <div className="relative z-10 my-12 max-w-xl">
        <p className="eyebrow eyebrow-on-dark">{eyebrow}</p>
        <h1 className="font-display mt-5 text-[3rem] leading-[0.98] font-bold tracking-tight text-balance sm:text-[4rem]">
          {headline}
        </h1>
        {copy ? <p className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-white/75">{copy}</p> : null}
        {points && points.length > 0 ? (
          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-white/85">
                <span aria-hidden className="bg-gold-500 mt-[0.65rem] h-[2px] w-4 shrink-0 rounded-full" />
                {point}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4 text-sm text-white/60">
        <span className="font-display text-gold-500 text-lg font-semibold tracking-wide">
          Thinking Beyond
        </span>
        <span className="hidden sm:inline">Central University of Technology, Free State</span>
      </div>
    </section>
  );
}
