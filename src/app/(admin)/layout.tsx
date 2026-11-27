import { redirect } from 'next/navigation';
import { getCurrentUser, isStaff, can } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isStaff(user)) redirect('/account');

  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const permissions = {
    manageProducts: can(user, 'manageProducts'),
    manageCategories: can(user, 'manageCategories'),
    manageStock: can(user, 'manageStock'),
    managePrices: can(user, 'managePrices'),
    manageCustomers: can(user, 'manageCustomers'),
    manageOrders: can(user, 'manageOrders'),
    issueInvoices: can(user, 'issueInvoices'),
    viewReports: can(user, 'viewReports'),
  };

  return (
    <AdminShell
      locale={locale}
      labels={{ nav: dict.admin.nav, shell: dict.admin.shell }}
      user={{ name: user.name, email: user.email, role: user.role }}
      permissions={permissions}
    >
      {children}
    </AdminShell>
  );
}
