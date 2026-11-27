'use client';

import * as React from 'react';
import Link from 'next/link';

const COPY = {
  ar: { title: 'حدث خطأ', text: 'حدث خطأ من جانبنا. حاول مرة أخرى بعد لحظات.', retry: 'حاول مرة أخرى', home: 'الرئيسية' },
  fr: { title: 'Une erreur est survenue', text: 'Quelque chose s’est mal passé de notre côté. Réessayez dans un instant.', retry: 'Réessayer', home: 'Retour à l’accueil' },
  en: { title: 'Something went wrong', text: 'Something went wrong on our side. Please try again in a moment.', retry: 'Try again', home: 'Back to home' },
} as const;

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'fr';
  const copy = COPY[lang as keyof typeof COPY] ?? COPY.fr;

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ink-50 px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-500">AMAYA</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">{copy.title}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">{copy.text}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={reset} className="btn-brand inline-flex h-11 items-center px-6 text-[13px]">
            {copy.retry}
          </button>
          <Link href="/" className="inline-flex h-11 items-center rounded-full border border-ink-200 px-6 text-[13px] font-semibold text-ink-700 hover:bg-ink-50">
            {copy.home}
          </Link>
        </div>
      </div>
    </main>
  );
}
