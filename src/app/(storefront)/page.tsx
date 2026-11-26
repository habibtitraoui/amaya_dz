import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Truck,
  Wallet,
  ShieldCheck,
  Sparkles,
  Package,
  TrendingUp,
  Star,
} from 'lucide-react';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { getTier } from '@/lib/auth';
import { getHomepageData } from '@/lib/services/catalog';
import { ProductCard, ProductGrid } from '@/components/storefront/product-card';
import { ButtonLink } from '@/components/ui/button';
import { SectionHeading } from '@/components/storefront/section-heading';
import { CategoryTile } from '@/components/storefront/category-tile';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const tier = await getTier();
  const data = await getHomepageData(locale, tier);

  const cardLabels = {
    outOfStock: dict.product.outOfStock,
    lowStock: dict.product.lowStock,
    minQty: interpolate(dict.product.minQuantityHint, { count: '{count}' }),
  };

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-ink-950">
        <div className="absolute inset-0 brand-grid opacity-40" />
        <div className="absolute -end-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-500/25 blur-[120px]" />
        <div className="absolute -start-32 bottom-0 h-[380px] w-[380px] rounded-full bg-brand-400/10 blur-[100px]" />

        <div className="container-page relative grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-8 lg:py-24">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-200 backdrop-blur">
              <Sparkles className="h-3 w-3" />
              {dict.home.heroBadge}
            </span>
            <h1 className="mt-5 text-[2.15rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
              {dict.home.heroTitle.split(' ').slice(0, -2).join(' ')}{' '}
              <span className="text-brand-400">
                {dict.home.heroTitle.split(' ').slice(-2).join(' ')}
              </span>
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/65 sm:text-base">
              {dict.home.heroSubtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/products" size="lg" className="shadow-[0_16px_40px_-16px_rgba(245,102,0,0.9)]">
                {dict.home.heroCta}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </ButtonLink>
              <ButtonLink
                href="/categories"
                size="lg"
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                {dict.home.heroSecondary}
              </ButtonLink>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                { icon: Truck, title: '58', label: dict.home.trustDelivery },
                { icon: ShieldCheck, title: '7j', label: dict.home.trustQuality },
                { icon: Wallet, title: '3', label: dict.home.trustPricing },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/20">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <dt className="text-[15px] font-bold text-white leading-tight">{item.title}</dt>
                    <dd className="text-[10.5px] leading-tight text-white/45">{item.label}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative animate-fade-in">
            <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 shadow-[0_40px_100px_-30px_rgba(245,102,0,0.6)]">
              <div className="absolute inset-0 brand-grid opacity-30" />
              <Image
                src="/products/airpods-pro-white.jpg"
                alt="AMAYA premium wireless earbuds"
                fill
                priority
                sizes="(min-width: 1024px) 480px, 90vw"
                className="object-cover mix-blend-luminosity opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-700/90 via-brand-600/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">AMAYA</p>
                <p className="mt-1 text-xl font-bold leading-tight text-white">Premium Accessories</p>
              </div>
              <div className="absolute end-5 top-5 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ink-900 shadow-lg">
                <Star className="h-3 w-3 fill-brand-500 text-brand-500" /> 4.9
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ categories */}
      <section className="container-page py-16 sm:py-20">
        <SectionHeading
          title={dict.home.featuredCategories}
          subtitle={dict.home.featuredCategoriesSub}
          href="/categories"
          linkLabel={dict.home.viewAll}
        />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {data.categories.map((category) => (
            <CategoryTile key={category.id} category={category} countLabel={dict.categories.productsCount} />
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------------- featured */}
      {data.featured.length > 0 && (
        <section className="bg-ink-50/60 py-16 sm:py-20">
          <div className="container-page">
            <SectionHeading
              title={dict.home.featuredProducts}
              subtitle={dict.home.featuredProductsSub}
              href="/products"
              linkLabel={dict.home.viewAll}
              icon={<Sparkles className="h-4 w-4" />}
            />
            <ProductGrid className="mt-6">
              {data.featured.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} labels={cardLabels} />
              ))}
            </ProductGrid>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ wholesale banner */}
      {tier === 'RETAIL' && (
        <section className="container-page py-16">
          <div className="relative overflow-hidden rounded-3xl bg-ink-950 px-6 py-12 sm:px-12">
            <div className="absolute inset-0 brand-grid opacity-30" />
            <div className="absolute -end-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-[80px]" />
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/25">
                  <TrendingUp className="h-3 w-3" />
                  B2B
                </span>
                <h2 className="mt-4 text-2xl font-extrabold text-white sm:text-3xl">{dict.home.promoTitle}</h2>
                <p className="mt-3 text-[14.5px] leading-relaxed text-white/60">{dict.home.promoText}</p>
              </div>
              <div className="flex flex-col gap-3">
                <ButtonLink href="/pro" size="lg">
                  {dict.home.promoCta}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </ButtonLink>
                <div className="flex items-center gap-4 text-[11px] text-white/45">
                  <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-brand-400" /> {dict.tier.WHOLESALE}</span>
                  <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-brand-400" /> {dict.tier.SUPER_WHOLESALE}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- new arrivals */}
      {data.newArrivals.length > 0 && (
        <section className="container-page pb-16 sm:pb-20">
          <SectionHeading
            title={dict.home.newArrivals}
            subtitle={dict.home.newArrivalsSub}
            href="/products?sort=newest"
            linkLabel={dict.home.viewAll}
            icon={<Package className="h-4 w-4" />}
          />
          <ProductGrid className="mt-6">
            {data.newArrivals.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} labels={cardLabels} />
            ))}
          </ProductGrid>
        </section>
      )}

      {/* --------------------------------------------------------- best sellers */}
      {data.bestSellers.length > 0 && (
        <section className="bg-ink-50/60 py-16 sm:py-20">
          <div className="container-page">
            <SectionHeading
              title={dict.home.bestSellers}
              subtitle={dict.home.bestSellersSub}
              href="/products?sort=best_selling"
              linkLabel={dict.home.viewAll}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <ProductGrid className="mt-6">
              {data.bestSellers.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} labels={cardLabels} />
              ))}
            </ProductGrid>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- brand story */}
      <section id="brand" className="container-page py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-500">AMAYA</span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{dict.home.brandTitle}</h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-ink-600">{dict.home.brandText}</p>
            <ul className="mt-6 space-y-3">
              {[dict.home.brandPoint1, dict.home.brandPoint2, dict.home.brandPoint3].map((point) => (
                <li key={point} className="flex items-center gap-3 text-[14px] font-medium text-ink-800">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-brand-600">
                    <BadgeCheck className="h-3.5 w-3.5" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-brand-500 p-10 sm:p-12">
            <div className="absolute inset-0 brand-grid opacity-25" />
            <div className="relative flex flex-col items-start gap-5">
              <Image src="/brand/amaya-logo-white.png" alt="AMAYA" width={1600} height={237} className="h-11 w-auto" />
              <p className="text-[11px] font-bold uppercase tracking-[0.42em] text-white/70">Premium Accessories</p>
              <p className="mt-4 text-[13.5px] leading-relaxed text-white/85">{dict.home.contactText}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[12px] font-semibold text-white">
                <span className="rounded-full bg-white/15 px-3 py-1.5" dir="ltr">+213 555 00 00 00</span>
                <span className="rounded-full bg-white/15 px-3 py-1.5">contact@amaya.dz</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- contact */}
      <section id="contact" className="container-page pb-20">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-ink-100 bg-white px-6 py-12 text-center shadow-card">
          <h2 className="text-xl font-extrabold text-ink-900 sm:text-2xl">{dict.home.contactTitle}</h2>
          <p className="max-w-md text-[14px] text-ink-500">{dict.home.contactText}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="tel:+213555000000" variant="dark">
              +213 555 00 00 00
            </ButtonLink>
            <ButtonLink href="mailto:contact@amaya.dz" variant="outline">
              contact@amaya.dz
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
