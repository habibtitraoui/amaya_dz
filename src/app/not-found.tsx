import Link from 'next/link';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';

export default async function NotFound() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ink-50 px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-500">404</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink-900">{dict.notFound.title}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">{dict.notFound.text}</p>
        <Link href="/" className="btn-brand mt-6 inline-flex h-11 items-center px-6 text-[13px]">
          {dict.notFound.backHome}
        </Link>
      </div>
    </main>
  );
}
