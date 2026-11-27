'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Image as ImageIcon, Loader2, Save, Upload } from 'lucide-react';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { releaseStagedImage, stageImageFile, uploadStagedImage, type StagedImage } from '@/lib/upload';

type Section = {
  key: string;
  label: string;
  hint?: string;
  type?: 'text' | 'number' | 'image';
};

const SECTIONS: { title: string; description: string; fields: Section[] }[] = [
  {
    title: 'Page d’accueil',
    description: 'Visuel affiché dans la bannière principale de la boutique.',
    fields: [
      {
        key: 'hero.image',
        label: 'Image de bannière',
        type: 'image',
        hint: 'Choisissez un visuel (recommandé : carré, 1200 px) ou collez une URL — envoyé au stockage à l’enregistrement.',
      },
    ],
  },
  {
    title: 'Livraison',
    description: 'Le seuil de gratuité s’applique au sous-total hors livraison.',
    fields: [
      { key: 'delivery.fee', label: 'Frais de livraison (DA)', type: 'number' },
      { key: 'delivery.freeThreshold', label: 'Seuil livraison gratuite (DA)', type: 'number' },
    ],
  },
  {
    title: 'Quantités minimums',
    description: 'Valeurs par défaut ; chaque produit peut avoir son propre minimum.',
    fields: [
      { key: 'wholesale.minQty', label: 'Minimum grossiste', type: 'number' },
      { key: 'superWholesale.minQty', label: 'Minimum super grossiste', type: 'number' },
    ],
  },
  {
    title: 'Entreprise (factures)',
    description: 'Ces informations apparaissent en français en en-tête de chaque facture.',
    fields: [
      { key: 'company.name', label: 'Raison sociale' },
      { key: 'company.address', label: 'Adresse' },
      { key: 'company.phone', label: 'Téléphone' },
      { key: 'company.email', label: 'Email' },
      { key: 'company.rc', label: 'Registre de commerce' },
      { key: 'company.nif', label: 'NIF' },
      { key: 'company.ai', label: 'Article d’imposition' },
      { key: 'company.bank', label: 'Coordonnées bancaires' },
    ],
  },
];

/**
 * Image setting: preview + "Téléverser" button. Picking a file only stages it
 * locally (optimized + blob preview) — the file is uploaded to Object Storage
 * when the whole form is submitted, never on selection. Pasting a URL works too.
 */
function ImageField({
  label,
  hint,
  value,
  staging,
  error,
  onChange,
  onPickFile,
  onClear,
}: {
  label: string;
  hint?: string;
  value: string;
  staging: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onPickFile: (file: File) => void;
  onClear: () => void;
}) {
  const inputId = React.useId();

  return (
    <div className="sm:col-span-2">
      <Field label={label} hint={hint} htmlFor={inputId}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-ink-100 bg-ink-50">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote/blob URL
              <img src={value} alt={label} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="absolute inset-0 m-auto h-6 w-6 text-ink-300" />
            )}
          </div>
          <div className="min-w-[220px] flex-1 space-y-2">
            <Input
              id={inputId}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="https://… ou /brand/…"
              dir="ltr"
            />
            <div className="flex items-center gap-3">
              <label
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-ink-200 px-3 py-1.5 text-[11.5px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-600',
                  staging && 'pointer-events-none opacity-60',
                )}
              >
                {staging ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {staging ? 'Préparation…' : 'Choisir un fichier'}
                <input
                  type="file"
                  accept="image/webp,image/jpeg,image/png,image/avif"
                  className="hidden"
                  disabled={staging}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onPickFile(file);
                    event.target.value = '';
                  }}
                />
              </label>
              {value && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[11.5px] font-semibold text-ink-400 hover:text-red-600"
                >
                  Retirer
                </button>
              )}
            </div>
            <p className="text-[10.5px] text-ink-400">Le fichier est envoyé au stockage uniquement lors de l’enregistrement.</p>
            {error && <p className="text-[11.5px] text-red-600">{error}</p>}
          </div>
        </div>
      </Field>
    </div>
  );
}

export function SettingsForm({ values }: { values: Record<string, unknown> }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<Record<string, string>>(
    Object.fromEntries(
      SECTIONS.flatMap((section) =>
        section.fields.map((field) => [
          field.key,
          values[field.key] === undefined || values[field.key] === null ? '' : String(values[field.key]),
        ]),
      ),
    ),
  );
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Files picked but not yet uploaded — sent to storage on submit only.
  const [stagedImages, setStagedImages] = React.useState<Record<string, StagedImage>>({});
  const [stagingKey, setStagingKey] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string | null>>({});
  const stagedRef = React.useRef(stagedImages);
  stagedRef.current = stagedImages;

  // Release any remaining object URLs when the form unmounts.
  React.useEffect(
    () => () => {
      for (const staged of Object.values(stagedRef.current)) releaseStagedImage(staged);
    },
    [],
  );

  async function pickImage(key: string, file: File) {
    setStagingKey(key);
    setFieldErrors((current) => ({ ...current, [key]: null }));
    try {
      const staged = await stageImageFile(file);
      if (!staged.ok) {
        setFieldErrors((current) => ({ ...current, [key]: staged.error }));
        return;
      }
      setStagedImages((current) => {
        releaseStagedImage(current[key]);
        return { ...current, [key]: staged.image };
      });
      setDraft((current) => ({ ...current, [key]: staged.image.previewUrl }));
    } finally {
      setStagingKey(null);
    }
  }

  function clearImage(key: string) {
    setStagedImages((current) => {
      releaseStagedImage(current[key]);
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFieldErrors((current) => ({ ...current, [key]: null }));
    setDraft((current) => ({ ...current, [key]: '' }));
  }

  function typeImageUrl(key: string, value: string) {
    // Manual URL entry drops any staged file for that field.
    setStagedImages((current) => {
      if (!current[key]) return current;
      releaseStagedImage(current[key]);
      const next = { ...current };
      delete next[key];
      return next;
    });
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { saveSettingsAction } = await import('@/app/actions/settings');
      // Upload staged files now, on submit — never on file selection.
      const resolved = { ...draft };
      for (const [key, staged] of Object.entries(stagedImages)) {
        const uploaded = await uploadStagedImage(staged);
        if (!uploaded.ok) {
          setError(`Échec de l’envoi de l’image : ${uploaded.error}`);
          setPending(false);
          return;
        }
        resolved[key] = uploaded.url;
      }
      // Drop staged previews: keep resolved URLs so a failed save retries cleanly.
      for (const staged of Object.values(stagedImages)) releaseStagedImage(staged);
      setStagedImages({});
      setDraft(resolved);
      const payload = Object.fromEntries(
        Object.entries(resolved).map(([key, value]) => [key, value.trim() === '' ? null : /^\d+$/.test(value) ? Number(value) : value]),
      );
      const result = await saveSettingsAction(payload);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-4">
      {SECTIONS.map((section) => (
        <section key={section.title} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="text-[13px] font-extrabold text-ink-900">{section.title}</h2>
          <p className="mb-4 text-[11px] text-ink-400">{section.description}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) =>
              field.type === 'image' ? (
                <ImageField
                  key={field.key}
                  label={field.label}
                  hint={field.hint}
                  value={draft[field.key] ?? ''}
                  staging={stagingKey === field.key}
                  error={fieldErrors[field.key] ?? null}
                  onChange={(value) => typeImageUrl(field.key, value)}
                  onPickFile={(file) => void pickImage(field.key, file)}
                  onClear={() => clearImage(field.key)}
                />
              ) : (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <Input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={draft[field.key] ?? ''}
                    onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                    dir={field.type === 'number' ? 'ltr' : undefined}
                  />
                </Field>
              ),
            )}
          </div>
        </section>
      ))}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[11.5px] text-red-700">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer les paramètres
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Enregistré
          </span>
        )}
      </div>
    </form>
  );
}
