import { StoreHeader } from '@/components/storefront/header';
import { StoreFooter } from '@/components/storefront/footer';
import { CartProvider } from '@/components/cart-provider';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/auth';
import { readCartCookie } from '@/app/actions/cart';
import { getContactSettings } from '@/lib/settings';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const [user, cart, contact] = await Promise.all([getCurrentUser(), readCartCookie(), getContactSettings(dict)]);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <CartProvider initialCount={count}>
      <div className="flex min-h-dvh flex-col">
        <StoreHeader locale={locale} user={user} contact={contact} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <StoreFooter locale={locale} dict={dict} contact={contact} />
      </div>
    </CartProvider>
  );
}
