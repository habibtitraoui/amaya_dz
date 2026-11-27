'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, CloudUpload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Report = {
  uploaded: number;
  assets: number;
  categories: { total: number; updated: number; missing: string[] };
  hero: string | null;
  productImages: { total: number; updated: number; missing: string[] };
  variants: { total: number; updated: number; missing: string[] };
  remaining: number;
};

/**
 * One-click backfill of the bundled demo artwork to Object Storage.
 * Idempotent: already-migrated rows (absolute URLs) are left untouched, so the
 * card is safe to click again after adding new demo data.
 */
export function CatalogMigrationCard() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [report, setReport] = React.useState<Report | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setReport(null);
    try {
      const response = await fetch('/api/admin/catalog-migration', { method: 'POST' });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok) {
        setReport(payload.report as Report);
        router.refresh();
      } else {
        setError(payload?.error?.message ?? 'La migration a échoué.');
      }
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setPending(false);
    }
  }

  const totalUpdated = report
    ? report.categories.updated + report.productImages.updated + report.variants.updated
    : 0;

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-[13px] font-extrabold text-ink-900">Images du catalogue</h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
            Copie les visuels livrés avec le projet (produits et catégories) vers Object Storage puis
            remplace les anciens chemins <code className="text-ink-700">/products/…</code> par les
            nouvelles URL publiques. Sans effet sur les images déjà téléversées ; vous pouvez relancer
            cette action à tout moment.
          </p>
        </div>
        <Button type="button" onClick={run} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
          Migrer les images
        </Button>
      </div>

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-[11.5px] text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      {report && (
        <div className="mt-4 space-y-3">
          <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" />
            {report.uploaded} objet(s) téléversé(s) · {totalUpdated} référence(s) mise(s) à jour
          </p>
          <dl className="grid gap-2 text-[11.5px] text-ink-600 sm:grid-cols-3">
            <div className="rounded-xl bg-ink-50 px-3 py-2">
              <dt className="font-semibold text-ink-900">Catégories</dt>
              <dd>
                {report.categories.updated} / {report.categories.total} mises à jour
              </dd>
            </div>
            <div className="rounded-xl bg-ink-50 px-3 py-2">
              <dt className="font-semibold text-ink-900">Images produits</dt>
              <dd>
                {report.productImages.updated} / {report.productImages.total} mises à jour
              </dd>
            </div>
            <div className="rounded-xl bg-ink-50 px-3 py-2">
              <dt className="font-semibold text-ink-900">Variantes</dt>
              <dd>
                {report.variants.updated} / {report.variants.total} mises à jour
              </dd>
            </div>
          </dl>
          {report.hero && (
            <p className="rounded-xl bg-ink-50 px-3 py-2 text-[11.5px] text-ink-600">
              Image de bannière mise à jour. Modifiable dans la section « Page d’accueil » ci-dessus.
            </p>
          )}
          {report.remaining > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
              {report.remaining} référence(s) pointent encore vers un chemin local — vérifiez que le
              fichier correspondant existe dans <code>assets/catalog/</code>.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
