'use client';

import * as React from 'react';
import Link from '@/components/ui/navigation-link';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu, X, LayoutDashboard, User } from 'lucide-react';
import type { CurrentUser } from '@/lib/auth';

export function MobileMenu({
  nav,
  labels,
  user,
}: {
  locale: string;
  nav: { href: string; label: string }[];
  labels: { menu: string; close: string; login: string; account: string; admin: string };
  user: CurrentUser | null;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  React.useEffect(() => setOpen(false), [pathname]);

  function closeIfCurrent(href: string) {
    if (href.split(/[?#]/)[0] === pathname) setOpen(false);
  }

  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.menu}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-ink-50 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && createPortal(
        <div id="mobile-navigation" className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-[86%] max-w-xs flex-col overflow-y-auto overscroll-contain bg-white p-5 shadow-2xl animate-rise">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-ink-400">{labels.menu}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={labels.close}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-50 text-ink-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => closeIfCurrent(item.href)}
                  className="rounded-xl px-3 py-3 text-[15px] font-semibold text-ink-800 transition-colors hover:bg-ink-50"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 border-t border-ink-100 pt-4">
              {user ? (
                <>
                  <Link href="/account" onClick={() => closeIfCurrent('/account')} className="flex items-center gap-2 rounded-xl px-3 py-3 text-[15px] font-semibold text-ink-800 hover:bg-ink-50">
                    <User className="h-4 w-4" /> {labels.account}
                  </Link>
                  {(user.role === 'ADMIN' || user.role === 'SUPERVISOR') && (
                    <Link href="/admin" onClick={() => closeIfCurrent('/admin')} className="flex items-center gap-2 rounded-xl px-3 py-3 text-[15px] font-semibold text-ink-800 hover:bg-ink-50">
                      <LayoutDashboard className="h-4 w-4" /> {labels.admin}
                    </Link>
                  )}
                </>
              ) : (
                <Link href="/login" onClick={() => closeIfCurrent('/login')} className="flex items-center gap-2 rounded-xl bg-brand-500 px-3 py-3 text-[15px] font-semibold text-white">
                  <User className="h-4 w-4" /> {labels.login}
                </Link>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
