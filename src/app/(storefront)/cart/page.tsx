import Link from '@/components/ui/navigation-link';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/auth';
import { getCartView } from '@/app/actions/cart';
import { CartTable } from '@/components/storefront/cart-table';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const [cart, user] = await Promise.all([getCartView(), getCurrentUser()]);

  if (!cart.quote || cart.lines.length === 0) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-lg rounded-3xl border border-dashed border-ink-200 bg-white">
          <EmptyState
            title={dict.cart.empty}
            description={dict.cart.emptyText}
            icon={<ShoppingBag className="h-6 w-6" />}
            action={
              <ButtonLink href="/products" className="mt-2">
                {dict.cart.continueShopping}
              </ButtonLink>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{dict.cart.title}</h1>
      <p className="mt-1 text-[13px] text-ink-500">
        {interpolate(dict.account.itemsCount, { count: cart.count })}
      </p>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_340px]">
        <CartTable
          quote={cart.quote}
          labels={{
            item: dict.cart.item,
            unitPrice: dict.cart.unitPrice,
            quantity: dict.common.quantity,
            lineTotal: dict.cart.lineTotal,
            remove: dict.cart.remove,
            minQtyError: dict.cart.minQtyError,
            stockError: dict.cart.stockError,
          }}
          locale={locale}
        />

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">{dict.checkout.orderSummary}</h2>
            <dl className="mt-4 space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-ink-500">{dict.cart.subtotal}</dt>
                <dd className="font-semibold text-ink-900 tabular-nums" dir="ltr">{cart.quote.subtotal} DA</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">{dict.cart.delivery}</dt>
                <dd className="font-semibold text-ink-900 tabular-nums" dir="ltr">
                  {Number(cart.quote.deliveryFee) === 0 ? dict.cart.deliveryFree : `${cart.quote.deliveryFee} DA`}
                </dd>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-3 text-[15px]">
                <dt className="font-bold text-ink-900">{dict.cart.total}</dt>
                <dd className="font-extrabold text-brand-600 tabular-nums" dir="ltr">{cart.quote.total} DA</dd>
              </div>
            </dl>
            {cart.quote.errors.length > 0 && (
              <div className="mt-4 space-y-1 rounded-xl bg-amber-50 p-3 text-[11.5px] font-medium text-amber-800 ring-1 ring-amber-200">
                {cart.quote.errors.map((error, index) => (
                  <p key={index}>· {error.message}</p>
                ))}
              </div>
            )}
            <ButtonLink
              href="/checkout"
              className="mt-5 w-full"
              size="lg"
              aria-disabled={cart.quote.errors.length > 0}
            >
              {dict.cart.checkout}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </ButtonLink>
            <ButtonLink href="/products" variant="ghost" className="mt-2 w-full" size="sm">
              {dict.cart.continueShopping}
            </ButtonLink>
            <p className="mt-4 text-center text-[11px] text-ink-400">
              {user?.tier === 'WHOLESALE'
                ? dict.cart.wholesaleNotice.replace('{tier}', dict.tier.WHOLESALE)
                : user?.tier === 'SUPER_WHOLESALE'
                  ? dict.cart.wholesaleNotice.replace('{tier}', dict.tier.SUPER_WHOLESALE)
                  : dict.cart.retailNotice}
            </p>
          </div>
          <Link href="/products" className="mt-4 block text-center text-[12px] font-semibold text-ink-500 hover:text-brand-600">
            {dict.cart.continueShopping}
          </Link>
        </aside>
      </div>
    </div>
  );
}
