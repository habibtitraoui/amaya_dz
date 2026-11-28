'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Plus, Trash2, Save, AlertTriangle, ExternalLink, Upload, Star } from 'lucide-react';
import { saveProductAction } from '@/app/actions/admin';
import { releaseStagedImage, stageImageFile, uploadStagedImage } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import type { Dictionary, Locale } from '@/lib/i18n';
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
  images: { url: string; alt?: string; /** Present only for locally staged files — uploaded on submit. */ file?: File }[];
  variants: Variant[];
};

const MAX_IMAGES = 12;

export function ProductForm({
  initial,
  categories,
  slug,
  locale = 'fr',
  labels,
  productStatusLabels,
  currencyLabel = 'DA',
}: {
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  slug?: string;
  locale?: Locale;
  labels: Dictionary['admin']['products']['form'];
  productStatusLabels: Dictionary['productStatus'];
  currencyLabel?: string;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<ProductFormValues>(initial);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'FR' | 'AR' | 'EN'>(
    locale === 'ar' ? 'AR' : locale === 'en' ? 'EN' : 'FR',
  );
  // `null` = idle, `'new'` = staging a fresh image, number = staging a replacement for that row.
  const [uploading, setUploading] = React.useState<number | 'new' | null>(null);

  const translation = (code: 'AR' | 'FR' | 'EN') =>
    form.translations.find((t) => t.locale === code) ?? { locale: code, name: '', description: '' };

  function setTranslation(code: 'AR' | 'FR' | 'EN', key: 'name' | 'description', value: string) {
    setForm((current) => {
      const exists = current.translations.some((t) => t.locale === code);
      return {
        ...current,
        translations: exists
          ? current.translations.map((t) => (t.locale === code ? { ...t, [key]: value } : t))
          : [...current.translations, { locale: code, name: '', description: '', [key]: value }],
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
      // Staged (not-yet-uploaded) files go to Object Storage now, on submit —
      // never on file selection.
      const images: { url: string; alt?: string }[] = [];
      for (const image of form.images) {
        if (image.file) {
          const uploaded = await uploadStagedImage({ file: image.file, previewUrl: image.url });
          if (!uploaded.ok) {
            setError(labels.uploadFailed.replace('{error}', uploaded.error));
            setPending(false);
            return;
          }
          images.push({ url: uploaded.url, alt: image.alt });
        } else if (image.url.trim()) {
          images.push({ url: image.url.trim(), alt: image.alt });
        }
      }
      // Uploads succeeded: drop the local `file` refs so a failed save doesn't
      // re-upload them, and previews now point at the stored URLs.
      setForm((current) => ({ ...current, images }));
      const result = await saveProductAction(
        {
          ...form,
          images,
          variants: form.variants.map((variant) => ({ ...variant, image: variant.image || null })),
        },
        form.id,
      );
      if (result.ok) {
        for (const image of form.images) releaseStagedImage(image.file ? { file: image.file, previewUrl: image.url } : null);
        router.push('/admin/products');
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error');
    } finally {
      setPending(false);
    }
  }

  const marginCents =
    Math.round((Number(form.retailPrice) - Number(form.wholesalePrice)) * 100);

  async function handleUpload(files: File | File[], index: number | null) {
    const list = (Array.isArray(files) ? files : [files]).slice(0, MAX_IMAGES);
    if (list.length === 0) return;
    setUploading(index ?? 'new');
    setError(null);
    try {
      // No request leaves the browser here — files are only optimized and
      // kept in memory with a blob: preview URL until the form is submitted.
      if (index !== null) {
        // Replacing a specific row: only the first picked file is used.
        const staged = await stageImageFile(list[0]);
        if (!staged.ok) {
          setError(staged.error);
          return;
        }
        setForm((current) => ({
          ...current,
          images: current.images.map((image, i) => {
            if (i !== index) return image;
            releaseStagedImage(image.file ? { file: image.file, previewUrl: image.url } : null);
            return { ...image, url: staged.image.previewUrl, file: staged.image.file };
          }),
        }));
        return;
      }
      // Adding new images: stage every picked file at once.
      const results = await Promise.all(list.map((file) => stageImageFile(file)));
      const staged = results.filter((result) => result.ok).map((result) => ({ url: result.image.previewUrl, file: result.image.file }));
      const messages = [...new Set(results.filter((result) => !result.ok).map((result) => result.error))];
      const existingCount = form.images.filter((image) => image.url.trim()).length;
      const room = Math.max(0, MAX_IMAGES - existingCount);
      const accepted = staged.slice(0, room);
      for (const dropped of staged.slice(room)) URL.revokeObjectURL(dropped.url);
      if (staged.length > room) {
        messages.push(
          labels.maxImagesExceeded
            .replace('{max}', String(MAX_IMAGES))
            .replace('{dropped}', String(staged.length - room)),
        );
      }
      if (messages.length > 0) setError(messages.join(' — '));
      if (accepted.length > 0) {
        setForm((current) => ({
          ...current,
          images: [...current.images.filter((image) => image.url.trim()), ...accepted],
        }));
      }
    } finally {
      setUploading(null);
    }
  }

  // The first image is the one shown on the product card (sortOrder persists
  // the order). Starring moves an image to the front, in place of the old first.
  function setPrimary(index: number) {
    if (index <= 0) return;
    setForm((current) => {
      const target = current.images[index];
      if (!target) return current;
      return {
        ...current,
        images: [target, ...current.images.filter((_, i) => i !== index)],
      };
    });
  }

  function fileInput(index: number | null) {
    return (
      <input
        type="file"
        accept="image/webp,image/jpeg,image/png,image/avif"
        className="hidden"
        multiple={index === null}
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (picked.length === 0) return;
          void handleUpload(index === null ? picked : picked[0], index);
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* pricing */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{labels.pricesSection}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={labels.retailPrice} required hint={labels.retailHint}>
              <Input type="number" min="0" step="10" value={form.retailPrice} onChange={(e) => setForm((c) => ({ ...c, retailPrice: e.target.value }))} required dir="ltr" />
            </Field>
            <Field label={labels.wholesalePrice} required>
              <Input type="number" min="0" step="10" value={form.wholesalePrice} onChange={(e) => setForm((c) => ({ ...c, wholesalePrice: e.target.value }))} required dir="ltr" />
            </Field>
            <Field label={labels.superWholesalePrice} required>
              <Input type="number" min="0" step="10" value={form.superWholesalePrice} onChange={(e) => setForm((c) => ({ ...c, superWholesalePrice: e.target.value }))} required dir="ltr" />
            </Field>
            <Field label={labels.wholesaleMinQty} required>
              <Input type="number" min="1" value={form.wholesaleMinQty} onChange={(e) => setForm((c) => ({ ...c, wholesaleMinQty: Number(e.target.value) }))} required dir="ltr" />
            </Field>
            <Field label={labels.superWholesaleMinQty} required>
              <Input type="number" min="1" value={form.superWholesaleMinQty} onChange={(e) => setForm((c) => ({ ...c, superWholesaleMinQty: Number(e.target.value) }))} required dir="ltr" />
            </Field>
            <div className="rounded-xl bg-ink-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{labels.marginLabel}</p>
              <p className={cn('text-[15px] font-extrabold tabular-nums', marginCents >= 0 ? 'text-emerald-600' : 'text-red-600')} dir="ltr">
                {(marginCents / 100).toFixed(2)} {currencyLabel}
              </p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-[11px] text-ink-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            {labels.priceHistoryNote}
          </p>
        </section>

        {/* translations */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{labels.multilingualSection}</h2>
            <div className="flex gap-1 rounded-full bg-ink-100 p-0.5">
              {(['FR', 'AR', 'EN'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setTab(code)}
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-bold transition-colors',
                    tab === code ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500',
                  )}
                >
                  {code === 'FR' ? 'Français' : code === 'AR' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>
          </div>
          <div className={cn('space-y-3', tab === 'AR' && 'font-arabic')} dir={tab === 'AR' ? 'rtl' : 'ltr'}>
            <Field label={labels.productName} required={tab === 'FR'}>
              <Input value={translation(tab).name} onChange={(e) => setTranslation(tab, 'name', e.target.value)} required={tab === 'FR'} />
            </Field>
            <Field label={labels.description}>
              <Textarea value={translation(tab).description} onChange={(e) => setTranslation(tab, 'description', e.target.value)} rows={4} />
            </Field>
          </div>
        </section>

        {/* variants */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{labels.variantsSection}</h2>
            <button type="button" onClick={addVariant} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-brand-600 hover:underline">
              <Plus className="h-3.5 w-3.5" /> {labels.addColor}
            </button>
          </div>
          <div className="space-y-2.5">
            {form.variants.map((variant, index) => (
              <div key={variant.id ?? `new-${index}`} className="grid gap-2 rounded-xl border border-ink-100 p-3 sm:grid-cols-[40px_1fr_1fr_1fr_90px_80px_32px] sm:items-end">
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">{labels.colorLabel}</label>
                  <input
                    type="color"
                    value={variant.colorCode}
                    onChange={(e) => setVariant(index, 'colorCode', e.target.value)}
                    className="h-9 w-full cursor-pointer rounded-lg border border-ink-200 bg-white p-0.5"
                    aria-label={labels.colorCodeAria}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">{labels.nameFr}</label>
                  <Input value={variant.colorNameFr} onChange={(e) => setVariant(index, 'colorNameFr', e.target.value)} className="h-9 text-[12px]" dir="ltr" />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">{labels.nameAr}</label>
                  <Input value={variant.colorNameAr} onChange={(e) => setVariant(index, 'colorNameAr', e.target.value)} className="h-9 text-[12px]" dir="rtl" />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">{labels.nameEn}</label>
                  <Input value={variant.colorNameEn} onChange={(e) => setVariant(index, 'colorNameEn', e.target.value)} className="h-9 text-[12px]" dir="ltr" />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">{labels.sku}</label>
                  <Input value={variant.sku} onChange={(e) => setVariant(index, 'sku', e.target.value)} className="h-9 text-[11px]" dir="ltr" />
                </div>
                <div>
                  <label className="mb-1 block text-[9.5px] font-bold uppercase text-ink-400">{labels.stock}</label>
                  <Input type="number" min="0" value={variant.stockQuantity} onChange={(e) => setVariant(index, 'stockQuantity', Number(e.target.value))} className="h-9 text-[12px]" dir="ltr" />
                </div>
                <button
                  type="button"
                  onClick={() => setForm((c) => ({ ...c, variants: c.variants.filter((_, i) => i !== index) }))}
                  className="grid h-9 w-8 place-items-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={labels.deleteVariantAria}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {form.variants.length === 0 && (
              <p className="rounded-xl border border-dashed border-ink-200 py-6 text-center text-[11.5px] text-ink-400">
                {labels.noVariants}
              </p>
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{labels.infoSection}</h2>
          <div className="space-y-3">
            <Field label={labels.skuLabel} required>
              <Input value={form.sku} onChange={(e) => setForm((c) => ({ ...c, sku: e.target.value.toUpperCase() }))} required dir="ltr" />
            </Field>
            <Field label={labels.categoryLabel} required>
              <Select value={form.categoryId} onChange={(e) => setForm((c) => ({ ...c, categoryId: e.target.value }))} required>
                <option value="">—</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={labels.statusLabel}>
              <Select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as ProductFormValues['status'] }))}>
                <option value="AVAILABLE">{productStatusLabels.AVAILABLE}</option>
                <option value="OUT_OF_STOCK">{productStatusLabels.OUT_OF_STOCK}</option>
                <option value="HIDDEN">{productStatusLabels.HIDDEN}</option>
                <option value="ARCHIVED">{productStatusLabels.ARCHIVED}</option>
              </Select>
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-ink-700">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm((c) => ({ ...c, isFeatured: e.target.checked }))}
                className="h-4 w-4 rounded border-ink-300 accent-brand-500"
              />
              {labels.featuredLabel}
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 flex items-center justify-between text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
            {labels.imagesSection}
            <span className="text-[10.5px] font-bold tabular-nums text-ink-300" dir="ltr">{form.images.filter((image) => image.url.trim()).length}/{MAX_IMAGES}</span>
          </h2>
          <div className="space-y-2">
            {form.images.map((image, index) => (
              <div key={index} className="flex items-center gap-2 rounded-xl border border-ink-100 bg-ink-50/40 p-2">
                <button
                  type="button"
                  onClick={() => setPrimary(index)}
                  aria-pressed={index === 0}
                  title={index === 0 ? labels.cardImageTitle : labels.setCardImageTitle}
                  aria-label={index === 0 ? labels.cardImageTitle : labels.setCardImageTitle}
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors',
                    index === 0 ? 'text-amber-400' : 'text-ink-300 hover:bg-amber-50 hover:text-amber-500',
                  )}
                >
                  <Star className={cn('h-4 w-4', index === 0 && 'fill-amber-400')} />
                </button>
                <div className={cn('relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-50', index === 0 && 'ring-2 ring-amber-400 ring-offset-1')}>
                  {image.url && <Image src={image.url} alt="" fill sizes="48px" className="object-cover" unoptimized />}
                </div>
                <div className="flex flex-1 items-center justify-end gap-1.5">
                  <label
                    className={cn(
                      'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-[11px] font-semibold text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-600',
                      uploading === index && 'pointer-events-none opacity-50',
                    )}
                    title={labels.chooseFileTitle}
                    aria-label={labels.chooseImageAria}
                  >
                    {uploading === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {labels.chooseFileTitle}
                    {fileInput(index)}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((c) => {
                        const removed = c.images[index];
                        if (removed?.file) releaseStagedImage({ file: removed.file, previewUrl: removed.url });
                        return { ...c, images: c.images.filter((_, i) => i !== index) };
                      })
                    }
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={labels.deleteImageAria}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <label
              className={cn(
                'flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-200 py-2.5 text-[11.5px] font-bold text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-600',
                uploading === 'new' && 'pointer-events-none opacity-60',
              )}
            >
              {uploading === 'new' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading === 'new' ? labels.staging : labels.addFiles}
              {fileInput(null)}
            </label>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
            {labels.imagesHelp.replace('{max}', String(MAX_IMAGES))}
          </p>
        </section>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-700">{error}</p>}

        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={pending} size="md">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {initial.id ? labels.saveChanges : labels.createProduct}
          </Button>
          {slug && (
            <a href={`/products/${slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-ink-500 hover:text-brand-600">
              <ExternalLink className="h-3 w-3" /> {labels.viewOnStore}
            </a>
          )}
        </div>
      </aside>
    </form>
  );
}
