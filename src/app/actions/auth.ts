'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword, hashPassword } from '@/lib/password';
import { clearSessionCookie, setSessionCookie, getSession } from '@/lib/session';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export type LoginState = { ok: false; error: 'credentials' | 'suspended' | 'validation' } | { ok: true };

const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(1).max(200),
});

/**
 * Password login. Always compares against the hash, and always re-reads the
 * account status before issuing a cookie.
 */
export async function loginAction(input: unknown): Promise<LoginState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Constant-ish time behaviour: run a verification against a dummy hash.
    await verifyPassword(parsed.data.password, 'scrypt$00$00');
    return { ok: false, error: 'credentials' };
  }
  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return { ok: false, error: 'credentials' };
  if (user.status !== 'ACTIVE') return { ok: false, error: 'suspended' };

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setSessionCookie({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tier: user.tier,
  });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
    summary: `${user.email} signed in (${user.role})`,
  });

  return { ok: true };
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await logAudit({
      actorId: session.sub,
      actorName: session.name,
      action: 'auth.logout',
      entityType: 'User',
      entityId: session.sub,
      summary: `${session.email} signed out`,
    });
  }
  await clearSessionCookie();
  redirect('/');
}

const passwordSchema = z
  .object({
    current: z.string().min(1),
    next: z.string().min(8).max(200),
    confirm: z.string().min(8).max(200),
  })
  .refine((value) => value.next === value.confirm, { message: 'mismatch' });

export type PasswordState = { ok: true } | { ok: false; error: 'wrong' | 'mismatch' | 'validation' };

export async function changePasswordAction(input: unknown): Promise<PasswordState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'validation' };
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message === 'mismatch' ? 'mismatch' : 'validation' };
  }
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return { ok: false, error: 'validation' };
  const valid = await verifyPassword(parsed.data.current, record.passwordHash);
  if (!valid) return { ok: false, error: 'wrong' };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.next) },
  });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: 'auth.password',
    entityType: 'User',
    entityId: user.id,
    summary: 'Password changed by account owner',
  });
  return { ok: true };
}
