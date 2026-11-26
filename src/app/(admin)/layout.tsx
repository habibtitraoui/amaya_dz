import { redirect } from 'next/navigation';
import { getCurrentUser, isStaff, can } from '@/lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isStaff(user)) redirect('/account');

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
      user={{ name: user.name, email: user.email, role: user.role }}
      permissions={permissions}
    >
      {children}
    </AdminShell>
  );
}
