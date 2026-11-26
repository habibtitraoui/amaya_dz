import { StoreHeader } from '@/components/storefront/header';
import { StoreFooter } from '@/components/storefront/footer';
import { CartProvider } from '@/components/cart-provider';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/auth';
import { readCartCookie } from '@/app/actions/cart';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const [user, cart] = await Promise.all([getCurrentUser(), readCartCookie()]);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <CartProvider initialCount={count}>
      <div className="flex min-h-dvh flex-col">
        <StoreHeader locale={locale} user={user} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <StoreFooter locale={locale} dict={dict} />
      </div>
    </CartProvider>
  );
}
