'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gavel, QrCode, ReceiptText } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lots · My bids · Pass — DESIGN-SYSTEM §5.2. 56 px tall, gold on the active
 * row, fixed to the bottom of the screen where a thumb can reach it while the
 * other hand is holding a glass.
 */
export function AuctionNav({ token }: { token: string }) {
  const pathname = usePathname();

  const items = [
    {
      href: `/p/${token}/auction`,
      label: 'Lots',
      icon: Gavel,
      match: (p: string) => p.startsWith(`/p/${token}/auction`),
    },
    {
      href: `/p/${token}/bids`,
      label: 'My bids',
      icon: ReceiptText,
      match: (p: string) => p === `/p/${token}/bids`,
    },
    { href: `/p/${token}`, label: 'Pass', icon: QrCode, match: (p: string) => p === `/p/${token}` },
  ];

  return (
    <nav
      aria-label="Auction"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#001738]/90 backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-[480px]">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold tracking-wide transition-colors',
                  active ? 'text-gold-500' : 'text-white/60 hover:text-white',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
