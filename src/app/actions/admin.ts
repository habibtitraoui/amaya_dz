'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, can } from '@/lib/auth';
import { AppError, toActionState, type ActionState } from '@/lib/errors';
import { changeOrderStatus } from '@/lib/services/orders';
import { issueInvoice } from '@/lib/services/orders';
import { adjustStock } from '@/lib/services/inventory';
import { createCustomer, suspendCustomer, updateCustomer } from '@/lib/services/customers';
import { createProduct, setProductStatus, toggleFeatured, updateProduct } from '@/lib/services/products';
import { logAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/password';
import { ORDER_STATUSES } from '@/lib/pricing';


/** Every admin action re-checks the role server-side — the UI is never trusted. */
async function actor(permission: 'manageOrders' | 'issueInvoices' | 'manageStock' | 'manageCustomers' | 'manageProducts' | 'manageCategories' | null) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR')) {
    throw new AppError('FORBIDDEN', 'Staff access required', 403);
  }
  if (permission && !can(user, permission)) {
    throw new AppError('FORBIDDEN', 'You do not have permission for this action', 403);
  }
  return user;
}

function refresh() {
  revalidatePath('/', 'layout');
}

/* ------------------------------------------------------------------- orders */

const statusInput = z.object({
  orderId: z.string().min(1),
  status: z.enum(ORDER_STATUSES as unknown as [string, ...string[]]),
  note: z.string().max(400).optional(),
});

export async function updateOrderStatusAction(input: unknown): Promise<ActionState> {
  try {
    const user = await actor('manageOrders');
    const parsed = statusInput.safeParse(input);
    if (!parsed.success) throw new AppError('VALIDATION', 'Invalid status change');
    const order = await changeOrderStatus({
      orderId: parsed.data.orderId,
      to: parsed.data.status as never,
      actor: { id: user.id, name: user.name },
      note: parsed.data.note,
    });
    refresh();
    return { ok: true, data: { status: order.status } };
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateOrderNotesAction(input: { orderId: string; internalNotes: string }): Promise<ActionState> {
  try {
    const user = await actor('manageOrders');
    await prisma.order.update({
      where: { id: input.orderId },
      data: { internalNotes: input.internalNotes.slice(0, 2000) },
    });
    await logAudit({
      actorId: user.id,
      actorName: user.name,
      action: 'order.notes',
      entityType: 'Order',
      entityId: input.orderId,
      summary: 'Internal notes updated',
    });
    revalidatePath(`/admin/orders/${input.orderId}`);
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function issueInvoiceAction(orderId: string): Promise<ActionState> {
  try {
    const user = await actor('issueInvoices');
    const invoice = await issueInvoice(orderId, { id: user.id, name: user.name });
    refresh();
    return { ok: true, data: { id: invoice.id, number: invoice.number } };
  } catch (error) {
    return toActionState(error);
  }
}

/* -------------------------------------------------------------------- stock */

export async function adjustStockAction(input: { variantId: string; delta: number; reason?: string }): Promise<ActionState> {
  try {
    const user = await actor('manageStock');
    const variant = await adjustStock({
      variantId: input.variantId,
      delta: Math.trunc(input.delta),
      reason: input.reason,
      actor: { id: user.id, name: user.name },
    });
    refresh();
    return { ok: true, data: { stockQuantity: variant.stockQuantity } };
  } catch (error) {
    return toActionState(error);
  }
}

/* ---------------------------------------------------------------- customers */

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().email('Valid email required'),
  phone: z.string().trim().optional().default(''),
  tier: z.enum(['WHOLESALE', 'SUPER_WHOLESALE']),
  businessName: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  city: z.string().trim().optional().default(''),
  wilaya: z.string().trim().optional().default(''),
  password: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export async function createCustomerAction(input: unknown): Promise<ActionState> {
  try {
    const user = await actor('manageCustomers');
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) throw new AppError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid data');
    const result = await createCustomer(parsed.data, { id: user.id, name: user.name });
    refresh();
    return {
      ok: true,
      data: { id: result.user.id, temporaryPassword: result.temporaryPassword },
      message: result.temporaryPassword,
    };
  } catch (error) {
    return toActionState(error);
  }
}

const customerUpdateSchema = customerSchema.partial().extend({ id: z.string(), resetPassword: z.boolean().optional() });

export async function updateCustomerAction(input: unknown): Promise<ActionState> {
  try {
    const user = await actor('manageCustomers');
    const parsed = customerUpdateSchema.safeParse(input);
    if (!parsed.success) throw new AppError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid data');
    const existing = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!existing) throw new AppError('NOT_FOUND', 'Customer not found');
    const result = await updateCustomer(
      parsed.data.id,
      {
        name: parsed.data.name ?? existing.name,
        email: parsed.data.email ?? existing.email,
        phone: parsed.data.phone,
        tier: (parsed.data.tier ?? existing.tier) as 'WHOLESALE' | 'SUPER_WHOLESALE',
        businessName: parsed.data.businessName,
        address: parsed.data.address,
        city: parsed.data.city,
        wilaya: parsed.data.wilaya,
        notes: parsed.data.notes,
        resetPassword: parsed.data.resetPassword,
      },
      { id: user.id, name: user.name },
    );
    refresh();
    return { ok: true, data: { temporaryPassword: result.temporaryPassword }, message: result.temporaryPassword ?? undefined };
  } catch (error) {
    return toActionState(error);
  }
}

export async function suspendCustomerAction(input: { id: string; status: 'ACTIVE' | 'SUSPENDED' }): Promise<ActionState> {
  try {
    const user = await actor('manageCustomers');
    await suspendCustomer(input.id, input.status, { id: user.id, name: user.name });
    refresh();
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

/* ----------------------------------------------------------------- products */

const productSchema = z.object({
  sku: z.string().trim().min(2, 'SKU required'),
  categoryId: z.string().min(1, 'Category required'),
  retailPrice: z.coerce.number().min(0),
  wholesalePrice: z.coerce.number().min(0),
  superWholesalePrice: z.coerce.number().min(0),
  wholesaleMinQty: z.coerce.number().int().min(1),
  superWholesaleMinQty: z.coerce.number().int().min(1),
  status: z.enum(['AVAILABLE', 'OUT_OF_STOCK', 'HIDDEN', 'ARCHIVED']).optional(),
  isFeatured: z.coerce.boolean().optional(),
  translations: z.array(z.object({ locale: z.enum(['AR', 'FR', 'EN']), name: z.string(), description: z.string().optional() })),
  images: z.array(z.object({ url: z.string(), alt: z.string().optional() })).optional(),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        sku: z.string().trim().min(1),
        colorNameFr: z.string().trim().min(1),
        colorNameAr: z.string().trim().optional().default(''),
        colorNameEn: z.string().trim().optional().default(''),
        colorCode: z.string().optional().default('#111111'),
        image: z.string().optional().nullable(),
        stockQuantity: z.coerce.number().int().min(0),
      }),
    )
    .optional(),
});

export async function saveProductAction(input: unknown, productId?: string): Promise<ActionState> {
  try {
    const user = await actor('manageProducts');
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) throw new AppError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid product');
    const payload = {
      ...parsed.data,
      variants: parsed.data.variants?.map((variant) => ({
        ...variant,
        colorNameAr: variant.colorNameAr || variant.colorNameFr,
        colorNameEn: variant.colorNameEn || variant.colorNameFr,
      })),
    };
    const product = productId
      ? await updateProduct(productId, payload as never, { id: user.id, name: user.name })
      : await createProduct(payload as never, { id: user.id, name: user.name });
    revalidatePath('/', 'layout');
    return { ok: true, data: { id: product?.id } };
  } catch (error) {
    return toActionState(error);
  }
}

export async function setProductStatusAction(input: {
  id: string;
  status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'HIDDEN' | 'ARCHIVED';
}): Promise<ActionState> {
  try {
    const user = await actor('manageProducts');
    await setProductStatus(input.id, input.status, { id: user.id, name: user.name });
    refresh();
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function toggleFeaturedAction(input: { id: string; featured: boolean }): Promise<ActionState> {
  try {
    const user = await actor('manageProducts');
    await toggleFeatured(input.id, input.featured, { id: user.id, name: user.name });
    refresh();
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

/* --------------------------------------------------------------- categories */

const categorySchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().optional(),
  image: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  translations: z.array(z.object({ locale: z.enum(['AR', 'FR', 'EN']), name: z.string().trim().min(1), description: z.string().optional() })),
});

export async function saveCategoryAction(input: unknown): Promise<ActionState> {
  try {
    const user = await actor('manageCategories');
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) throw new AppError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid category');
    const fr = parsed.data.translations.find((t) => t.locale === 'FR');
    if (!fr) throw new AppError('VALIDATION', 'French name is required');

    const slug = (parsed.data.slug || fr.name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const category = await prisma.$transaction(async (tx) => {
      const base = parsed.data.id
        ? await tx.category.update({
            where: { id: parsed.data.id },
            data: { slug, image: parsed.data.image || null, isActive: parsed.data.isActive ?? true, sortOrder: parsed.data.sortOrder ?? 0 },
          })
        : await tx.category.create({
            data: { slug, image: parsed.data.image || null, isActive: parsed.data.isActive ?? true, sortOrder: parsed.data.sortOrder ?? 0 },
          });
      for (const translation of parsed.data.translations) {
        await tx.categoryTranslation.upsert({
          where: { categoryId_locale: { categoryId: base.id, locale: translation.locale } },
          create: { categoryId: base.id, ...translation, description: translation.description || null },
          update: { name: translation.name, description: translation.description || null },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          action: parsed.data.id ? 'category.update' : 'category.create',
          entityType: 'Category',
          entityId: base.id,
          summary: `${fr.name} (${slug}) ${parsed.data.id ? 'updated' : 'created'}`,
        },
      });
      return base;
    });
    refresh();
    return { ok: true, data: { id: category.id } };
  } catch (error) {
    return toActionState(error);
  }
}

export async function toggleCategoryAction(input: { id: string; isActive: boolean }): Promise<ActionState> {
  try {
    const user = await actor('manageCategories');
    await prisma.category.update({ where: { id: input.id }, data: { isActive: input.isActive } });
    await logAudit({
      actorId: user.id,
      actorName: user.name,
      action: 'category.status',
      entityType: 'Category',
      entityId: input.id,
      summary: `Category ${input.id} isActive = ${input.isActive}`,
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}

/* -------------------------------------------------------------- supervisors */

const supervisorSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  permissions: z.record(z.string(), z.boolean()).optional(),
});

export async function createSupervisorAction(input: unknown): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'Only administrators can create supervisors', 403);
    const parsed = supervisorSchema.safeParse(input);
    if (!parsed.success) throw new AppError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid data');
    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('CONFLICT', 'This email is already registered');
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash: await hashPassword(parsed.data.password),
        role: 'SUPERVISOR',
        status: 'ACTIVE',
        permissions: (parsed.data.permissions ?? undefined) as never,
        createdById: user.id,
      },
    });
    await logAudit({
      actorId: user.id,
      actorName: user.name,
      action: 'supervisor.create',
      entityType: 'User',
      entityId: created.id,
      summary: `Supervisor ${created.email} created`,
    });
    refresh();
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return toActionState(error);
  }
}

export async function updateSupervisorPermissionsAction(input: {
  id: string;
  permissions: Record<string, boolean>;
  status?: 'ACTIVE' | 'SUSPENDED';
}): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') throw new AppError('FORBIDDEN', 'Administrator only', 403);
    const target = await prisma.user.findUnique({ where: { id: input.id } });
    if (!target || target.role !== 'SUPERVISOR') throw new AppError('NOT_FOUND', 'Supervisor not found');
    await prisma.user.update({
      where: { id: input.id },
      data: { permissions: input.permissions as never, ...(input.status ? { status: input.status } : {}) },
    });
    await logAudit({
      actorId: user.id,
      actorName: user.name,
      action: 'supervisor.permissions',
      entityType: 'User',
      entityId: input.id,
      summary: `Permissions updated for ${target.email}`,
      metadata: input.permissions,
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return toActionState(error);
  }
}
