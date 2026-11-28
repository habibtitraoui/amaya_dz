'use client';

import * as React from 'react';
import { Select } from '@/components/ui/field';
import { ALGERIAN_WILAYAS, formatWilayaLabel } from '@/lib/wilayas';

function resolveWilayaValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  const match = ALGERIAN_WILAYAS.find(
    (w) =>
      w.code === trimmed ||
      w.name.toLowerCase() === lower ||
      w.ar === trimmed ||
      `${w.code} - ${w.name}`.toLowerCase() === lower ||
      `${w.code} - ${w.ar}` === trimmed,
  );
  return match ? `${match.code} - ${match.name}` : trimmed;
}

export function WilayaSelect({
  value,
  onChange,
  placeholder,
  locale,
  required,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  locale?: string;
  required?: boolean;
  id?: string;
  className?: string;
}) {
  const normalized = resolveWilayaValue(value);
  const isKnown = !normalized || ALGERIAN_WILAYAS.some((w) => `${w.code} - ${w.name}` === normalized);

  return (
    <Select
      id={id}
      value={normalized}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      className={className}
    >
      <option value="">{placeholder ?? '—'}</option>
      {!isKnown && normalized && <option value={normalized}>{normalized}</option>}
      {ALGERIAN_WILAYAS.map((wilaya) => (
        <option key={wilaya.code} value={`${wilaya.code} - ${wilaya.name}`}>
          {formatWilayaLabel(wilaya, locale)}
        </option>
      ))}
    </Select>
  );
}
