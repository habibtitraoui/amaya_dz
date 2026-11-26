import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { SupervisorManager } from '@/components/admin/supervisor-manager';

export const dynamic = 'force-dynamic';

export default async function AdminSupervisorsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/admin');

  const supervisors = await prisma.user.findMany({
    where: { role: 'SUPERVISOR' },
    include: { _count: { select: { auditLogs: true, invoices: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <SupervisorManager
      supervisors={supervisors.map((supervisor) => ({
        id: supervisor.id,
        name: supervisor.name,
        email: supervisor.email,
        status: supervisor.status,
        permissions: (supervisor.permissions as Record<string, boolean> | null) ?? null,
        createdAt: supervisor.createdAt.toISOString(),
        lastLoginAt: supervisor.lastLoginAt?.toISOString() ?? null,
        actionCount: supervisor._count.auditLogs,
        invoiceCount: supervisor._count.invoices,
      }))}
    />
  );
}
