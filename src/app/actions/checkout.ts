'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getCartView } from '@/app/actions/cart';
import { placeOrder } from '@/lib/services/orders';
import { toActionState, type ActionState } from '@/lib/errors';
import { getLocale } from '@/lib/locale';

const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(24)
    .regex(/^[0-9+\s().-]+$/),
  address: z.string().trim().min(4).max(400),
  city: z.string().trim().max(80).optional().default(''),
  notes: z.string().trim().max(600).optional().default(''),
  deliveryMethod: z.enum(['DELIVERY', 'PICKUP']).default('DELIVERY'),
});

export type CheckoutState =
  | { ok: true; orderNumber: string; id: string }
  | { ok: false; error: string; code?: string; field?: string };

/**
 * Guest + authenticated checkout in one path. The customer type is resolved
 * from the session — a retail visitor can never send WHOLESALE.
 */
export async function placeOrderAction(input: unknown): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? 'Invalid form', code: 'VALIDATION', field: String(issue?.path[0] ?? '') };
  }

  const user = await getCurrentUser();
  const cart = await getCartView();
  if (!cart.quote || cart.lines.length === 0) {
    return { ok: false, error: 'Cart is empty', code: 'VALIDATION' };
  }

  const locale = await getLocale();
  try {
    const order = await placeOrder({
      items: cart.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
      })),
      customerName: user?.name ?? parsed.data.name,
      customerPhone: parsed.data.phone,
      customerAddress: parsed.data.address,
      customerCity: parsed.data.city,
      notes: parsed.data.notes,
      deliveryMethod: parsed.data.deliveryMethod,
      tier: user?.tier ?? 'RETAIL',
      customerId: user?.role === 'CUSTOMER' ? user.id : null,
      createdById: user?.id ?? null,
      locale,
    });
    return { ok: true, orderNumber: order.orderNumber, id: order.id };
  } catch (error) {
    const state = toActionState(error);
    return state.ok ? { ok: false, error: 'Unexpected error' } : state;
  }
}

/** Clears the cart cookie after a successful order and navigates to the receipt. */
export async function finishCheckoutAction(input: { orderNumber: string; name: string; phone: string }) {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  store.delete('amaya_cart');
  const params = new URLSearchParams({ name: input.name, phone: input.phone });
  redirect(`/checkout/success/${encodeURIComponent(input.orderNumber)}?${params.toString()}`);
}
