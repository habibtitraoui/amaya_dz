import Link from '@/components/ui/navigation-link';
import { Search, ShoppingBag, User, LayoutDashboard, Truck, Phone } from 'lucide-react';
import { Logo } from '@/components/storefront/logo';
import { LocaleSwitcher } from '@/components/storefront/locale-switcher';
import { getDictionary, type Locale } from '@/lib/i18n';
import { readCartCookie } from '@/app/actions/cart';
import { type CurrentUser } from '@/lib/auth';
import { MobileMenu } from '@/components/storefront/mobile-menu';
import { cn } from '@/lib/utils';

export async function StoreHeader({
  locale,
  user,
}: {
  locale: Locale;
  user: CurrentUser | null;
}) {
  const dict = await getDictionary(locale);
  const cart = await readCartCookie();
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

  const nav = [
    { href: '/', label: dict.nav.home },
    { href: '/products', label: dict.nav.products },
    { href: '/categories', label: dict.nav.categories },
    { href: '/#brand', label: dict.nav.about },
    { href: '/#contact', label: dict.nav.contact },
  ];

  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* announcement strip */}
      <div className="bg-ink-950 text-white">
        <div className="container-page flex h-9 items-center justify-between text-[11px] font-medium tracking-wide">
          <div className="flex items-center gap-2 text-white/80">
            <Truck className="h-3.5 w-3.5 text-brand-400" />
            <span>{dict.home.trustDeliveryText}</span>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <a href="tel:+213555000000" className="inline-flex items-center gap-1.5 text-white/80 transition-colors hover:text-white">
              <Phone className="h-3 w-3" />
              <span dir="ltr">+213 555 00 00 00</span>
            </a>
            <span className="hidden text-white/40 md:inline">·</span>
            <span className="hidden text-white/60 md:inline">{dict.footer.hours}</span>
          </div>
        </div>
      </div>

      <div className="border-b border-ink-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container-page flex h-16 items-center gap-4">
          <MobileMenu
            locale={locale}
            nav={nav}
            labels={{ menu: dict.common.menu, close: dict.common.close, login: dict.nav.login, account: dict.nav.account, admin: dict.nav.admin }}
            user={user}
          />
          <Logo priority className="h-6 shrink-0 sm:h-7" />

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-ink-50 hover:text-brand-600"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-1 items-center justify-end gap-2">
            <form action="/products" className="hidden md:block">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  type="search"
                  name="q"
                  placeholder={dict.catalog.searchPlaceholder}
                  aria-label={dict.common.search}
                  className="h-9 w-52 rounded-full border border-ink-200 bg-ink-50/60 ps-9 pe-3 text-[13px] text-ink-800 placeholder:text-ink-400 transition-all focus:w-64 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50 lg:w-56"
                />
              </div>
            </form>

            <LocaleSwitcher locale={locale} compact />

            {user ? (
              <div className="flex items-center gap-1">
                {isStaff && (
                  <Link
                    href="/admin"
                    className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-ink-50 hover:text-brand-600 sm:inline-flex"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {dict.nav.admin}
                  </Link>
                )}
                <Link
                  href="/account"
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-ink-200 px-3 text-[13px] font-semibold text-ink-800 transition-colors hover:border-ink-300"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden max-w-24 truncate sm:inline">{user.name.split(' ')[0]}</span>
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 px-3 text-[13px] font-semibold text-ink-800 transition-colors hover:border-ink-300"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{dict.nav.login}</span>
              </Link>
            )}

            <Link
              href="/cart"
              aria-label={dict.nav.cart}
              className="relative inline-flex h-9 items-center gap-2 rounded-full bg-ink-900 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-ink-800"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className={cn('hidden sm:inline', count > 0 && 'font-bold')}>{dict.nav.cart}</span>
              {count > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[11px] font-bold leading-none text-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
      {user && user.tier !== 'RETAIL' && (
        <div className="border-b border-brand-100 bg-brand-50/70">
          <div className="container-page flex h-8 items-center gap-2 text-[11.5px] font-medium text-brand-800">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
            {user.tier === 'WHOLESALE' ? dict.account.wholesaleNotice : dict.account.superWholesaleNotice}
          </div>
        </div>
      )}
    </header>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="h-[105px] w-full border-b border-ink-100 bg-white">
      <div className="container-page flex h-16 items-center gap-4">
        <div className="h-6 w-28 animate-pulse rounded bg-ink-100" />
        <div className="flex-1" />
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded-full bg-ink-100" />
          <div className="h-9 w-24 animate-pulse rounded-full bg-ink-100" />
        </div>
      </div>
    </div>
  );
}

