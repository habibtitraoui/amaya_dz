import 'server-only';
import { prisma } from '@/lib/prisma';
import { getSession, type SessionPayload } from '@/lib/session';
import type { Tier } from '@/lib/pricing';

export type StaffRole = 'ADMIN' | 'SUPERVISOR';

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'CUSTOMER';
  tier: Tier;
  status: 'ACTIVE' | 'SUSPENDED';
  permissions: Record<string, boolean> | null;
};

const PERMISSION_DEFAULTS: Record<string, boolean> = {
  manageProducts: true,
  manageCategories: true,
  manageStock: true,
  managePrices: true,
  manageCustomers: true,
  manageOrders: true,
  issueInvoices: true,
  viewReports: true,
};

/**
 * Resolve the current user from the signed session cookie *and* the database.
 * Every request re-reads the account so a suspension, tier change or password
 * reset takes effect immediately — the JWT alone is never trusted for access.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tier: true,
      status: true,
      permissions: true,
    },
  });
  if (!user || user.status !== 'ACTIVE') return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tier: (user.tier ?? 'RETAIL') as Tier,
    status: user.status,
    permissions: (user.permissions as Record<string, boolean> | null) ?? null,
  };
}

export async function getTier(): Promise<Tier> {
  const user = await getCurrentUser();
  if (!user) return 'RETAIL';
  return user.tier;
}

export function isStaff(user: CurrentUser | null): boolean {
  return !!user && (user.role === 'ADMIN' || user.role === 'SUPERVISOR');
}

export function isAdmin(user: CurrentUser | null): boolean {
  return !!user && user.role === 'ADMIN';
}

/** Supervisor permission check, admin always passes. */
export function can(user: CurrentUser | null, permission: keyof typeof PERMISSION_DEFAULTS): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'SUPERVISOR') return false;
  const defaults = PERMISSION_DEFAULTS[permission] ?? false;
  if (!user.permissions) return defaults;
  return user.permissions[permission] ?? defaults;
}

export const SUPERVISOR_PERMISSION_KEYS = Object.keys(PERMISSION_DEFAULTS);

export type { SessionPayload };
