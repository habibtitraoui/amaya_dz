import Link from '@/components/ui/navigation-link';
import { CheckCircle2, Package, Phone } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { formatDA } from '@/lib/money';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderNumber } = await params;
  const query = await searchParams;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const order = await prisma.order.findUnique({
    where: { orderNumber: decodeURIComponent(orderNumber) },
    include: { items: true },
  });

  const name = (Array.isArray(query.name) ? query.name[0] : query.name) ?? order?.customerNameSnapshot ?? '';
  const phone = (Array.isArray(query.phone) ? query.phone[0] : query.phone) ?? order?.customerPhoneSnapshot ?? '';

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-xl">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
            <CheckCircle2 className="h-8 w-8" strokeWidth={2.2} />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold text-ink-900">{dict.checkout.successTitle}</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
            {interpolate(dict.checkout.successText, { name, number: order?.orderNumber ?? orderNumber, phone })}
          </p>
        </div>

        {order && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-5 py-3">
              <div className="flex items-center gap-2 text-[12px] font-bold text-ink-700">
                <Package className="h-4 w-4 text-brand-500" />
                {order.orderNumber}
              </div>
              <Badge tone="amber" dot>{dict.status.PENDING}</Badge>
            </div>
            <ul className="divide-y divide-ink-100">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink-900">{item.productNameFrSnapshot ?? item.productNameSnapshot}</p>
                    <p className="text-[11px] text-ink-400">{item.colorSnapshot} × {item.quantity}</p>
                  </div>
                  <span className="text-[12.5px] font-bold text-ink-800 tabular-nums" dir="ltr">
                    {formatDA(item.lineTotal, 'fr')}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3.5">
              <span className="text-[12.5px] font-bold text-ink-700">{dict.cart.total}</span>
              <span className="text-[15px] font-extrabold text-brand-600 tabular-nums" dir="ltr">
                {formatDA(order.totalAmount, 'fr')}
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <ButtonLink href="/products" size="lg" className="flex-1">{dict.checkout.successCta}</ButtonLink>
          <ButtonLink href="/login" variant="outline" size="lg" className="flex-1">
            <Phone className="h-4 w-4" />
            {dict.footer.contact}
          </ButtonLink>
        </div>
        <p className="mt-6 text-center text-[11.5px] text-ink-400">
          {dict.checkout.agreeTerms}{' '}
          <Link href="/" className="font-semibold text-brand-600 hover:underline">{dict.nav.home}</Link>
        </p>
      </div>
    </div>
  );
}
