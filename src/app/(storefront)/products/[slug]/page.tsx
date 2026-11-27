import Link from '@/components/ui/navigation-link';
import { notFound } from 'next/navigation';
import { ShieldCheck, Truck, RotateCcw, Tag, Package } from 'lucide-react';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { getCurrentUser, getTier } from '@/lib/auth';
import { getProductBySlug, getRelatedProducts } from '@/lib/services/catalog';
import { ProductDetail } from '@/components/storefront/product-detail';
import { ProductCard, ProductGrid } from '@/components/storefront/product-card';
import { SectionHeading } from '@/components/storefront/section-heading';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const [tier, user] = await Promise.all([getTier(), getCurrentUser()]);
  const product = await getProductBySlug(slug, locale, tier);
  if (!product) notFound();

  const related = await getRelatedProducts(product.id, product.category?.slug, locale, tier, 4);

  return (
    <div className="container-page py-8">
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-400">
        <Link href="/" className="hover:text-ink-700">{dict.nav.home}</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-ink-700">{dict.nav.products}</Link>
        {product.category && (
          <>
            <span>/</span>
            <Link href={`/categories/${product.category.slug}`} className="hover:text-ink-700">{product.category.name}</Link>
          </>
        )}
        <span>/</span>
        <span className="truncate font-medium text-ink-600">{product.name}</span>
      </nav>

      <ProductDetail
        product={product}
        tier={tier}
        signedIn={!!user}
        labels={{
          addToCart: dict.product.addToCart,
          added: dict.product.added,
          outOfStock: dict.product.outOfStock,
          inStock: dict.product.inStock,
          lowStock: dict.product.lowStock,
          color: dict.product.color,
          colors: dict.product.colors,
          sku: dict.product.sku,
          category: dict.product.category,
          description: dict.product.description,
          yourPrice: dict.product.yourPrice,
          retailPrice: dict.product.retailPrice,
          wholesalePrice: dict.product.wholesalePrice,
          superWholesalePrice: dict.product.superWholesalePrice,
          minQuantity: dict.product.minQuantity,
          minQuantityHint: dict.product.minQuantityHint,
          quantityBelowMin: dict.product.quantityBelowMin,
          quantity: dict.common.quantity,
          error: dict.common.error,
          taxNote: dict.product.stockLeft,
          wholesaleHint: dict.product.wholesaleHint,
          wholesaleOnly: dict.product.wholesaleOnly,
        }}
      />

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Truck, title: dict.home.trustDelivery, text: dict.home.trustDeliveryText },
          { icon: ShieldCheck, title: dict.home.trustQuality, text: dict.home.trustQualityText },
          { icon: RotateCcw, title: dict.home.brandPoint2, text: dict.footer.hours },
        ].map((item) => (
          <div key={item.title} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <item.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[12.5px] font-bold text-ink-900">{item.title}</p>
              <p className="text-[11.5px] text-ink-500">{item.text}</p>
            </div>
          </div>
        ))}
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <SectionHeading title={dict.product.relatedProducts} href="/products" linkLabel={dict.home.viewAll} icon={<Package className="h-4 w-4" />} />
          <ProductGrid className="mt-5">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                locale={locale}
                labels={{ outOfStock: dict.product.outOfStock, lowStock: dict.product.lowStock, minQty: dict.product.minQuantityHint }}
              />
            ))}
          </ProductGrid>
        </section>
      )}
    </div>
  );
}
