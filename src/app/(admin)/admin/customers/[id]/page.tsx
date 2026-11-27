import Link from '@/components/ui/navigation-link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { CustomerForm } from '@/components/admin/customer-form';
import { formatDA } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/ui/badge';

const STATUS_FR: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'Préparation',
  READY: 'Prête',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

export const dynamic = 'force-dynamic';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
      orders: { orderBy: { createdAt: 'desc' }, take: 15 },
    },
  });
  if (!customer || customer.role !== 'CUSTOMER') notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> Clients
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{customer.name}</h1>
          <p className="text-[12.5px] text-ink-500" dir="ltr">{customer.email}</p>
        </div>
        <p className="text-[11.5px] text-ink-500">Créé le {formatDateTime(customer.createdAt, 'fr')}</p>
      </div>

      <CustomerForm
        initial={{
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone ?? '',
          tier: (customer.tier ?? 'WHOLESALE') as 'WHOLESALE' | 'SUPER_WHOLESALE',
          businessName: customer.profile?.businessName ?? '',
          address: customer.profile?.address ?? '',
          city: customer.profile?.city ?? '',
          wilaya: customer.profile?.wilaya ?? '',
          notes: customer.notes ?? '',
          status: customer.status,
        }}
      />

      <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <h2 className="flex items-center gap-1.5 border-b border-ink-100 px-5 py-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
          <ShoppingBag className="h-3.5 w-3.5" /> Commandes récentes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-ink-100">
              {customer.orders.map((order) => (
                <tr key={order.id} className="hover:bg-ink-50/50">
                  <td className="px-5 py-2.5">
                    <Link href={`/admin/orders/${order.id}`} className="text-[12px] font-bold text-ink-900 hover:text-brand-600" dir="ltr">
                      {order.orderNumber}
                    </Link>
                    <p className="text-[10px] text-ink-400">{formatDateTime(order.createdAt, 'fr')}</p>
                  </td>
                  <td className="px-3 py-2.5"><OrderStatusBadge status={order.status} label={STATUS_FR[order.status] ?? order.status} /></td>
                  <td className="px-5 py-2.5 text-end text-[12px] font-bold text-ink-900 tabular-nums" dir="ltr">
                    {formatDA(order.totalAmount, 'fr')}
                  </td>
                </tr>
              ))}
              {customer.orders.length === 0 && (
                <tr><td className="px-5 py-8 text-center text-[12px] text-ink-400">Aucune commande</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
