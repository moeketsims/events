'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, LayoutDashboard, QrCode, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sidebar navigation with an active state. Client-side only because the active
 * link depends on the pathname; the *set* of links is decided on the server by
 * role and arrives as `allowed`, so no role logic lives here.
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
    <nav aria-label="Primary" className="flex gap-1 overflow-x-auto lg:mt-2 lg:flex-col lg:overflow-visible">
      {ITEMS.filter((item) => allowed.includes(item.href)).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[0.9375rem] whitespace-nowrap transition-colors duration-200',
              active
                ? 'bg-white/10 font-semibold text-white'
                : 'text-white/70 hover:bg-white/6 hover:text-white',
            )}
          >
            {/* Gold bar marks the active page; hidden on the horizontal mobile bar. */}
            <span
              aria-hidden
              className={cn(
                'bg-gold-500 absolute top-1/2 -left-3 hidden h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-opacity lg:block',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
            <Icon
              className={cn(
                'size-[18px] shrink-0 transition-colors',
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
