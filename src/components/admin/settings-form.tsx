'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Image as ImageIcon, Loader2, Save, Upload } from 'lucide-react';
import { Field, Input } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import type { Dictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { releaseStagedImage, stageImageFile, uploadStagedImage, type StagedImage } from '@/lib/upload';

type SectionField = {
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'email' | 'tel' | 'image';
  ltr?: boolean;
};

function buildSections(labels: Dictionary['admin']['settings']): { title: string; description: string; fields: SectionField[] }[] {
  return [
    {
      title: labels.homeSection,
      description: labels.homeDescription,
      fields: [
        {
          key: 'hero.image',
          label: labels.heroImageLabel,
          type: 'image',
          hint: labels.heroImageHint,
        },
      ],
    },
    {
      title: labels.contactSection,
      description: labels.contactDescription,
      fields: [
        { key: 'contact.address', label: labels.contactAddress, placeholder: labels.contactAddressPlaceholder },
        { key: 'contact.hours', label: labels.contactHours, placeholder: labels.contactHoursPlaceholder },
        { key: 'contact.phone', label: labels.contactPhone, type: 'tel', ltr: true, placeholder: '+213 555 00 00 00' },
        { key: 'contact.email', label: labels.contactEmail, type: 'email', ltr: true, placeholder: 'contact@amaya.dz' },
      ],
    },
    {
      title: labels.socialSection,
      description: labels.socialDescription,
      fields: [
        { key: 'contact.instagram', label: labels.socialInstagram, ltr: true, placeholder: 'https://instagram.com/amaya.dz' },
        { key: 'contact.facebook', label: labels.socialFacebook, ltr: true, placeholder: 'https://facebook.com/amaya.dz' },
        { key: 'contact.tiktok', label: labels.socialTiktok, ltr: true, placeholder: 'https://tiktok.com/@amaya.dz' },
        {
          key: 'contact.whatsapp',
          label: labels.socialWhatsapp,
          ltr: true,
          placeholder: '+213 555 00 00 00',
          hint: labels.socialWhatsappHint,
        },
        { key: 'contact.youtube', label: labels.socialYoutube, ltr: true, placeholder: 'https://youtube.com/@amaya' },
        { key: 'contact.x', label: labels.socialX, ltr: true, placeholder: 'https://x.com/amaya_dz' },
      ],
    },
    {
      title: labels.deliverySection,
      description: labels.deliveryDescription,
      fields: [
        { key: 'delivery.fee', label: labels.deliveryFee, type: 'number', ltr: true },
        { key: 'delivery.freeThreshold', label: labels.deliveryFreeThreshold, type: 'number', ltr: true },
      ],
    },
    {
      title: labels.companySection,
      description: labels.companyDescription,
      fields: [
        { key: 'company.name', label: labels.companyName },
        { key: 'company.address', label: labels.companyAddress },
        { key: 'company.phone', label: labels.companyPhone, type: 'tel', ltr: true },
        { key: 'company.email', label: labels.companyEmail, type: 'email', ltr: true },
        { key: 'company.rc', label: labels.companyRc, ltr: true },
        { key: 'company.nif', label: labels.companyNif, ltr: true },
        { key: 'company.ai', label: labels.companyAi, ltr: true },
        { key: 'company.bank', label: labels.companyBank, ltr: true },
      ],
    },
  ];
}

/**
 * Image setting: preview + upload button. Picking a file only stages it
 * locally (optimized + blob preview) — the file is uploaded to Object Storage
 * when the whole form is submitted, never on selection.
 */
function ImageField({
  label,
  hint,
  value,
  staging,
  error,
  labels,
  onPickFile,
  onClear,
}: {
  label: string;
  hint?: string;
  value: string;
  staging: boolean;
  error: string | null;
  labels: Pick<Dictionary['admin']['settings'], 'staging' | 'chooseFile' | 'remove' | 'deferredUploadNote'>;
  onPickFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="sm:col-span-2">
      <Field label={label} hint={hint}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-ink-100 bg-ink-50">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote/blob URL
              <img src={value} alt={label} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="absolute inset-0 m-auto h-6 w-6 text-ink-300" />
            )}
          </div>
          <div className="min-w-[220px] flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <label
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-ink-200 px-3.5 py-2 text-[12px] font-semibold text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-600',
                  staging && 'pointer-events-none opacity-60',
                )}
              >
                {staging ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {staging ? labels.staging : labels.chooseFile}
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
                  {labels.remove}
                </button>
              )}
            </div>
            <p className="text-[10.5px] text-ink-400">{labels.deferredUploadNote}</p>
            {error && <p className="text-[11.5px] text-red-600">{error}</p>}
          </div>
        </div>
      </Field>
    </div>
  );
}

export function SettingsForm({
  values,
  labels,
}: {
  values: Record<string, unknown>;
  labels: Dictionary['admin']['settings'];
}) {
  const router = useRouter();
  const sections = React.useMemo(() => buildSections(labels), [labels]);
  const [draft, setDraft] = React.useState<Record<string, string>>(
    Object.fromEntries(
      sections.flatMap((section) =>
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

  const persistedRef = React.useRef<Record<string, unknown>>({ ...values });
  React.useEffect(() => {
    persistedRef.current = { ...persistedRef.current, ...values };
  }, [values]);

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
          setError(labels.uploadFailed.replace('{error}', uploaded.error));
          setPending(false);
          return;
        }
        resolved[key] = uploaded.url;
      }
      // Drop staged previews: keep resolved URLs so a failed save retries cleanly.
      for (const staged of Object.values(stagedImages)) releaseStagedImage(staged);
      setStagedImages({});
      setDraft(resolved);

      const fieldTypeByKey = new Map(
        sections.flatMap((section) => section.fields.map((field) => [field.key, field.type ?? 'text'])),
      );
      const payload: Record<string, string | number | null> = {};
      for (const [key, rawValue] of Object.entries(resolved)) {
        const trimmed = rawValue.trim();
        const fieldType = fieldTypeByKey.get(key);
        if (trimmed === '') {
          const previous = persistedRef.current[key];
          if (previous !== undefined && previous !== null) {
            payload[key] = null;
          }
          continue;
        }
        payload[key] = fieldType === 'number' && /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
      }

      const result = await saveSettingsAction(payload);
      if (result.ok) {
        persistedRef.current = { ...persistedRef.current, ...payload };
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
      {sections.map((section) => (
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
                  labels={labels}
                  onPickFile={(file) => void pickImage(field.key, file)}
                  onClear={() => clearImage(field.key)}
                />
              ) : (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <Input
                    type={
                      field.type === 'number'
                        ? 'number'
                        : field.type === 'email'
                          ? 'email'
                          : field.type === 'tel'
                            ? 'tel'
                            : 'text'
                    }
                    value={draft[field.key] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                    dir={field.ltr ? 'ltr' : undefined}
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
          {labels.saveSettings}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" /> {labels.saved}
          </span>
        )}
      </div>
    </form>
  );
}
