import { redirect } from 'next/navigation';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/auth';
import { getCartView } from '@/app/actions/cart';
import { CheckoutForm } from '@/components/storefront/checkout-form';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const [cart, user] = await Promise.all([getCartView(), getCurrentUser()]);

  if (!cart.quote || cart.lines.length === 0) redirect('/cart');

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{dict.checkout.title}</h1>
      <p className="mt-1 text-[13px] text-ink-500">{dict.checkout.agreeTerms}</p>

      <CheckoutForm
        quote={cart.quote}
        locale={locale}
        user={user ? { name: user.name, email: user.email, phone: null } : null}
        labels={{
          customerInfo: dict.checkout.customerInfo,
          fullName: dict.checkout.fullName,
          fullNamePlaceholder: dict.checkout.fullNamePlaceholder,
          phone: dict.checkout.phone,
          phonePlaceholder: dict.checkout.phonePlaceholder,
          address: dict.checkout.address,
          addressPlaceholder: dict.checkout.addressPlaceholder,
          city: dict.checkout.city,
          cityPlaceholder: dict.checkout.cityPlaceholder,
          notes: dict.checkout.notes,
          notesPlaceholder: dict.checkout.notesPlaceholder,
          deliveryMethod: dict.checkout.deliveryMethod,
          deliveryHome: dict.checkout.deliveryHome,
          pickup: dict.checkout.pickup,
          orderSummary: dict.checkout.orderSummary,
          placeOrder: dict.checkout.placeOrder,
          placing: dict.checkout.placing,
          subtotal: dict.cart.subtotal,
          delivery: dict.cart.delivery,
          deliveryFree: dict.cart.deliveryFree,
          total: dict.cart.total,
          quantity: dict.common.quantity,
          invalidPhone: dict.checkout.invalidPhone,
          errorGeneric: dict.checkout.errorGeneric,
          agreeTerms: dict.checkout.agreeTerms,
          required: dict.common.required,
        }}
      />
    </div>
  );
}
