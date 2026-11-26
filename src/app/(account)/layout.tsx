import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { StoreHeader } from '@/components/storefront/header';
import { StoreFooter } from '@/components/storefront/footer';
import { CartProvider } from '@/components/cart-provider';
import { readCartCookie } from '@/app/actions/cart';
import { AccountNav } from '@/components/account/account-nav';
import { logoutAction } from '@/app/actions/auth';

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'CUSTOMER') redirect('/admin');

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const cart = await readCartCookie();
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

  const nav = [
    { href: '/account', label: dict.account.overview, icon: 'user' as const },
    { href: '/account/orders', label: dict.account.myOrders, icon: 'package' as const },
    { href: '/products', label: dict.account.browseProducts, icon: 'bag' as const },
    { href: '/cart', label: dict.nav.cart, icon: 'cart' as const },
  ];

  return (
    <CartProvider initialCount={count}>
      <div className="flex min-h-dvh flex-col">
        <StoreHeader locale={locale} user={user} />
        <main className="flex-1">
          <div className="container-page py-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-500">
                  {dict.tier[user.tier as 'WHOLESALE' | 'SUPER_WHOLESALE'] ?? dict.tier.RETAIL}
                </p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900">{user.name}</h1>
                <p className="text-[12.5px] text-ink-500" dir="ltr">{user.email}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 text-[12.5px] font-semibold text-ink-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-3.5 w-3.5 rtl:rotate-180" />
                  {dict.nav.logout}
                </button>
              </form>
            </div>

            <div className="grid gap-6 lg:grid-cols-[228px_1fr]">
              <AccountNav items={nav} />
              <div>{children}</div>
            </div>
          </div>
        </main>
        <StoreFooter locale={locale} dict={dict} />
      </div>
    </CartProvider>
  );
}
