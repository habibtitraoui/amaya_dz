'use client';

import * as React from 'react';
import Link from '@/components/ui/navigation-link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Boxes,
  Users,
  Shield,
  ShoppingCart,
  FileText,
  BarChart3,
  Settings,
  ScrollText,
  LogOut,
  Menu,
  User,
  X,
  ExternalLink,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { LocaleSwitcher } from '@/components/storefront/locale-switcher';
import type { Dictionary, Locale } from '@/lib/i18n';
import { cn, initials } from '@/lib/utils';

type Permissions = {
  manageProducts: boolean;
  manageCategories: boolean;
  manageStock: boolean;
  managePrices: boolean;
  manageCustomers: boolean;
  manageOrders: boolean;
  issueInvoices: boolean;
  viewReports: boolean;
};

type NavKey = keyof Dictionary['admin']['nav'];

const NAV: {
  href: string;
  key: NavKey;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  permission: string | null;
  exact?: boolean;
}[] = [
  { href: '/admin', key: 'overview', icon: LayoutDashboard, permission: null, exact: true },
  { href: '/admin/orders', key: 'orders', icon: ShoppingCart, permission: 'manageOrders' },
  { href: '/admin/invoices', key: 'invoices', icon: FileText, permission: 'issueInvoices' },
  { href: '/admin/products', key: 'products', icon: Package, permission: 'manageProducts' },
  { href: '/admin/categories', key: 'categories', icon: FolderTree, permission: 'manageCategories' },
  { href: '/admin/stock', key: 'stock', icon: Boxes, permission: 'manageStock' },
  { href: '/admin/customers', key: 'customers', icon: Users, permission: 'manageCustomers' },
  { href: '/admin/reports', key: 'reports', icon: BarChart3, permission: 'viewReports' },
  { href: '/admin/supervisors', key: 'supervisors', icon: Shield, permission: 'admin' },
  { href: '/admin/settings', key: 'settings', icon: Settings, permission: 'admin' },
  { href: '/admin/audit', key: 'audit', icon: ScrollText, permission: 'audit' },
  { href: '/admin/profile', key: 'profile', icon: User, permission: null },
];

export function AdminShell({
  locale,
  labels,
  user,
  permissions,
  children,
}: {
  locale: Locale;
  labels: { nav: Dictionary['admin']['nav']; shell: Dictionary['admin']['shell'] };
  user: { name: string; email: string; role: 'ADMIN' | 'SUPERVISOR' | 'CUSTOMER' };
  permissions: Permissions;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [pathname]);

  const visible = NAV.filter((item) => {
    if (item.permission === null) return true;
    if (item.permission === 'admin' || item.permission === 'audit') return user.role === 'ADMIN';
    return permissions[item.permission as keyof Permissions];
  });

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        <Image src="/brand/amaya-logo-white.png" alt="AMAYA" width={1600} height={237} className="h-6 w-auto" />
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70">
          {user.role === 'ADMIN' ? labels.shell.roleAdmin : labels.shell.roleSupervisor}
        </span>
      </div>

      <nav className="sidebar-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-3">
        {visible.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => { if (pathname === item.href) setOpen(false); }}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] font-medium transition-colors',
                active ? 'bg-brand-500 text-white shadow-[0_6px_18px_-8px_rgba(245,102,0,0.9)]' : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={2.1} />
              {labels.nav[item.key]}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <Link
          href="/"
          className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {labels.shell.viewStore}
        </Link>
        <div className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
          <Link
            href="/admin/profile"
            aria-label={labels.nav.profile}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
              {initials(user.name)}
            </span>
            <span className="block min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-semibold text-white">{user.name}</span>
              <span className="block truncate text-[10px] text-white/40" dir="ltr">{user.email}</span>
            </span>
          </Link>
          <form action={logoutAction}>
            <button type="submit" aria-label={labels.shell.logout} className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white">
              <LogOut className="h-3.5 w-3.5 rtl:rotate-180" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-ink-50">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-60 bg-ink-950 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-64 bg-ink-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute end-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10"
              aria-label={labels.shell.closeMenu}
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:ps-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-100 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-600 hover:bg-ink-50 lg:hidden"
            aria-label={labels.shell.openMenu}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex-1" />
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {labels.shell.online}
          </span>
          <LocaleSwitcher locale={locale} compact />
          <Link href="/" className="text-[11.5px] font-semibold text-ink-500 hover:text-brand-600 lg:hidden">
            {labels.shell.storeShort}
          </Link>
        </header>
        <main id="main" className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
