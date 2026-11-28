'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { AppError, toActionState, type ActionState } from '@/lib/errors';
import { logAudit } from '@/lib/audit';
import { normalizeSocialUrl, SOCIAL_LABELS, type SocialPlatform } from '@/lib/contact';

const SOCIAL_KEY_TO_PLATFORM: Record<string, SocialPlatform> = {
  'contact.instagram': 'instagram',
  'contact.facebook': 'facebook',
  'contact.tiktok': 'tiktok',
  'contact.whatsapp': 'whatsapp',
  'contact.youtube': 'youtube',
  'contact.x': 'x',
};

const emailSchema = z.string().email();

/** Site settings are administrator-only and always audit-logged. */
export async function saveSettingsAction(values: Record<string, string | number | null>): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'Administrator only', 403);

    const rawEntries = Object.entries(values);
    if (rawEntries.length === 0) return { ok: true };

    const entries: [string, string | number | null][] = [];
    for (const [key, rawValue] of rawEntries) {
      if (rawValue === null) {
        entries.push([key, null]);
        continue;
      }

      if (typeof rawValue === 'number') {
        if (!Number.isFinite(rawValue) || rawValue < 0) {
          throw new AppError('VALIDATION', `Invalid numeric value for ${key}`);
        }
        entries.push([key, rawValue]);
        continue;
      }

      const trimmed = String(rawValue).trim();
      if (!trimmed) {
        entries.push([key, null]);
        continue;
      }

      if (key === 'contact.email') {
        if (!emailSchema.safeParse(trimmed).success) {
          throw new AppError('VALIDATION', 'Invalid contact email address');
        }
        entries.push([key, trimmed]);
        continue;
      }

      if (key in SOCIAL_KEY_TO_PLATFORM) {
        const platform = SOCIAL_KEY_TO_PLATFORM[key];
        const normalized = normalizeSocialUrl(platform, trimmed);
        if (!normalized) {
          throw new AppError('VALIDATION', `Invalid ${SOCIAL_LABELS[platform]} link`);
        }
        entries.push([key, trimmed]);
        continue;
      }

      if (trimmed.length > 2000) {
        throw new AppError('VALIDATION', `Value too long for ${key}`);
      }
      entries.push([key, trimmed]);
    }

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
