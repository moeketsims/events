import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * The desk: numbered rows for the things staff do tonight — DESIGN-SYSTEM
 * §5.1 v3. Replaces stacked action cards. Gold numerals, hairline rows, an
 * arrow that steps forward on hover.
 */
export function Desk({ items }: { items: { href: string; title: string; description: string }[] }) {
  return (
    <ol className="border-hairline-strong border-t">
      {items.map((item, i) => (
        <li key={item.href} className="border-hairline border-b">
          <Link
            href={item.href}
            className="group hover:bg-cut-50/70 -mx-3 flex items-center gap-5 rounded-lg px-3 py-4 transition-colors"
          >
            <span className="numeral text-gold-600 w-10 shrink-0 text-[1.75rem]">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-display text-cut-900 block text-[1.25rem] leading-tight font-semibold">
                {item.title}
              </span>
              <span className="text-ink-500 block text-sm">{item.description}</span>
            </span>
            <ArrowRight
              className="text-cut-700 size-4 shrink-0 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}
