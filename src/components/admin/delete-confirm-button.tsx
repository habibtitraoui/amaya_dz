'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, X } from 'lucide-react';
import {
  deleteCategoryAction,
  deleteOrderAction,
  deleteProductAction,
} from '@/app/actions/admin';

export type DeletableEntity = 'product' | 'category' | 'order';

type DeleteLabels = {
  ariaLabel: string;
  title: string;
  message: string;
  confirm: string;
  cancel: string;
  deleting: string;
  error: string;
};

export function DeleteConfirmButton({
  entity,
  entityId,
  entityName,
  labels,
}: {
  entity: DeletableEntity;
  entityId: string;
  entityName: string;
  labels: DeleteLabels;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const titleId = React.useId();
  const messageId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, pending]);

  function showConfirmation() {
    setError(null);
    setOpen(true);
  }

  async function confirmDelete() {
    setPending(true);
    setError(null);
    try {
      const result =
        entity === 'product'
          ? await deleteProductAction({ id: entityId })
          : entity === 'category'
            ? await deleteCategoryAction({ id: entityId })
            : await deleteOrderAction({ id: entityId });

      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error || labels.error);
      }
    } catch {
      setError(labels.error);
    } finally {
      setPending(false);
    }
  }

  const message = labels.message.replace('{name}', entityName);

  return (
    <>
      <button
        type="button"
        onClick={showConfirmation}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        aria-label={labels.ariaLabel}
        title={labels.ariaLabel}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-ink-950/55 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                  <Trash2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 id={titleId} className="text-[15px] font-extrabold text-ink-900">{labels.title}</h2>
                  <p id={messageId} className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">{message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-800 disabled:opacity-50"
                aria-label={labels.cancel}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-700">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-full px-4 py-2 text-[12px] font-semibold text-ink-500 transition-colors hover:bg-ink-50 disabled:opacity-50"
              >
                {labels.cancel}
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {pending ? labels.deleting : labels.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
