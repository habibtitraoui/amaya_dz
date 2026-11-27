import Link from '@/components/ui/navigation-link';
import { MapPin, Phone, Mail, Clock, Instagram, Facebook } from 'lucide-react';
import { LogoLockup } from '@/components/storefront/logo';
import type { Dictionary, Locale } from '@/lib/i18n';

export function StoreFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 bg-ink-950 text-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <LogoLockup />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/60">{dict.footer.about}</p>
          <div className="mt-5 flex gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-white/60 ring-1 ring-white/10">
              <Instagram className="h-3.5 w-3.5" />
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-white/60 ring-1 ring-white/10">
              <Facebook className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-400">{dict.footer.shop}</h3>
          <ul className="space-y-2 text-[13px] text-white/65">
            <li><Link href="/products" className="transition-colors hover:text-white">{dict.footer.allProducts}</Link></li>
            <li><Link href="/categories" className="transition-colors hover:text-white">{dict.footer.categories}</Link></li>
            <li><Link href="/products?sort=best_selling" className="transition-colors hover:text-white">{dict.home.bestSellers}</Link></li>
            <li><Link href="/products?sort=newest" className="transition-colors hover:text-white">{dict.home.newArrivals}</Link></li>
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-400">{dict.footer.account}</h3>
          <ul className="space-y-2 text-[13px] text-white/65">
            <li><Link href="/login" className="transition-colors hover:text-white">{dict.footer.login}</Link></li>
            <li><Link href="/account/orders" className="transition-colors hover:text-white">{dict.footer.myOrders}</Link></li>
            <li><Link href="/pro" className="transition-colors hover:text-white">{dict.footer.proAccounts}</Link></li>
            <li><Link href="/cart" className="transition-colors hover:text-white">{dict.nav.cart}</Link></li>
          </ul>
        </div>

        <div className="lg:col-span-4">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-brand-400">{dict.footer.contact}</h3>
          <ul className="space-y-2.5 text-[13px] text-white/65">
            <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-white/40" /> Oran, Algérie</li>
            <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-white/40" /> <span dir="ltr">+213 555 00 00 00</span></li>
            <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-white/40" /> contact@amaya.dz</li>
            <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-white/40" /> {dict.footer.hours}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-[11px] text-white/40 sm:flex-row">
          <p>© {year} AMAYA — Premium Accessories. {dict.footer.rights}</p>
          <div className="flex items-center gap-4">
            <span>{dict.footer.madeIn}</span>
            <span className="text-white/15">|</span>
            <span>{dict.footer.legal}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
