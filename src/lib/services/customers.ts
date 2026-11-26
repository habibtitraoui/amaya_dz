import 'server-only';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { hashPassword, generateTemporaryPassword } from '@/lib/password';
import { logAudit } from '@/lib/audit';

export type CustomerInput = {
  name: string;
  email: string;
  phone?: string;
  tier: 'WHOLESALE' | 'SUPER_WHOLESALE';
  businessName?: string;
  address?: string;
  city?: string;
  wilaya?: string;
  notes?: string;
  password?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
};

export type Actor = { id: string; name: string };

export async function createCustomer(input: CustomerInput, actor: Actor) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('CONFLICT', 'This email is already registered');
  if (input.tier !== 'WHOLESALE' && input.tier !== 'SUPER_WHOLESALE') {
    throw new AppError('VALIDATION', 'Customers must be wholesale or super-wholesale');
  }

  const temporaryPassword = input.password?.trim() || generateTemporaryPassword();
  if (temporaryPassword.length < 8) throw new AppError('VALIDATION', 'Password must be at least 8 characters');
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        passwordHash,
        role: 'CUSTOMER',
        tier: input.tier,
        status: input.status ?? 'ACTIVE',
        notes: input.notes?.trim() || null,
        createdById: actor.id,
        profile: {
          create: {
            businessName: input.businessName?.trim() || null,
            address: input.address?.trim() || null,
            city: input.city?.trim() || null,
            wilaya: input.wilaya?.trim() || null,
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        action: 'customer.create',
        entityType: 'User',
        entityId: created.id,
        summary: `${input.tier} account created for ${created.name} (${created.email})`,
      },
    });
    return created;
  });

  return { user, temporaryPassword };
}

export async function updateCustomer(
  userId: string,
  input: Omit<CustomerInput, 'password'> & { resetPassword?: boolean },
  actor: Actor,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'Customer not found');
  if (user.role !== 'CUSTOMER') throw new AppError('FORBIDDEN', 'This endpoint only manages customers');

  const email = input.email.trim().toLowerCase();
  if (email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) throw new AppError('CONFLICT', 'This email is already registered');
  }

  const temporaryPassword = input.resetPassword ? generateTemporaryPassword() : null;
  const passwordHash = temporaryPassword ? await hashPassword(temporaryPassword) : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.user.update({
      where: { id: userId },
      data: {
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
        tier: input.tier,
        status: input.status ?? user.status,
        notes: input.notes?.trim() || null,
        ...(passwordHash ? { passwordHash } : {}),
        profile: {
          upsert: {
            create: {
              businessName: input.businessName?.trim() || null,
              address: input.address?.trim() || null,
              city: input.city?.trim() || null,
              wilaya: input.wilaya?.trim() || null,
            },
            update: {
              businessName: input.businessName?.trim() || null,
              address: input.address?.trim() || null,
              city: input.city?.trim() || null,
              wilaya: input.wilaya?.trim() || null,
            },
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        action: 'customer.update',
        entityType: 'User',
        entityId: userId,
        summary: `Account ${changed.email} updated${temporaryPassword ? ' (password reset)' : ''}`,
        metadata: { tier: changed.tier, status: changed.status } as never,
      },
    });
    return changed;
  });

  return { user: updated, temporaryPassword };
}

export async function suspendCustomer(userId: string, status: 'ACTIVE' | 'SUSPENDED', actor: Actor) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'Customer not found');
  if (user.role !== 'CUSTOMER') throw new AppError('FORBIDDEN', 'Only customers can be suspended');
  const updated = await prisma.user.update({ where: { id: userId }, data: { status } });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: 'customer.status',
    entityType: 'User',
    entityId: userId,
    summary: `${user.email} → ${status}`,
  });
  return updated;
}

export async function listCustomers(options: {
  search?: string;
  tier?: 'WHOLESALE' | 'SUPER_WHOLESALE';
  status?: 'ACTIVE' | 'SUSPENDED';
  page?: number;
  perPage?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(50, options.perPage ?? 20);
  const where: Record<string, unknown> = { role: 'CUSTOMER' };
  if (options.tier) where.tier = options.tier;
  if (options.status) where.status = options.status;
  if (options.search?.trim()) {
    const term = options.search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term, mode: 'insensitive' } },
    ];
  }
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where: where as never,
      include: { profile: true, _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where: where as never }),
  ]);
  return { rows, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getCustomerDetail(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, role: 'CUSTOMER' },
    include: {
      profile: true,
      orders: { orderBy: { createdAt: 'desc' }, take: 10, include: { items: true } },
      _count: { select: { orders: true } },
    },
  });
}
