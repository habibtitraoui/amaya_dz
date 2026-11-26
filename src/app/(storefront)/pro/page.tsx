import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, Phone, Mail, MapPin, Store, Truck, FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import { getLocale } from '@/lib/locale';
import { getDictionary, type Locale } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { formatDA } from '@/lib/money';
import { TIERS, TIER_LABEL } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return { title: dict.pro.metaTitle, description: dict.pro.metaDescription };
}

/** Illustrative price ladder: a real flagship product, priced by tier. */
async function ladder(sku: string) {
  const product = await prisma.product.findUnique({
    where: { sku },
    include: { translations: true, variants: { where: { isActive: true }, take: 1 } },
  });
  if (!product) return null;
  const name =
    product.translations.find((translation) => translation.locale === 'FR')?.name ??
    product.translations[0]?.name ??
    product.sku;
  return {
    name,
    sku: product.sku,
    retail: { price: Number(product.retailPrice), min: 1 },
    wholesale: { price: Number(product.wholesalePrice), min: product.wholesaleMinQty },
    superWholesale: { price: Number(product.superWholesalePrice), min: product.superWholesaleMinQty },
  };
}

const COPY: Record<
  Locale,
  {
    hero: string;
    subtitle: string;
    tiers: string;
    tierHint: string;
    steps: string;
    stepList: { title: string; text: string }[];
    benefits: { title: string; text: string }[];
    contact: string;
    contactText: string;
    cta: string;
    product: string;
    minQty: string;
    note: string;
  }
> = {
  fr: {
    hero: 'Devenez revendeur AMAYA',
    subtitle:
      'Des tarifs professionnels à trois niveaux, des quantités minimums claires et une facture française pour chaque commande.',
    tiers: 'Trois niveaux de prix',
    tierHint: 'Les prix affichés sont ceux de la gamme AirPods Pro 2 — chaque produit a ses propres paliers.',
    steps: 'Comment obtenir un compte ?',
    stepList: [
      { title: 'Contactez-nous', text: 'Par téléphone ou par email, en précisant votre boutique et votre wilaya.' },
      { title: 'Vérification', text: 'Notre équipe valide votre activité et choisit votre palier (gros ou super gros).' },
      { title: 'Identifiants', text: 'Nous créons votre compte et vous transmettons vos identifiants.' },
      { title: 'Commandez', text: 'Connectez-vous : vos tarifs s’appliquent automatiquement à tout le panier.' },
    ],
    benefits: [
      { title: 'Aucune inscription publique', text: 'Les comptes professionnels sont créés par notre équipe, jamais par un formulaire.' },
      { title: 'Prix garantis à la commande', text: 'Le prix est figé au moment de la commande, même si la grille change ensuite.' },
      { title: 'Facture professionnelle', text: 'Facture française A4, numérotée, téléchargeable en PDF.' },
    ],
    contact: 'Nous contacter',
    contactText: 'Notre équipe répond du samedi au jeudi, de 9h à 18h.',
    cta: 'J’ai déjà un compte',
    product: 'Produit',
    minQty: 'Qté min.',
    note: 'Les prix de gros ne sont visibles qu’une fois connecté avec un compte professionnel actif.',
  },
  ar: {
    hero: 'كن موزعًا لأمايا',
    subtitle: 'أسعار مهنية بثلاثة مستويات، كميات دنيا واضحة، وفاتورة فرنسية لكل طلب.',
    tiers: 'ثلاثة مستويات من الأسعار',
    tierHint: 'الأسعار المعروضة لسماعات AirPods Pro 2 — لكل منتج مستوياته الخاصة.',
    steps: 'كيف أحصل على حساب؟',
    stepList: [
      { title: 'اتصل بنا', text: 'هاتفيًا أو بالبريد الإلكتروني مع ذكر متجرك وولايتك.' },
      { title: 'التحقق', text: 'يتحقق فريقنا من نشاطك ويحدد مستواك (جملة أو جملة فائقة).' },
      { title: 'بيانات الدخول', text: 'ننشئ حسابك ونرسل لك بيانات الدخول.' },
      { title: 'اطلب', text: 'سجّل الدخول: تُطبَّق أسعارك تلقائيًا على كل السلة.' },
    ],
    benefits: [
      { title: 'لا تسجيل عمومي', text: 'الحسابات المهنية ينشئها فريقنا، وليس عبر نموذج عام.' },
      { title: 'أسعار مثبّتة عند الطلب', text: 'يُثبَّت السعر لحظة الطلب حتى لو تغيّرت القائمة لاحقًا.' },
      { title: 'فاتورة مهنية', text: 'فاتورة فرنسية A4، مرقّمة، قابلة للتحميل بصيغة PDF.' },
    ],
    contact: 'تواصل معنا',
    contactText: 'فريقنا يجيب من السبت إلى الخميس، من 9 إلى 18.',
    cta: 'لدي حساب بالفعل',
    product: 'المنتج',
    minQty: 'الكمية الدنيا',
    note: 'أسعار الجملة تظهر فقط بعد تسجيل الدخول بحساب مهني نشط.',
  },
  en: {
    hero: 'Become an AMAYA reseller',
    subtitle: 'Three professional price levels, clear minimum quantities and a French invoice for every order.',
    tiers: 'Three price levels',
    tierHint: 'Prices shown are for AirPods Pro 2 — every product has its own tiers.',
    steps: 'How do I get an account?',
    stepList: [
      { title: 'Get in touch', text: 'By phone or email, telling us about your shop and your wilaya.' },
      { title: 'Verification', text: 'Our team checks your business and picks your tier (wholesale or super wholesale).' },
      { title: 'Credentials', text: 'We create your account and send you the login details.' },
      { title: 'Order', text: 'Sign in: your prices apply automatically to the whole cart.' },
    ],
    benefits: [
      { title: 'No public signup', text: 'Professional accounts are created by our team, never through a form.' },
      { title: 'Prices locked at order time', text: 'The price is frozen when you order, even if the price list changes later.' },
      { title: 'Professional invoice', text: 'French A4 invoice, numbered, downloadable as PDF.' },
    ],
    contact: 'Contact us',
    contactText: 'Our team answers Saturday to Thursday, 9am to 6pm.',
    cta: 'I already have an account',
    product: 'Product',
    minQty: 'Min. qty',
    note: 'Wholesale prices are only visible once signed in with an active pro account.',
  },
};

export default async function ProPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = COPY[locale];
  const example = await ladder('AMY-AP-001');

  const phone = process.env.BUSINESS_PHONE ?? '+213 555 00 00 00';
  const email = process.env.BUSINESS_EMAIL ?? 'contact@amaya.dz';
  const address = process.env.BUSINESS_ADDRESS ?? 'Oran, Algérie';

  return (
    <div className="bg-white">
      {/* hero */}
      <section className="relative overflow-hidden bg-ink-950">
        <div className="absolute inset-0 brand-grid opacity-25" />
        <div className="absolute -end-32 -top-32 h-96 w-96 rounded-full bg-brand-500/25 blur-[100px]" />
        <div className="container-page relative py-16 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/25">
            <Store className="h-3 w-3" /> B2B
          </span>
          <h1 className="mt-5 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{copy.hero}</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/60">{copy.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="btn-brand h-11 px-6 text-[13px]">
              <Phone className="h-4 w-4" /> {copy.contact}
            </a>
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              {copy.cta}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </section>

      {/* price ladder */}
      <section className="container-page py-14">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">{copy.tiers}</h2>
        <p className="mt-2 text-[13px] text-ink-500">{copy.tierHint}</p>

        {example && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            <div className="flex items-center gap-3 border-b border-ink-100 bg-ink-50/60 px-5 py-3">
              <span className="rounded-md bg-ink-900 px-2 py-0.5 text-[10px] font-bold text-white" dir="ltr">
                {example.sku}
              </span>
              <span className="text-[13px] font-bold text-ink-900">{example.name}</span>
            </div>
            <div className="grid divide-y divide-ink-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
              {[
                { key: 'RETAIL' as const, label: dict.tier.RETAIL, data: example.retail, accent: false },
                { key: 'WHOLESALE' as const, label: dict.tier.WHOLESALE, data: example.wholesale, accent: true },
                { key: 'SUPER_WHOLESALE' as const, label: dict.tier.SUPER_WHOLESALE, data: example.superWholesale, accent: true },
              ].map((row) => (
                <div key={row.key} className={row.accent ? 'bg-brand-50/40 p-5' : 'p-5'}>
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                    {row.accent && <BadgeCheck className="h-3.5 w-3.5 text-brand-500" />}
                    {row.label}
                  </p>
                  <p className="mt-2 text-2xl font-extrabold text-ink-900 tabular-nums" dir="ltr">
                    {formatDA(row.data.price, locale)}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {copy.minQty} <span className="font-bold text-ink-800">{row.data.min}</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="border-t border-ink-100 px-5 py-2.5 text-[10.5px] text-ink-400">{copy.note}</p>
          </div>
        )}
      </section>

      {/* steps */}
      <section className="border-y border-ink-100 bg-ink-50/40 py-14">
        <div className="container-page">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">{copy.steps}</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.stepList.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-ink-100 bg-white p-5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500 text-[13px] font-extrabold text-white tabular-nums">
                  {index + 1}
                </span>
                <h3 className="mt-3 text-[13.5px] font-bold text-ink-900">{step.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* benefits */}
      <section className="container-page py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {copy.benefits.map((benefit, index) => {
            const Icon = [ShieldCheck, Truck, FileText][index] ?? ShieldCheck;
            return (
              <div key={benefit.title} className="rounded-2xl border border-ink-100 p-5">
                <Icon className="h-5 w-5 text-brand-500" />
                <h3 className="mt-3 text-[13.5px] font-bold text-ink-900">{benefit.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{benefit.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* contact */}
      <section className="container-page pb-16">
        <div className="rounded-3xl bg-ink-950 p-8 sm:p-10">
          <h2 className="text-xl font-extrabold text-white">{copy.contact}</h2>
          <p className="mt-2 text-[13px] text-white/60">{copy.contactText}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex items-center gap-2.5 rounded-xl bg-white/5 px-4 py-3 text-[13px] font-semibold text-white ring-1 ring-white/10 transition-colors hover:bg-white/10">
              <Phone className="h-4 w-4 text-brand-400" /> <span dir="ltr">{phone}</span>
            </a>
            <a href={`mailto:${email}`} className="flex items-center gap-2.5 rounded-xl bg-white/5 px-4 py-3 text-[13px] font-semibold text-white ring-1 ring-white/10 transition-colors hover:bg-white/10">
              <Mail className="h-4 w-4 text-brand-400" /> {email}
            </a>
            <div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-4 py-3 text-[13px] font-semibold text-white ring-1 ring-white/10">
              <MapPin className="h-4 w-4 text-brand-400" /> {address}
            </div>
          </div>
        </div>
      </section>

      <p className="container-page pb-6 text-[10.5px] text-ink-400">
        {TIERS.map((tier) => TIER_LABEL[tier][locale]).join(' · ')}
      </p>
    </div>
  );
}
