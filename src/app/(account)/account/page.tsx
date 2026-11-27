import Link from '@/components/ui/navigation-link';
import { Package, Building2, BadgeCheck, ArrowRight, ShoppingBag } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { formatDA } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { Badge, OrderStatusBadge, TierBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { ProfileForm } from '@/components/account/profile-form';
import { PasswordForm } from '@/components/account/password-form';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      profile: true,
      orders: { orderBy: { createdAt: 'desc' }, take: 4, include: { items: true } },
      _count: { select: { orders: true } },
    },
  });

  return (
    <div className="space-y-5">
      {/* stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{dict.account.customerType}</p>
          <div className="mt-2">
            <TierBadge tier={user.tier} label={dict.tier[user.tier as 'WHOLESALE' | 'SUPER_WHOLESALE'] ?? dict.tier.RETAIL} />
          </div>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{dict.account.myOrders}</p>
          <p className="mt-1 text-2xl font-extrabold text-ink-900 tabular-nums">{record?._count.orders ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{dict.account.memberSince}</p>
          <p className="mt-1 text-[15px] font-extrabold text-ink-900">
            {record ? formatDate(record.createdAt, locale) : '—'}
          </p>
        </div>
      </div>

      {(user.tier === 'WHOLESALE' || user.tier === 'SUPER_WHOLESALE') && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-4">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <p className="text-[12.5px] font-medium leading-relaxed text-brand-900">
            {user.tier === 'SUPER_WHOLESALE' ? dict.account.superWholesaleNotice : dict.account.wholesaleNotice}
          </p>
        </div>
      )}

      {/* recent orders */}
      <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <Package className="h-4 w-4 text-brand-500" />
            {dict.account.recentOrders}
          </h2>
          <Link href="/account/orders" className="inline-flex items-center gap-1 text-[11.5px] font-bold text-brand-600 hover:underline">
            {dict.common.view} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>
        {record && record.orders.length > 0 ? (
          <ul className="divide-y divide-ink-100">
            {record.orders.map((order) => (
              <li key={order.id}>
                <Link href={`/account/orders/${order.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50/60">
                  <div>
                    <p className="text-[13px] font-bold text-ink-900" dir="ltr">{order.orderNumber}</p>
                    <p className="text-[11px] text-ink-400">
                      {formatDate(order.createdAt, locale)} · {interpolate(dict.account.itemsCount, { count: order.items.length })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-bold text-ink-900 tabular-nums" dir="ltr">
                      {formatDA(order.totalAmount, locale)}
                    </span>
                    <OrderStatusBadge status={order.status} label={dict.status[order.status as keyof typeof dict.status]} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <ShoppingBag className="h-6 w-6 text-ink-300" />
            <p className="text-[13px] text-ink-500">{dict.account.noOrders}</p>
            <ButtonLink href="/products" size="sm">{dict.account.browseProducts}</ButtonLink>
          </div>
        )}
      </section>

      {/* account info */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <Building2 className="h-4 w-4 text-brand-500" />
            {dict.account.info}
          </h2>
          <ProfileForm
            initial={{
              name: record?.name ?? user.name,
              phone: record?.phone ?? '',
              businessName: record?.profile?.businessName ?? '',
              address: record?.profile?.address ?? '',
              city: record?.profile?.city ?? '',
              wilaya: record?.profile?.wilaya ?? '',
            }}
            labels={{
              name: dict.common.name,
              phone: dict.common.phone,
              businessName: dict.account.businessName,
              address: dict.common.address,
              city: dict.common.city,
              wilaya: dict.common.wilaya,
              save: dict.common.save,
              saving: dict.common.saving,
              updated: dict.account.profileUpdated,
              error: dict.common.error,
              tier: dict.account.customerType,
              tierValue: dict.tier[user.tier as 'WHOLESALE' | 'SUPER_WHOLESALE'] ?? dict.tier.RETAIL,
              tierNote: dict.account.cannotChangeTier,
              email: dict.common.email,
              emailValue: user.email,
            }}
          />
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">{dict.auth.changePassword}</h2>
          <PasswordForm
            labels={{
              current: dict.auth.currentPassword,
              next: dict.auth.newPassword,
              confirm: dict.auth.confirmPassword,
              save: dict.common.save,
              mismatch: dict.auth.passwordMismatch,
              tooShort: dict.auth.passwordTooShort,
              wrong: dict.auth.passwordWrong,
              changed: dict.auth.passwordChanged,
            }}
          />
        </section>
      </div>
    </div>
  );
}
