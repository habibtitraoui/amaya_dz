'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Pencil, Trash2, FolderTree, EyeOff, Eye, Upload } from 'lucide-react';
import { saveCategoryAction, toggleCategoryAction } from '@/app/actions/admin';
import { releaseStagedImage, stageImageFile, uploadStagedImage, type StagedImage } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type CategoryRow = {
  id: string;
  slug: string;
  image: string;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
  nameFr: string;
  translations: { locale: 'FR' | 'AR' | 'EN'; name: string; description: string }[];
};

const EMPTY: CategoryRow = {
  id: '',
  slug: '',
  image: '',
  isActive: true,
  sortOrder: 0,
  productCount: 0,
  nameFr: '',
  translations: [
    { locale: 'FR', name: '', description: '' },
    { locale: 'AR', name: '', description: '' },
    { locale: 'EN', name: '', description: '' },
  ],
};

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'FR' | 'AR' | 'EN'>('FR');
  const [staging, setStaging] = React.useState(false);
  const [stagedImage, setStagedImage] = React.useState<StagedImage | null>(null);

  function open(category?: CategoryRow) {
    releaseStagedImage(stagedImage);
    setStagedImage(null);
    setEditing(category ?? { ...EMPTY, translations: EMPTY.translations.map((t) => ({ ...t })) });
    setError(null);
    setTab('FR');
  }

  function close() {
    releaseStagedImage(stagedImage);
    setStagedImage(null);
    setEditing(null);
  }

  function setTranslation(locale: 'FR' | 'AR' | 'EN', key: 'name' | 'description', value: string) {
    if (!editing) return;
    setEditing({
      ...editing,
      translations: editing.translations.map((t) => (t.locale === locale ? { ...t, [key]: value } : t)),
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
          setError(`Échec de l’envoi de l’image : ${uploaded.error}`);
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
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">Catégories</h1>
          <p className="text-[12.5px] text-ink-500">{categories.length} catégorie(s) · noms en trois langues requis</p>
        </div>
        <Button size="sm" onClick={() => open()}>
          <Plus className="h-3.5 w-3.5" />
          Nouvelle catégorie
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <div key={category.id} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            <div className="relative h-28 bg-ink-50">
              {category.image ? (
                <Image src={category.image} alt={category.nameFr} fill sizes="320px" className="object-cover" unoptimized />
              ) : (
                <div className="grid h-full place-items-center text-ink-300"><FolderTree className="h-7 w-7" /></div>
              )}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2">
                <Badge tone={category.isActive ? 'success' : 'neutral'}>{category.isActive ? 'Active' : 'Inactive'}</Badge>
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-ink-700">{category.productCount} prod.</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-ink-900">{category.nameFr}</p>
                <p className="truncate text-[10.5px] text-ink-400">/{category.slug}</p>
              </div>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => toggle(category)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-700" aria-label="Activer / désactiver">
                  {category.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => open(category)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-brand-600" aria-label="Modifier la catégorie">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm">
          <form onSubmit={save} className="my-8 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-[15px] font-extrabold text-ink-900">{editing.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2>

            <div className="mt-4 space-y-3">
              <div className="flex gap-1 rounded-full bg-ink-100 p-0.5">
                {(['FR', 'AR', 'EN'] as const).map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => setTab(locale)}
                    className={cn('flex-1 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors', tab === locale ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500')}
                  >
                    {locale === 'FR' ? 'Français' : locale === 'AR' ? 'العربية' : 'English'}
                  </button>
                ))}
              </div>

              <div dir={tab === 'AR' ? 'rtl' : 'ltr'} className={cn('space-y-3', tab === 'AR' && 'font-arabic')}>
                <Field label="Nom" required={tab === 'FR'}>
                  <Input
                    value={editing.translations.find((t) => t.locale === tab)?.name ?? ''}
                    onChange={(event) => setTranslation(tab, 'name', event.target.value)}
                    required={tab === 'FR'}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    value={editing.translations.find((t) => t.locale === tab)?.description ?? ''}
                    onChange={(event) => setTranslation(tab, 'description', event.target.value)}
                    rows={2}
                  />
                </Field>
              </div>

              <Field label="Image">
                <div className="flex gap-2">
                  <Input
                    value={editing.image}
                    onChange={(event) => {
                      releaseStagedImage(stagedImage);
                      setStagedImage(null);
                      setEditing({ ...editing, image: event.target.value });
                    }}
                    placeholder="https://…"
                    dir="ltr"
                  />
                  <label
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-500 hover:border-brand-300 hover:text-brand-600',
                      staging && 'pointer-events-none opacity-50',
                    )}
                    title="Choisir un fichier — envoyé uniquement à l’enregistrement"
                    aria-label="Choisir une image (envoyée à l’enregistrement)"
                  >
                    {staging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ordre">
                  <Input type="number" value={editing.sortOrder} onChange={(event) => setEditing({ ...editing, sortOrder: Number(event.target.value) })} dir="ltr" />
                </Field>
                <label className="mt-7 flex cursor-pointer items-center gap-2 text-[12px] font-medium text-ink-700">
                  <input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} className="h-4 w-4 accent-brand-500" />
                  Catégorie active
                </label>
              </div>
            </div>

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-700">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-full px-4 py-2 text-[12px] font-semibold text-ink-500 hover:bg-ink-50">
                Annuler
              </button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="hidden" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
