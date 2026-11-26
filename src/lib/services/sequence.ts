import 'server-only';

/**
 * Monotonic counters (order numbers, invoice numbers).
 *
 * `UPDATE ... RETURNING` takes a row lock on PostgreSQL/PGlite, so two
 * concurrent confirmations cannot share a number. The caller MUST pass the
 * transaction client when it is already inside `prisma.$transaction`: using
 * the global client there would open a second connection and deadlock.
 */
export type SequenceClient = {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  sequence: {
    upsert: (args: {
      where: { key: string };
      create: { key: string; value?: number };
      update: Record<string, never>;
    }) => Promise<unknown>;
  };
};

export async function nextSequence(key: string, client?: SequenceClient): Promise<number> {
  const db = (client ?? (await import('@/lib/prisma')).prisma) as unknown as SequenceClient;
  await db.sequence.upsert({ where: { key }, create: { key, value: 0 }, update: {} });
  const rows = await db.$queryRawUnsafe<{ value: number }[]>(
    'UPDATE "Sequence" SET "value" = "value" + 1 WHERE "key" = $1 RETURNING "value"',
    key,
  );
  return Number(rows[0]?.value ?? 1);
}

export function formatOrderNumber(seq: number, date = new Date()): string {
  const year = date.getFullYear();
  return `AMY-${year}-${String(seq).padStart(5, '0')}`;
}

export function formatInvoiceNumber(seq: number, date = new Date()): string {
  const year = date.getFullYear();
  return `FAC-${year}-${String(seq).padStart(5, '0')}`;
}
