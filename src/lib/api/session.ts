import 'server-only';
import { prisma } from '@/lib/prisma';
import { verifySession, signSession, type SessionPayload } from '@/lib/session';
import { getCookie } from '@/lib/api/http';
import type { Tier } from '@/lib/pricing';

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'CUSTOMER';
  tier: Tier;
  status: 'ACTIVE' | 'SUSPENDED';
  permissions: Record<string, boolean> | null;
};

/**
 * HttpOnly cookie OR `Authorization: Bearer <jwt>` — the same signed token,
 * so the storefront and external API clients share one auth mechanism.
 */
export async function userFromRequest(request: Request): Promise<ApiUser | null> {
  // An explicit `Authorization: Bearer` always wins over the ambient cookie:
  // API clients must never be silently downgraded to whoever the browser
  // happens to be signed in as.
  let token: string | null = null;
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) token = header.slice(7).trim();
  if (!token) token = getCookie(request, 'amaya_session') ?? null;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, role: true, tier: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') return null;
  const permissions = await prisma.user
    .findUnique({ where: { id: user.id }, select: { permissions: true } })
    .then((row) => (row?.permissions as Record<string, boolean> | null) ?? null)
    .catch(() => null);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tier: (user.tier ?? 'RETAIL') as Tier,
    status: user.status,
    permissions,
  };
}

export async function sessionTokenFor(payload: SessionPayload): Promise<string> {
  return signSession(payload);
}
