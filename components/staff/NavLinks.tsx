'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, LayoutDashboard, QrCode, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sidebar navigation with an active state. Client-side only because the active
 * link depends on the pathname; the *set* of links is decided on the server by
 * role and arrives as `allowed`, so no role logic lives here.
 *
 * Below `lg` the sidebar becomes a tab bar: every allowed link shares the row
 * equally, icon over a small label, so nothing is off the edge of a phone. The
 * scanner is the one control door staff reach for all evening, and a link that
 * has to be scrolled into view is a link that is not there.
 */
const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/scan', label: 'Scanner', icon: QrCode },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export type NavHref = (typeof ITEMS)[number]['href'];

export function NavLinks({ allowed }: { allowed: readonly NavHref[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="grid auto-cols-fr grid-flow-col gap-1 lg:mt-2 lg:flex lg:flex-col"
    >
      {ITEMS.filter((item) => allowed.includes(item.href)).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[0.6875rem] font-semibold tracking-wide whitespace-nowrap transition-colors duration-200',
              'lg:min-h-10 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-0 lg:text-[0.9375rem] lg:tracking-normal',
              active
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:bg-white/6 hover:text-white lg:font-normal',
            )}
          >
            {/* Gold bar marks the active page; hidden on the mobile tab bar. */}
            <span
              aria-hidden
              className={cn(
                'bg-gold-500 absolute top-1/2 -left-3 hidden h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity lg:block',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
            <Icon
              className={cn(
                'size-5 shrink-0 transition-colors lg:size-[18px]',
                active ? 'text-gold-500' : 'text-white/55 group-hover:text-white/85',
              )}
              aria-hidden
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
