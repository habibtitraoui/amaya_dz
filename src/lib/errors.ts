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

export function toActionState(error: unknown): ActionState {
  if (isAppError(error)) {
    return { ok: false, error: error.message, code: error.code, field: error.details?.field as string | undefined };
  }
  console.error('[action] unexpected error', error);
  return { ok: false, error: 'Unexpected error', code: 'INTERNAL' };
}
