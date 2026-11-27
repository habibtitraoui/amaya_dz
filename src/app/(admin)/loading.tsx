import { PageLoading } from '@/components/ui/page-loading';

// The admin UI is French-only — it stays LTR regardless of the visitor locale.
export default function Loading() {
  return <PageLoading label="Chargement…" />;
}
