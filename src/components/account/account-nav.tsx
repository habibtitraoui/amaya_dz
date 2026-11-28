'use client';

import Link from '@/components/ui/navigation-link';
import { usePathname } from 'next/navigation';
import { User, Package, ShoppingBag, ShoppingCart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = { user: User, package: Package, bag: ShoppingBag, cart: ShoppingCart, settings: Settings } as const;

export function AccountNav({ items }: { items: { href: string; label: string; icon: keyof typeof ICONS }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-ink-100 bg-white p-1.5 shadow-card hide-scrollbar lg:flex-col lg:self-start">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === '/account' ? pathname === '/account' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold transition-colors',
              active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
