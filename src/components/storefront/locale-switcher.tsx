'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Globe } from 'lucide-react';
import { LOCALE_COOKIE, LOCALES, LOCALE_LABEL, LOCALE_SHORT, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LocaleSwitcher({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function choose(next: Locale) {
    if (next === locale) {
      setOpen(false);
      return;
    }
    setPending(true);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    setOpen(false);
    router.refresh();
    window.setTimeout(() => setPending(false), 600);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-[12px] font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:text-ink-900',
          pending && 'opacity-60',
        )}
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={2.2} />
        {compact ? LOCALE_SHORT[locale] : LOCALE_LABEL[locale]}
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-2 w-40 overflow-hidden rounded-xl border border-ink-150 bg-white p-1 shadow-xl animate-fade-in end-0"
        >
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={code === locale}
              onClick={() => choose(code)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                code === locale ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50',
              )}
            >
              <span className={code === 'ar' ? 'font-arabic' : ''}>{LOCALE_LABEL[code]}</span>
              {code === locale && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
