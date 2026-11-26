'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { addToCartAction, clearCartAction, removeCartLineAction, updateCartLineAction } from '@/app/actions/cart';

type CartCtx = {
  count: number;
  pending: boolean;
  add: (input: { productId: string; variantId: string; quantity: number }) => Promise<{ ok: boolean; error?: string }>;
  update: (input: { productId: string; variantId: string; quantity: number }) => Promise<void>;
  remove: (input: { productId: string; variantId: string }) => Promise<void>;
  clear: () => Promise<void>;
};

const CartContext = React.createContext<CartCtx | null>(null);

export function CartProvider({ initialCount, children }: { initialCount: number; children: React.ReactNode }) {
  const router = useRouter();
  const [count, setCount] = React.useState(initialCount);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setCount(initialCount), [initialCount]);

  const add = React.useCallback<CartCtx['add']>(
    async (input) => {
      setPending(true);
      try {
        const result = await addToCartAction(input);
        if (result.ok) {
          setCount((current) => current + input.quantity);
          router.refresh();
          return { ok: true };
        }
        return { ok: false, error: result.error };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not add to cart' };
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  const update = React.useCallback<CartCtx['update']>(
    async (input) => {
      setPending(true);
      try {
        await updateCartLineAction(input);
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  const remove = React.useCallback<CartCtx['remove']>(
    async (input) => {
      setPending(true);
      try {
        await removeCartLineAction(input);
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  const clear = React.useCallback<CartCtx['clear']>(async () => {
    setPending(true);
    try {
      await clearCartAction();
      setCount(0);
      router.refresh();
    } finally {
      setPending(false);
    }
  }, [router]);

  return <CartContext.Provider value={{ count, pending, add, update, remove, clear }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
