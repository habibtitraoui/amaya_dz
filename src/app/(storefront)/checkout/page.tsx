import { redirect } from 'next/navigation';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCartView } from '@/app/actions/cart';
import { CheckoutForm } from '@/components/storefront/checkout-form';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const [cart, user] = await Promise.all([getCartView(), getCurrentUser()]);

  if (!cart.quote || cart.lines.length === 0) redirect('/cart');

  const accountRecord = user
    ? await prisma.user.findUnique({ where: { id: user.id }, include: { profile: true } })
    : null;

  return (
    <div className="container-page py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{dict.checkout.title}</h1>
      <p className="mt-1 text-[13px] text-ink-500">{dict.checkout.agreeTerms}</p>

      <CheckoutForm
        quote={cart.quote}
        locale={locale}
        user={
          user
            ? {
                name: accountRecord?.name ?? user.name,
                email: user.email,
                phone: accountRecord?.phone ?? null,
                address: accountRecord?.profile?.address ?? null,
                wilaya: accountRecord?.profile?.wilaya ?? null,
              }
            : null
        }
        labels={{
          customerInfo: dict.checkout.customerInfo,
          fullName: dict.checkout.fullName,
          fullNamePlaceholder: dict.checkout.fullNamePlaceholder,
          phone: dict.checkout.phone,
          phonePlaceholder: dict.checkout.phonePlaceholder,
          address: dict.checkout.address,
          addressPlaceholder: dict.checkout.addressPlaceholder,
          city: dict.common.wilaya,
          cityPlaceholder: dict.checkout.cityPlaceholder,
          selectWilaya: dict.common.selectWilaya,
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
