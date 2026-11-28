'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Pencil, FolderTree, EyeOff, Eye, Upload, Trash2 } from 'lucide-react';
import { saveCategoryAction, toggleCategoryAction } from '@/app/actions/admin';
import { releaseStagedImage, stageImageFile, uploadStagedImage, type StagedImage } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import type { Dictionary, Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { DeleteConfirmButton } from '@/components/admin/delete-confirm-button';

type CategoryRow = {
  id: string;
  slug: string;
  image: string;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  nameLocalized: string;
  translations: { locale: 'FR' | 'AR' | 'EN'; name: string; description: string }[];
};

const EMPTY: CategoryRow = {
  id: '',
  slug: '',
  image: '',
  isActive: true,
  sortOrder: 0,
  productCount: 0,
  nameLocalized: '',
  translations: [
    { locale: 'FR', name: '', description: '' },
    { locale: 'AR', name: '', description: '' },
    { locale: 'EN', name: '', description: '' },
  ],
};

export function CategoryManager({
  categories,
  locale = 'fr',
  labels,
}: {
  categories: CategoryRow[];
  locale?: Locale;
  labels: Dictionary['admin']['categories'];
}) {
  const router = useRouter();
  const defaultTab = locale === 'ar' ? 'AR' : locale === 'en' ? 'EN' : 'FR';
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'FR' | 'AR' | 'EN'>(defaultTab);
  const [staging, setStaging] = React.useState(false);
  const [stagedImage, setStagedImage] = React.useState<StagedImage | null>(null);

  function open(category?: CategoryRow) {
    releaseStagedImage(stagedImage);
    setStagedImage(null);
    setEditing(category ?? { ...EMPTY, translations: EMPTY.translations.map((t) => ({ ...t })) });
    setError(null);
    setTab(defaultTab);
  }

  function close() {
    releaseStagedImage(stagedImage);
    setStagedImage(null);
    setEditing(null);
  }

  function setTranslation(code: 'FR' | 'AR' | 'EN', key: 'name' | 'description', value: string) {
    if (!editing) return;
    setEditing({
      ...editing,
      translations: editing.translations.map((t) => (t.locale === code ? { ...t, [key]: value } : t)),
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setPending(true);
    setError(null);
    try {
      // A staged file goes to Object Storage now, on submit — never on pick.
      let image = editing.image.startsWith('blob:') ? '' : editing.image;
      if (stagedImage) {
        const uploaded = await uploadStagedImage(stagedImage);
        if (!uploaded.ok) {
          setError(labels.uploadFailed.replace('{error}', uploaded.error));
          setPending(false);
          return;
        }
        image = uploaded.url;
      }
      const result = await saveCategoryAction({
        id: editing.id || undefined,
        image: image || undefined,
        isActive: editing.isActive,
        sortOrder: editing.sortOrder,
        translations: editing.translations.filter((t) => t.name.trim()),
      });
      if (result.ok) {
        releaseStagedImage(stagedImage);
        setStagedImage(null);
        setEditing(null);
        router.refresh();
      } else {
        // Keep the stored URL so a retry doesn't re-upload the same file.
        releaseStagedImage(stagedImage);
        setStagedImage(null);
        setEditing((current) => (current ? { ...current, image } : current));
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function toggle(category: CategoryRow) {
    await toggleCategoryAction({ id: category.id, isActive: !category.isActive });
    router.refresh();
  }

  async function handleUpload(file: File) {
    setStaging(true);
    setError(null);
    try {
      const staged = await stageImageFile(file);
      if (!staged.ok) {
        setError(staged.error);
        return;
      }
      // No request leaves the browser here — the file is only optimized and
      // kept in memory with a blob: preview URL until the form is submitted.
      releaseStagedImage(stagedImage);
      setStagedImage(staged.image);
      setEditing((current) => (current ? { ...current, image: staged.image.previewUrl } : current));
    } finally {
      setStaging(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{labels.title}</h1>
          <p className="text-[12.5px] text-ink-500">{labels.subtitle.replace('{count}', String(categories.length))}</p>
        </div>
        <Button size="sm" onClick={() => open()}>
          <Plus className="h-3.5 w-3.5" />
          {labels.newCategory}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <div key={category.id} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            <div className="relative h-28 bg-ink-50">
              {category.image ? (
                <Image src={category.image} alt={category.nameLocalized} fill sizes="320px" className="object-cover" unoptimized />
              ) : (
                <div className="grid h-full place-items-center text-ink-300"><FolderTree className="h-7 w-7" /></div>
              )}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2">
                <Badge tone={category.isActive ? 'success' : 'neutral'}>{category.isActive ? labels.active : labels.inactive}</Badge>
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-ink-700">
                  {labels.productCountShort.replace('{count}', String(category.productCount))}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-ink-900">{category.nameLocalized}</p>
                <p className="truncate text-[10.5px] text-ink-400" dir="ltr">/{category.slug}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => toggle(category)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-700" aria-label={labels.toggleAria}>
                  {category.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => open(category)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-brand-600" aria-label={labels.editAria}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <DeleteConfirmButton
                  entity="category"
                  entityId={category.id}
                  entityName={category.nameLocalized || category.slug}
                  labels={{
                    ariaLabel: labels.deleteAria,
                    title: labels.deleteTitle,
                    message: labels.deleteMessage,
                    confirm: labels.deleteConfirm,
                    cancel: labels.deleteCancel,
                    deleting: labels.deletePending,
                    error: labels.deleteError,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm">
          <form onSubmit={save} className="my-8 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-[15px] font-extrabold text-ink-900">{editing.id ? labels.editTitle : labels.createTitle}</h2>

            <div className="mt-4 space-y-3">
              <div className="flex gap-1 rounded-full bg-ink-100 p-0.5">
                {(['FR', 'AR', 'EN'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setTab(code)}
                    className={cn('flex-1 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors', tab === code ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500')}
                  >
                    {code === 'FR' ? 'Français' : code === 'AR' ? 'العربية' : 'English'}
                  </button>
                ))}
              </div>

              <div dir={tab === 'AR' ? 'rtl' : 'ltr'} className={cn('space-y-3', tab === 'AR' && 'font-arabic')}>
                <Field label={labels.nameLabel} required={tab === 'FR'}>
                  <Input
                    value={editing.translations.find((t) => t.locale === tab)?.name ?? ''}
                    onChange={(event) => setTranslation(tab, 'name', event.target.value)}
                    required={tab === 'FR'}
                  />
                </Field>
                <Field label={labels.descriptionLabel}>
                  <Textarea
                    value={editing.translations.find((t) => t.locale === tab)?.description ?? ''}
                    onChange={(event) => setTranslation(tab, 'description', event.target.value)}
                    rows={2}
                  />
                </Field>
              </div>

              <Field label={labels.imageLabel}>
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-ink-100 bg-ink-50">
                    {editing.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote or local blob preview
                      <img src={editing.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-ink-300">
                        <Upload className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-ink-200 px-3.5 py-2 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-600',
                        staging && 'pointer-events-none opacity-50',
                      )}
                      title={labels.chooseFileTitle}
                      aria-label={labels.chooseImageAria}
                    >
                      {staging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {labels.chooseFileTitle}
                      <input
                        type="file"
                        accept="image/webp,image/jpeg,image/png,image/avif"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (file) void handleUpload(file);
                        }}
                      />
                    </label>
                    {editing.image && (
                      <button
                        type="button"
                        onClick={() => {
                          releaseStagedImage(stagedImage);
                          setStagedImage(null);
                          setEditing({ ...editing, image: '' });
                        }}
                        className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-ink-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={labels.orderLabel}>
                  <Input type="number" value={editing.sortOrder} onChange={(event) => setEditing({ ...editing, sortOrder: Number(event.target.value) })} dir="ltr" />
                </Field>
                <label className="mt-7 flex cursor-pointer items-center gap-2 text-[12px] font-medium text-ink-700">
                  <input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} className="h-4 w-4 accent-brand-500" />
                  {labels.activeCheckbox}
                </label>
              </div>
            </div>

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-700">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-full px-4 py-2 text-[12px] font-semibold text-ink-500 hover:bg-ink-50">
                {labels.cancel}
              </button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {labels.save}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
