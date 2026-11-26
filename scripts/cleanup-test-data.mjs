/**
 * Remove QA residue created by data-filling demos (acceptance runs, browser
 * checks). Financial history is never deleted: only orders/audit rows whose
 * customer is the QA placeholder, plus test customer accounts.
 *
 *   npx tsx scripts/cleanup-test-data.mjs --dry-run
 *   npx tsx scripts/cleanup-test-data.mjs
 */
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/amaya' }),
});
const dry = process.argv.includes('--dry-run');

const QA_NAMES = ['Test Acceptance', 'Test QA', 'Test Gros', 'Test SG', 'Test Survente', 'Test Réservation', 'Test Annulation', 'Test Data'];
const QA_EMAIL_PATTERN = ['qa-', 'test-'];

async function main() {
  const orders = await prisma.order.findMany({
    where: { customerNameSnapshot: { in: QA_NAMES }, customerId: null },
    select: { id: true, orderNumber: true },
  });
  const users = await prisma.user.findMany({
    where: { role: 'CUSTOMER', OR: QA_EMAIL_PATTERN.map((prefix) => ({ email: { startsWith: prefix } })) },
    select: { id: true, email: true },
  });

  console.log(`orders to remove: ${orders.length}${dry ? ' (dry run)' : ''}`);
  console.log(`test accounts to remove: ${users.length}${dry ? ' (dry run)' : ''}`);
  if (dry) return;

  if (orders.length) {
    const ids = orders.map((order) => order.id);
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { orderId: { in: ids } } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.stockMovement.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }
  if (users.length) {
    const ids = users.map((user) => user.id);
    // Orders and invoices are financial records: detach them from the test
    // account (snapshots already hold the customer name/address) rather than
    // deleting the history. Staff attribution is cleared the same way.
    await prisma.order.updateMany({ where: { customerId: { in: ids } }, data: { customerId: null } });
    await prisma.order.updateMany({ where: { createdById: { in: ids } }, data: { createdById: null } });
    await prisma.invoice.updateMany({ where: { issuedById: { in: ids } }, data: { issuedById: null } });
    await prisma.orderStatusHistory.updateMany({ where: { changedById: { in: ids } }, data: { changedById: null } });
    await prisma.auditLog.updateMany({ where: { actorId: { in: ids } }, data: { actorId: null } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.auditLog.deleteMany({ where: { summary: { contains: 'Test action' } } });
  console.log('done');
}

main()
  .catch((error) => {
    console.error('cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
