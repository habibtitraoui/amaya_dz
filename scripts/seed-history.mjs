// Generates realistic historical orders for the analytics dashboards.
// Idempotent: skips when history already exists unless --force.
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/amaya';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL, max: 4 }) });

const money = (n) => Number(n).toFixed(2);
const YEAR = new Date().getFullYear();

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function daysAgo(min, max) {
  const ms = (min + Math.random() * (max - min)) * 86400000;
  return new Date(Date.now() - ms);
}

async function main() {
  const force = process.argv.includes('--force');
  const existing = await prisma.order.count();
  const target = 34;
  if (existing >= target && !force) {
    console.log(`[seed-history] ${existing} orders already present — skipping.`);
    return;
  }

  const products = await prisma.product.findMany({
    include: { variants: { where: { isActive: true } }, translations: true },
  });
  if (products.length === 0) {
    console.log('[seed-history] no products, run the main seed first.');
    return;
  }

  const customers = await prisma.user.findMany({ where: { role: 'CUSTOMER' } });
  const supervisor = await prisma.user.findFirst({ where: { role: 'SUPERVISOR' } });

  const guests = [
    { name: 'Amine Khelifi', phone: '0550 11 22 33', city: 'Oran', address: 'Cité 200 logements, Bt C' },
    { name: 'Sara Benkhelil', phone: '0661 44 55 66', city: 'Alger', address: 'Rue Didouche Mourad, n°22' },
    { name: 'Youssef Mansouri', phone: '0770 77 88 99', city: 'Constantine', address: 'Ali Mendjeli, UV 8' },
    { name: 'Nour El Houda', phone: '0555 33 22 11', city: 'Sétif', address: 'Cité El Hidhab, Bt 4' },
    { name: 'Bilal Rahmani', phone: '0698 12 34 56', city: 'Tlemcen', address: 'Rue Ibn Khaldoun, n°7' },
    { name: 'Meriem Saadi', phone: '0540 98 76 54', city: 'Béjaïa', address: 'Cité Aamri, villas 12' },
    { name: 'Islam Bouzid', phone: '0771 23 45 67', city: 'Blida', address: 'Ouled Yaïch, rue 5' },
  ];

  // Recompute running sequence so we don't collide with manual seed orders.
  const sequence = await prisma.sequence.findUnique({ where: { key: 'order' } });
  let seq = sequence?.value ?? existing;

  const statusPool = [
    'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED',
    'SHIPPED', 'SHIPPED',
    'READY', 'PREPARING', 'CONFIRMED', 'CONFIRMED',
    'CANCELLED',
  ];

  let created = 0;
  while (existing + created < target) {
    const status = pick(statusPool);
    const when = daysAgo(0, 150);
    const isWholesale = Math.random() < 0.42;
    const customer = isWholesale ? pick(customers) : null;
    const tier = customer?.tier ?? 'RETAIL';

    // Build 1–3 lines with tier pricing.
    const lines = [];
    const used = new Set();
    const lineCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < lineCount; i += 1) {
      const product = pick(products);
      if (!product.variants.length || used.has(product.id)) continue;
      used.add(product.id);
      const variant = pick(product.variants);
      const price =
        tier === 'SUPER_WHOLESALE'
          ? Number(product.superWholesalePrice)
          : tier === 'WHOLESALE'
            ? Number(product.wholesalePrice)
            : Number(product.retailPrice);
      const minQty = tier === 'SUPER_WHOLESALE' ? product.superWholesaleMinQty : tier === 'WHOLESALE' ? product.wholesaleMinQty : 1;
      const quantity = tier === 'RETAIL' ? 1 + Math.floor(Math.random() * 2) : minQty + Math.floor(Math.random() * 3) * minQty;
      const frName = product.translations.find((t) => t.locale === 'FR')?.name ?? product.sku;
      const enName = product.translations.find((t) => t.locale === 'EN')?.name ?? frName;
      lines.push({
        productId: product.id,
        variantId: variant.id,
        productNameSnapshot: enName,
        productNameFrSnapshot: frName,
        skuSnapshot: variant.sku,
        colorSnapshot: variant.colorNameFr,
        quantity,
        unitPrice: price,
        lineTotal: price * quantity,
        tier,
      });
    }
    if (lines.length === 0) continue;

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    seq += 1;
    const customerName = customer?.name ?? pick(guests).name;
    const guestInfo = guests.find((guest) => guest.name === customerName) ?? pick(guests);
    const confirmedAt = ['CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED'].includes(status)
      ? new Date(when.getTime() + 3600000)
      : null;

    const order = await prisma.order.create({
      data: {
        orderNumber: `AMY-${YEAR}-${String(seq).padStart(5, '0')}`,
        customerId: customer?.id ?? null,
        customerNameSnapshot: customerName,
        customerPhoneSnapshot: customer?.phone ?? guestInfo.phone,
        customerAddressSnapshot: customer?.profile?.address ?? guestInfo.address,
        customerCitySnapshot: customer?.profile?.city ?? guestInfo.city,
        customerTypeSnapshot: tier,
        subtotal: money(subtotal),
        discount: '0.00',
        deliveryFee: '0.00',
        totalAmount: money(subtotal),
        status,
        deliveryMethod: 'DELIVERY',
        createdAt: when,
        confirmedAt,
        deliveredAt: status === 'DELIVERED' ? new Date(when.getTime() + 2 * 86400000) : null,
        cancelledAt: status === 'CANCELLED' ? new Date(when.getTime() + 3600000) : null,
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            productNameSnapshot: line.productNameSnapshot,
            productNameFrSnapshot: line.productNameFrSnapshot,
            skuSnapshot: line.skuSnapshot,
            colorSnapshot: line.colorSnapshot,
            quantity: line.quantity,
            unitPriceSnapshot: money(line.unitPrice),
            lineTotal: money(line.lineTotal),
            tierSnapshot: line.tier,
          })),
        },
        statusHistory: {
          create: [
            { fromStatus: null, toStatus: 'PENDING', note: 'Order created', createdAt: when },
            ...(confirmedAt ? [{ fromStatus: 'PENDING', toStatus: status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED', createdAt: confirmedAt }] : []),
          ],
        },
      },
    });

    // History is illustrative only: never move live stock or reservations,
    // otherwise the demo catalogue ends up sold out. Real reservations are
    // created exclusively by the order confirmation flow.
    for (const line of lines) {
      await prisma.product.update({
        where: { id: line.productId },
        data: { salesCount: { increment: status === 'Cancelled' ? 0 : line.quantity } },
      }).catch(() => null);
    }

    // A French invoice for every delivered / shipped order.
    if (['DELIVERED', 'SHIPPED'].includes(status) && Math.random() < 0.7) {
      const invoiceSeq = await prisma.sequence.upsert({
        where: { key: 'invoice' },
        create: { key: 'invoice', value: 0 },
        update: { value: { increment: 1 } },
      });
      const number = `FAC-${YEAR}-${String(invoiceSeq.value).padStart(5, '0')}`;
      await prisma.invoice.create({
        data: {
          number,
          orderId: order.id,
          version: 1,
          issuedById: supervisor?.id ?? null,
          issuedAt: confirmedAt ?? when,
          customerNameSnapshot: customerName,
          customerPhoneSnapshot: customer?.phone ?? guestInfo.phone,
          customerAddressSnapshot: `${customer?.profile?.address ?? guestInfo.address}, ${customer?.profile?.city ?? guestInfo.city}`,
          subtotal: money(subtotal),
          discount: '0.00',
          deliveryFee: '0.00',
          totalAmount: money(subtotal),
          snapshot: { orderNumber: order.orderNumber, customerType: tier },
          items: {
            create: lines.map((line) => ({
              reference: line.skuSnapshot,
              designation: line.productNameFrSnapshot,
              color: line.colorSnapshot,
              quantity: line.quantity,
              unitPrice: money(line.unitPrice),
              lineTotal: money(line.lineTotal),
            })),
          },
        },
      });
    }

    created += 1;
  }

  await prisma.sequence.upsert({ where: { key: 'order' }, create: { key: 'order', value: seq }, update: { value: seq } });

  await prisma.auditLog.create({
    data: {
      actorName: 'system',
      action: 'seed.history',
      entityType: 'System',
      summary: `Generated ${created} historical orders`,
    },
  });

  console.log(`[seed-history] ${created} historical orders created.`);
}

main()
  .catch((error) => {
    console.error('[seed-history] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
