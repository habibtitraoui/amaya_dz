'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Plus, Trash2, Save, AlertTriangle, ExternalLink } from 'lucide-react';
import { saveProductAction } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/utils';

type Variant = {
  id?: string;
  sku: string;
  colorNameFr: string;
  colorNameAr: string;
  colorNameEn: string;
  colorCode: string;
  image: string;
  stockQuantity: number;
};

export type ProductFormValues = {
  id?: string;
  sku: string;
  categoryId: string;
  retailPrice: string;
  wholesalePrice: string;
  superWholesalePrice: string;
  wholesaleMinQty: number;
  superWholesaleMinQty: number;
  status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'HIDDEN' | 'ARCHIVED';
  isFeatured: boolean;
  translations: { locale: 'AR' | 'FR' | 'EN'; name: string; description: string }[];
  images: { url: string; alt?: string }[];
  variants: Variant[];
};

export function ProductForm({
  initial,
  categories,
  slug,
}: {
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  slug?: string;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<ProductFormValues>(initial);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'FR' | 'AR' | 'EN'>('FR');

  const translation = (locale: 'AR' | 'FR' | 'EN') =>
    form.translations.find((t) => t.locale === locale) ?? { locale, name: '', description: '' };

  function setTranslation(locale: 'AR' | 'FR' | 'EN', key: 'name' | 'description', value: string) {
    setForm((current) => {
      const exists = current.translations.some((t) => t.locale === locale);
      return {
        ...current,
        translations: exists
          ? current.translations.map((t) => (t.locale === locale ? { ...t, [key]: value } : t))
          : [...current.translations, { locale, name: '', description: '', [key]: value }],
      };
    });
  }

  function setVariant(index: number, key: keyof Variant, value: string | number) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, i) => (i === index ? { ...variant, [key]: value } : variant)),
    }));
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [
        ...current.variants,
        {
          sku: `${current.sku || 'AMY'}-${String(current.variants.length + 1).padStart(2, '0')}`,
          colorNameFr: '',
          colorNameAr: '',
          colorNameEn: '',
          colorCode: '#111111',
          image: '',
          stockQuantity: 0,
        },
      ],
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await saveProductAction(
        {
          ...form,
          images: form.images.filter((image) => image.url.trim()),
          variants: form.variants.map((variant) => ({ ...variant, image: variant.image || null })),
        },
        form.id,
      );
      if (result.ok) {
        router.push('/admin/products');
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erreur');
    } finally {
      setPending(false);
    }
  }

  const marginCents =
    Math.round((Number(form.retailPrice) - Number(form.wholesalePrice)) * 100);

  return (
    <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* pricing */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Prix (DA)</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prix détail" required hint="Min. quantité 1">
              <Input type="number" min="0" step="10" value={form.retailPrice} onChange={(e) => setForm((c) => ({ ...c, retailPrice: e.target.value }))} required dir="ltr" />
            </Field>
            <Field label="Prix gros" required>
              <Input type="number" min="0" step="10" value={form.wholesalePrice} onChange={(e) => setForm((c) => ({ ...c, wholesalePrice: e.target.value }))} required dir="ltr" />
            </Field>
            <Field label="Prix super gros" required>
              <Input type="number" min="0" step="10" value={form.superWholesalePrice} onChange={(e) => setForm((c) => ({ ...c, superWholesalePrice: e.target.value }))} required dir="ltr" />
            </Field>
            <Field label="Qté min. gros" required>
              <Input type="number" min="1" value={form.wholesaleMinQty} onChange={(e) => setForm((c) => ({ ...c, wholesaleMinQty: Number(e.target.value) }))} required dir="ltr" />
            </Field>
            <Field label="Qté min. super gros" required>
              <Input type="number" min="1" value={form.superWholesaleMinQty} onChange={(e) => setForm((c) => ({ ...c, superWholesaleMinQty: Number(e.target.value) }))} required dir="ltr" />
            </Field>
            <div className="rounded-xl bg-ink-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Marge retail/gros</p>
              <p className={cn('text-[15px] font-extrabold tabular-nums', marginCents >= 0 ? 'text-emerald-600' : 'text-red-600')} dir="ltr">
                {(marginCents / 100).toFixed(2)} DA
              </p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-[11px] text-ink-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            Toute modification de prix est enregistrée dans l’historique. Les commandes et factures existantes ne sont jamais recalculées.
          </p>
        </section>

        {/* translations */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Contenu multilingue</h2>
            <div className="flex gap-1 rounded-full bg-ink-100 p-0.5">
              {(['FR', 'AR', 'EN'] as const).map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => setTab(locale)}
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-bold transition-colors',
                    tab === locale ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500',
                  )}
                >
                  {locale === 'FR' ? 'Français' : locale === 'AR' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>
          </div>
          <div className={cn('space-y-3', tab === 'AR' && 'font-arabic')} dir={tab === 'AR' ? 'rtl' : 'ltr'}>
            <Field label="Nom du produit" required={tab === 'FR'}>
              <Input value={translation(tab).name} onChange={(e) => setTranslation(tab, 'name', e.target.value)} required={tab === 'FR'} />
            </Field>
            <Field label="Description">
              <Textarea value={translation(tab).description} onChange={(e) => setTranslation(tab, 'description', e.target.value)} rows={4} />
            </Field>
          </div>
        </section>

        {/* variants */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Variantes (couleurs)</h2>
            <button type="button" onClick={addVariant} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-brand-600 hover:underline">
              <Plus className="h-3.5 w-3.5" /> Ajouter une couleur
            </button>
          </div>
          <div className="space-y-2.5">
            {form.variants.map((variant, index) => (
              <div key={variant.id ?? `new-${index}`} className="grid gap-2 rounded-xl border border-ink-100 p-3 sm:grid-cols-[40px_1fr_1fr_1fr_90px_80px_32px] sm:items-end">
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">Couleur</label>
                  <input
                    type="color"
                    value={variant.colorCode}
                    onChange={(e) => setVariant(index, 'colorCode', e.target.value)}
                    className="h-9 w-full cursor-pointer rounded-lg border border-ink-200 bg-white p-0.5"
                    aria-label="Code couleur"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">Nom FR</label>
                  <Input value={variant.colorNameFr} onChange={(e) => setVariant(index, 'colorNameFr', e.target.value)} className="h-9 text-[12px]" />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">Nom AR</label>
                  <Input value={variant.colorNameAr} onChange={(e) => setVariant(index, 'colorNameAr', e.target.value)} className="h-9 text-[12px]" dir="rtl" />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">Nom EN</label>
                  <Input value={variant.colorNameEn} onChange={(e) => setVariant(index, 'colorNameEn', e.target.value)} className="h-9 text-[12px]" />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">SKU</label>
                  <Input value={variant.sku} onChange={(e) => setVariant(index, 'sku', e.target.value)} className="h-9 text-[11px]" dir="ltr" />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">Stock</label>
                  <Input type="number" min="0" value={variant.stockQuantity} onChange={(e) => setVariant(index, 'stockQuantity', Number(e.target.value))} className="h-9 text-[12px]" dir="ltr" />
                </div>
                <button
                  type="button"
                  onClick={() => setForm((c) => ({ ...c, variants: c.variants.filter((_, i) => i !== index) }))}
                  className="grid h-9 w-8 place-items-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove variant"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {form.variants.length === 0 && (
              <p className="rounded-xl border border-dashed border-ink-200 py-6 text-center text-[11.5px] text-ink-400">
                Aucune variante — ajoutez au moins une couleur.
              </p>
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Informations</h2>
          <div className="space-y-3">
            <Field label="SKU / Référence" required>
              <Input value={form.sku} onChange={(e) => setForm((c) => ({ ...c, sku: e.target.value.toUpperCase() }))} required dir="ltr" />
            </Field>
            <Field label="Catégorie" required>
              <Select value={form.categoryId} onChange={(e) => setForm((c) => ({ ...c, categoryId: e.target.value }))} required>
                <option value="">—</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Statut">
              <Select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as ProductFormValues['status'] }))}>
                <option value="AVAILABLE">Disponible</option>
                <option value="OUT_OF_STOCK">Rupture de stock</option>
                <option value="HIDDEN">Masqué</option>
                <option value="ARCHIVED">Archivé</option>
              </Select>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-ink-700">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm((c) => ({ ...c, isFeatured: e.target.checked }))}
                className="h-4 w-4 rounded border-ink-300 accent-brand-500"
              />
              Produit vedette
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Images</h2>
          <div className="space-y-2">
            {form.images.map((image, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                  {image.url && <Image src={image.url} alt="" fill sizes="40px" className="object-cover" unoptimized />}
                </div>
                <Input
                  value={image.url}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, images: c.images.map((img, i) => (i === index ? { ...img, url: e.target.value } : img)) }))
                  }
                  placeholder="/products/..."
                  className="h-9 text-[11px]"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setForm((c) => ({ ...c, images: c.images.filter((_, i) => i !== index) }))}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove image"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setForm((c) => ({ ...c, images: [...c.images, { url: '' }] }))}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-200 py-2 text-[11px] font-bold text-ink-500 hover:border-brand-300 hover:text-brand-600"
            >
              <Plus className="h-3 w-3" /> Ajouter une image
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
            Collez une URL (ImageKit, CDN…) ou un chemin local commençant par <span className="font-mono">/products/</span>.
          </p>
        </section>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-700">{error}</p>}

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={pending} size="md">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {initial.id ? 'Enregistrer les modifications' : 'Créer le produit'}
          </Button>
          {slug && (
            <a href={`/products/${slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-ink-500 hover:text-brand-600">
              <ExternalLink className="h-3 w-3" /> Voir sur la boutique
            </a>
          )}
        </div>
      </aside>
    </form>
  );
}
