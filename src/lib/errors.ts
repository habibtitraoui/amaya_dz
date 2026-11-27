/**
 * Domain errors carry a stable machine code plus a localisable message key.
 * Services throw these; server actions and route handlers translate them into
 * a JSON envelope / form error instead of leaking stack traces.
 */
export type AppErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'STOCK'
  | 'MIN_QTY'
  | 'TRIER'
  | 'INTERNAL';

export class AppError extends Error {
  code: AppErrorCode;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: AppErrorCode, message: string, status?: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status ?? defaultStatus(code);
    this.details = details;
  }
}

function defaultStatus(code: AppErrorCode): number {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
    case 'STOCK':
    case 'MIN_QTY':
    case 'TRIER':
      return 409;
    case 'VALIDATION':
      return 422;
    default:
      return 500;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function errorMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}

export type ActionState =
  | { ok: true; message?: string; data?: unknown }
  | { ok: false; error: string; code?: AppErrorCode; field?: string };

/**
 * A foreign-key violation means the caller referenced a row that does not
 * exist (e.g. a category id from a stale form). That is a bad request, not a
 * server fault, so surface it as a validation error instead of a 500.
 */
function foreignKeyError(error: unknown): AppError | null {
  const e = error as { code?: string; message?: string; meta?: { field_name?: string; constraint?: string } } | null;
  if (e?.code !== 'P2003') return null;
  // Prisma 7 does not always fill meta.field_name, but the driver reports the
  // constraint name both in meta and in the message.
  const haystack = `${e.meta?.field_name ?? ''} ${e.meta?.constraint ?? ''} ${e.message ?? ''}`.toLowerCase();
  if (haystack.includes('category')) {
    return new AppError('VALIDATION', 'Unknown category: the selected category no longer exists');
  }
  return new AppError('VALIDATION', 'A referenced record does not exist');
}

export function toActionState(error: unknown): ActionState {
  if (isAppError(error)) {
    return { ok: false, error: error.message, code: error.code, field: error.details?.field as string | undefined };
  }
  const fk = foreignKeyError(error);
  if (fk) return { ok: false, error: fk.message, code: fk.code };
  console.error('[action] unexpected error', error);
  return { ok: false, error: 'Unexpected error', code: 'INTERNAL' };
}
