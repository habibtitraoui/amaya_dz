import { Loader2 } from 'lucide-react';

export function PageLoading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="flex min-h-64 items-center justify-center p-8">
      <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-brand-500" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
