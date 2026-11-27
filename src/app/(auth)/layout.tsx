import Image from 'next/image';
import Link from '@/components/ui/navigation-link';
import { ArrowLeft } from 'lucide-react';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { LocaleSwitcher } from '@/components/storefront/locale-switcher';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <div className="absolute inset-0 brand-grid opacity-40" />
        <div className="absolute -end-24 top-1/4 h-96 w-96 rounded-full bg-brand-500/25 blur-[100px]" />
        <div className="absolute inset-0 flex flex-col justify-between p-12">
          <Image src="/brand/amaya-logo-white.png" alt="AMAYA" width={1600} height={237} className="h-8 w-auto" priority />
          <div>
            <p className="max-w-sm text-[26px] font-extrabold leading-tight text-white">
              {dict.home.heroTitle}
            </p>
            <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-white/50">{dict.home.promoText}</p>
            <div className="mt-6 flex items-center gap-4 text-[11px] text-white/40">
              <span className="rounded-full border border-white/15 px-3 py-1">{dict.tier.WHOLESALE}</span>
              <span className="rounded-full border border-white/15 px-3 py-1">{dict.tier.SUPER_WHOLESALE}</span>
            </div>
          </div>
          <p className="text-[10.5px] uppercase tracking-[0.35em] text-white/25">Premium Accessories · Oran, DZ</p>
        </div>
      </div>

      {/* form panel */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6 lg:justify-end">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-900 lg:hidden">
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {dict.nav.home}
          </Link>
          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={locale} />
            <Link href="/" className="hidden items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-ink-900 lg:inline-flex">
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              {dict.cart.continueShopping}
            </Link>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
