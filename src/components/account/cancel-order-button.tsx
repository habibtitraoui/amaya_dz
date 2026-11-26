'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, XCircle } from 'lucide-react';
import { cancelOwnOrderAction } from '@/app/actions/account';

export function CancelOrderButton({
  orderId,
  labels,
}: {
  orderId: string;
  labels: { cancel: string; confirm: string; error: string };
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function cancel() {
    if (!window.confirm(`${labels.confirm} ?`)) return;
    setPending(true);
    setError(null);
    try {
      const result = await cancelOwnOrderAction(orderId);
      if (result.ok) router.refresh();
      else setError(result.error ?? labels.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3.5 text-[12.5px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
        {labels.cancel}
      </button>
    </div>
  );
}
