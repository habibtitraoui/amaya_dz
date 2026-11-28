import 'server-only';
import { prisma } from '@/lib/prisma';

export type AuditInput = {
  actorId?: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

/**
 * Every administrative mutation goes through here. Audit rows are append-only:
 * business records may be deleted, but their audit trail is retained.
 */
export async function logAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: (input.metadata ?? undefined) as never,
      },
    });
  } catch (error) {
    // Auditing must never break the business operation, but it must be visible.
    console.error('[audit] failed to persist entry', input.action, error);
  }
}
