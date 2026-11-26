'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(24).optional().default(''),
  businessName: z.string().trim().max(160).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  wilaya: z.string().trim().max(80).optional().default(''),
});

/**
 * A customer can only edit their own contact details. Tier, role, status and
 * email are deliberately NOT accepted by this action.
 */
export async function updateOwnProfileAction(input: unknown) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'CUSTOMER') return { ok: false as const, error: 'Unauthorized' };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: 'Invalid data' };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      profile: {
        upsert: {
          create: {
            businessName: parsed.data.businessName || null,
            address: parsed.data.address || null,
            city: parsed.data.city || null,
            wilaya: parsed.data.wilaya || null,
          },
          update: {
            businessName: parsed.data.businessName || null,
            address: parsed.data.address || null,
            city: parsed.data.city || null,
            wilaya: parsed.data.wilaya || null,
          },
        },
      },
    },
  });

  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: 'account.update',
    entityType: 'User',
    entityId: user.id,
    summary: 'Customer updated their own contact details',
  });

  revalidatePath('/account');
  return { ok: true as const };
}

export async function cancelOwnOrderAction(orderId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'CUSTOMER') return { ok: false as const, error: 'Unauthorized' };
  const { cancelOwnOrder } = await import('@/lib/services/orders');
  try {
    await cancelOwnOrder(orderId, user.id, user.name);
    revalidatePath('/account/orders');
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : 'Could not cancel' };
  }
}
