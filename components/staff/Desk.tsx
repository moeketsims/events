import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DeskItem = {
  href: string;
  title: string;
  description: string;
  /**
   * Set when the surface behind the row has not been built yet. The row stays
   * on the desk so the evening reads whole, but it is not a link, and it says
   * so, rather than sending staff to a 404.
   */
  soon?: string;
};

/**
 * The desk: numbered rows for the things staff do tonight — DESIGN-SYSTEM
 * §5.1 v3. Replaces stacked action cards. Gold numerals, hairline rows, an
 * arrow that steps forward on hover.
 */
export function Desk({ items }: { items: DeskItem[] }) {
  return (
    <ol className="border-hairline-strong border-t">
      {items.map((item, i) => {
        const number = String(i + 1).padStart(2, '0');
        const body = (
          <>
            <span
              className={cn(
                'numeral w-10 shrink-0 text-[1.75rem]',
                item.soon ? 'text-ink-300' : 'text-gold-600',
              )}
            >
              {number}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'font-display block text-[1.25rem] leading-tight font-semibold',
                  item.soon ? 'text-ink-500' : 'text-cut-900',
                )}
              >
                {item.title}
              </span>
              <span className="text-ink-500 block text-sm">{item.description}</span>
            </span>
          </>
        );

        return (
          <li key={item.href} className="border-hairline border-b">
            {item.soon ? (
              <div className="-mx-3 flex items-center gap-5 px-3 py-4" aria-disabled>
                {body}
                <span className="border-hairline-strong text-ink-500 shrink-0 rounded-full border px-2.5 py-1 text-[0.625rem] font-bold tracking-[0.1em] uppercase">
                  {item.soon}
                </span>
              </div>
            ) : (
              <Link
                href={item.href}
                className="group hover:bg-cut-50/70 -mx-3 flex items-center gap-5 rounded-lg px-3 py-4 transition-colors"
              >
                {body}
                <ArrowRight
                  className="text-cut-700 size-4 shrink-0 transition-transform group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
