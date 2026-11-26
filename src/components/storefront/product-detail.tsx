'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingBag, Check, Loader2, ImageOff, Info, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDA } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/components/cart-provider';
import type { ProductView } from '@/lib/serializers';

type Labels = {
  addToCart: string;
  added: string;
  outOfStock: string;
  inStock: string;
  lowStock: string;
  color: string;
  colors: string;
  sku: string;
  category: string;
  description: string;
  yourPrice: string;
  retailPrice: string;
  wholesalePrice: string;
  superWholesalePrice: string;
  minQuantity: string;
  minQuantityHint: string;
  quantityBelowMin: string;
  quantity: string;
  error: string;
  taxNote: string;
  wholesaleHint: string;
  wholesaleOnly: string;
};

export function ProductDetail({
  product,
  tier,
  signedIn,
  labels,
}: {
  product: ProductView;
  tier: 'RETAIL' | 'WHOLESALE' | 'SUPER_WHOLESALE';
  signedIn: boolean;
  labels: Labels;
}) {
  const router = useRouter();
  const cart = useCart();
  const [variantId, setVariantId] = React.useState<string | null>(
    product.variants.find((v) => v.available > 0)?.id ?? product.variants[0]?.id ?? null,
  );
  const [activeImage, setActiveImage] = React.useState(0);
  const [quantity, setQuantity] = React.useState(product.prices.effective.minQuantity);
  const [state, setState] = React.useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [message, setMessage] = React.useState<string | null>(null);

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0] ?? null;
  const rule = product.prices.effective;
  const minQty = rule.minQuantity;
  const available = variant?.available ?? 0;
  const outOfStock = available <= 0 || product.status === 'OUT_OF_STOCK';

  const gallery = React.useMemo(() => {
    const images = new Set<string>();
    product.variants.forEach((v) => v.image && images.add(v.image));
    if (product.image) images.add(product.image);
    return [...images];
  }, [product]);

  React.useEffect(() => {
    setActiveImage(0);
  }, [variantId]);

  React.useEffect(() => {
    setQuantity((current) => Math.max(minQty, current));
  }, [minQty]);

  const lineTotal = Number(rule.unitPrice) * quantity;

  async function addToCart() {
    if (!variantId || outOfStock) return;
    if (quantity < minQty) {
      setState('error');
      setMessage(labels.quantityBelowMin.replace('{count}', String(minQty)));
      return;
    }
    setState('adding');
    setMessage(null);
    const result = await cart.add({ productId: product.id, variantId, quantity });
    if (result.ok) {
      setState('added');
      router.refresh();
      window.setTimeout(() => setState('idle'), 2600);
    } else {
      setState('error');
      setMessage(result.error ?? labels.error);
    }
  }

  // Price rows visible to the current tier.
  const priceRows: { label: string; value: string; min: number; active: boolean }[] = [
    {
      label: labels.retailPrice,
      value: product.prices.retail.unitPrice,
      min: product.prices.retail.minQuantity,
      active: tier === 'RETAIL',
    },
  ];
  if (product.prices.wholesale) {
    priceRows.push({
      label: labels.wholesalePrice,
      value: product.prices.wholesale.unitPrice,
      min: product.prices.wholesale.minQuantity,
      active: tier === 'WHOLESALE',
    });
  }
  if (product.prices.superWholesale) {
    priceRows.push({
      label: labels.superWholesalePrice,
      value: product.prices.superWholesale.unitPrice,
      min: product.prices.superWholesale.minQuantity,
      active: tier === 'SUPER_WHOLESALE',
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      {/* gallery */}
      <div className="space-y-3">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-ink-100 bg-ink-50/60">
          {gallery[activeImage] ? (
            <Image
              src={gallery[activeImage]}
              alt={product.name}
              fill
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-ink-300"><ImageOff className="h-10 w-10" /></div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-[2px]">
              <Badge tone="dark" className="px-4 py-1.5 text-[12px]">{labels.outOfStock}</Badge>
            </div>
          )}
        </div>
        {gallery.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {gallery.map((src, index) => (
              <button
                key={src + index}
                type="button"
                onClick={() => setActiveImage(index)}
                className={cn(
                  'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-colors',
                  activeImage === index ? 'border-brand-500' : 'border-ink-100 hover:border-ink-200',
                )}
              >
                <Image src={src} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* info */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {product.category && (
            <Badge tone="neutral" className="uppercase tracking-wider">{product.category.name}</Badge>
          )}
          {product.status === 'AVAILABLE' && !outOfStock && (
            <Badge tone="success" dot>{labels.inStock}</Badge>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[32px]">
          {product.name}
        </h1>
        <p className="mt-1.5 text-[11.5px] text-ink-400">
          {labels.sku}: <span className="font-semibold text-ink-600" dir="ltr">{product.variants[0]?.sku ?? product.sku}</span>
        </p>

        {/* price block */}
        <div className="mt-5 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-4">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-brand-600">{labels.yourPrice}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span dir="ltr" className="text-[30px] font-extrabold leading-none tracking-tight text-ink-900">
              {formatDA(rule.unitPrice, 'fr')}
            </span>
            {tier !== 'RETAIL' && (
              <span className="text-[12px] font-medium text-ink-400 line-through" dir="ltr">
                {formatDA(product.prices.retail.unitPrice, 'fr')}
              </span>
            )}
          </div>
          {minQty > 1 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11.5px] font-bold text-brand-700">
              <Tag className="h-3 w-3" />
              {labels.minQuantityHint.replace('{count}', String(minQty))}
            </p>
          )}

          {priceRows.length > 1 && (
            <div className="mt-3 grid gap-1.5 border-t border-brand-100/80 pt-3">
              {priceRows.map((row) => (
                <div
                  key={row.label}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-2 py-1 text-[11.5px]',
                    row.active ? 'bg-white font-bold text-ink-900 ring-1 ring-brand-200' : 'text-ink-500',
                  )}
                >
                  <span>{row.label}</span>
                  <span className="flex items-center gap-2 tabular-nums" dir="ltr">
                    <span>{formatDA(row.value, 'fr')}</span>
                    <span className="text-[10px] text-ink-400">min {row.min}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {!signedIn && tier === 'RETAIL' && (
            <p className="mt-3 flex items-start gap-1.5 border-t border-brand-100/80 pt-3 text-[11.5px] text-ink-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
              <span>
                {labels.wholesaleHint}{' '}
                <a href="/login" className="font-semibold text-brand-600 hover:underline">
                  {labels.wholesaleOnly}
                </a>
              </span>
            </p>
          )}
        </div>

        {/* colours */}
        {product.variants.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-ink-700">
                {labels.color}: <span className="font-semibold text-ink-900">{variant?.colorName}</span>
              </p>
              <span className="text-[11px] text-ink-400">{labels.colors}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => {
                const disabled = v.available <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    disabled={disabled}
                    className={cn(
                      'flex items-center gap-2 rounded-full border py-1.5 pe-3 ps-1.5 text-[12px] font-semibold transition-all',
                      variantId === v.id
                        ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-100'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300',
                      disabled && 'cursor-not-allowed opacity-40 line-through',
                    )}
                  >
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: v.colorCode }}
                    >
                      {variantId === v.id && (
                        <Check
                          className="h-3 w-3"
                          style={{ color: isLight(v.colorCode) ? '#17181d' : '#ffffff' }}
                          strokeWidth={3}
                        />
                      )}
                    </span>
                    {v.colorName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* quantity + cart */}
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1.5 text-[12px] font-bold text-ink-700">{labels.quantity}</p>
            <div className="flex h-11 items-center rounded-full border border-ink-200 bg-white">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(minQty, value - 1))}
                className="grid h-11 w-11 place-items-center rounded-full text-ink-600 hover:bg-ink-50 disabled:opacity-30"
                disabled={quantity <= minQty}
                aria-label="Decrease"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                value={quantity}
                onChange={(event) => {
                  const next = Number(event.target.value.replace(/\D/g, ''));
                  setQuantity(Number.isFinite(next) && next > 0 ? next : minQty);
                }}
                onBlur={() => setQuantity((value) => Math.max(minQty, Math.min(value || minQty, Math.max(1, available))))}
                inputMode="numeric"
                dir="ltr"
                aria-label={labels.quantity}
                className="w-14 border-0 bg-transparent text-center text-[14px] font-bold text-ink-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.min(Math.max(minQty, available), value + 1))}
                className="grid h-11 w-11 place-items-center rounded-full text-ink-600 hover:bg-ink-50"
                aria-label="Increase"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={addToCart}
            disabled={outOfStock || state === 'adding' || !variantId}
            className="h-11 flex-1 min-w-44"
          >
            {state === 'adding' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : state === 'added' ? (
              <Check className="h-4 w-4" />
            ) : (
              <ShoppingBag className="h-4 w-4" />
            )}
            {outOfStock ? labels.outOfStock : state === 'added' ? labels.added : labels.addToCart}
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span className="text-ink-500">
            {outOfStock ? labels.outOfStock : labels.taxNote.replace('{count}', String(available))}
          </span>
          <span className="font-bold text-ink-900" dir="ltr">
            {formatDA(lineTotal, 'fr')}
          </span>
        </div>

        {message && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{message}</p>
        )}

        {/* description */}
        <div className="mt-8 border-t border-ink-100 pt-6">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">{labels.description}</h2>
          <p className="mt-2.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-600">
            {product.description || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

function isLight(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
