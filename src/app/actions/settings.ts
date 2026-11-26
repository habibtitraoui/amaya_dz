'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { AppError, toActionState, type ActionState } from '@/lib/errors';
import { logAudit } from '@/lib/audit';

/** Site settings are administrator-only and always audit-logged. */
export async function saveSettingsAction(values: Record<string, string | number | null>): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'Administrator only', 403);

    const entries = Object.entries(values);
    if (entries.length === 0) return { ok: true };

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.siteSetting.upsert({
          where: { key },
          create: { key, value: value as never },
          update: { value: value as never },
        }),
      ),
    );

    await logAudit({
      actorId: user.id,
      actorName: user.name,
      action: 'settings.update',
      entityType: 'SiteSetting',
      summary: `Updated ${entries.length} setting(s)`,
      metadata: Object.fromEntries(entries),
    });

    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}
