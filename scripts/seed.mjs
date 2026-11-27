// Seed AMAYA with realistic demo data.
// Safe to re-run: it exits early when users already exist unless --force.
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const scrypt = promisify(scryptCb);
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/amaya';

/**
 * Catalog artwork now lives in `assets/catalog/**` (seed masters, outside
 * `public/`). The seed uploads each master to Neon Object Storage and stores
 * the returned public URL, matching what the admin UI produces.
 *
 * Without storage credentials — or when `SEED_ASSET_MODE=public` — every
 * reference is copied into the local `public/` folder instead, so a bare
 * `npm run dev` (embedded PGlite, no Neon project) still renders images.
 */
const ASSET_ROOT = path.join(process.cwd(), 'assets', 'catalog');
const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};
const LEGACY_REFERENCES = [
  ...new Set(
    // Every `/products/…` and `/categories/…` path the demo data mentions.
    (await readFile(new URL(import.meta.url), 'utf8')).match(
      /\/(?:products|categories)\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp|avif)/g,
    ) ?? [],
  ),
];

const storageEndpoint = process.env.AWS_ENDPOINT_URL_S3?.replace(/\/+$/, '');
const storageBucket = process.env.NEON_STORAGE_BUCKET;
const assetMode =
  process.env.SEED_ASSET_MODE === 'public' || !storageEndpoint || !storageBucket
    ? 'public'
    : 'storage';

const s3 =
  assetMode === 'storage'
    ? new S3Client({
        region: process.env.AWS_REGION || 'eu-central-1',
        endpoint: storageEndpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        },
      })
    : null;

/** Legacy reference → URL persisted in the database. */
const assetUrls = new Map();

async function publishAssets() {
  if (assetMode === 'public') {
    console.log('[seed] storage not configured — copying catalog art into public/ for local use.');
    for (const reference of LEGACY_REFERENCES) {
      const [, dir, file] = /^\/(products|categories)\/(.+)$/.exec(reference);
      const target = path.join(process.cwd(), 'public', dir, file);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(path.join(ASSET_ROOT, dir, file), target);
      assetUrls.set(reference, reference);
    }
    return;
  }

  console.log(`[seed] uploading ${LEGACY_REFERENCES.length} catalog images to object storage…`);
  for (const reference of LEGACY_REFERENCES) {
    const [, dir, file] = /^\/(products|categories)\/(.+)$/.exec(reference);
    const key = `catalog/${dir}/${file}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: storageBucket,
        Key: key,
        Body: await readFile(path.join(ASSET_ROOT, dir, file)),
        ContentType: CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    assetUrls.set(reference, `${storageEndpoint}/${storageBucket}/${key}`);
  }
}

/** Resolve a demo reference to its published URL (falls back to the raw path). */
const asset = (reference) => assetUrls.get(reference) ?? reference;

async function hash(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL, max: 4 }) });

const money = (n) => Number(n).toFixed(2);

const buildCategories = () => [
  {
    slug: 'airpods',
    image: asset('/categories/airpods.jpg'),
    names: { AR: 'سماعات لاسلكية', FR: 'Écouteurs sans fil', EN: 'Wireless earbuds' },
    descriptions: {
      AR: 'سماعات لاسلكية بجودة صوت عالية وعزل ضجيج.',
      FR: 'Écouteurs sans fil, son haute fidélité et réduction de bruit.',
      EN: 'Wireless earbuds with high-fidelity sound and noise isolation.',
    },
  },
  {
    slug: 'chargers',
    image: asset('/categories/chargers.jpg'),
    names: { AR: 'شواحن', FR: 'Chargeurs', EN: 'Chargers' },
    descriptions: {
      AR: 'شواحن سريعة وآمنة لكل الهواتف.',
      FR: 'Chargeurs rapides et sûrs pour tous les téléphones.',
      EN: 'Fast and safe chargers for every phone.',
    },
  },
  {
    slug: 'cables',
    image: asset('/categories/cables.jpg'),
    names: { AR: 'كوابل', FR: 'Câbles', EN: 'Cables' },
    descriptions: {
      AR: 'كوابل شحن ونقل بيانات متينة.',
      FR: 'Câbles de charge et de transfert robustes.',
      EN: 'Durable charging and data cables.',
    },
  },
  {
    slug: 'cases',
    image: asset('/categories/cases.jpg'),
    names: { AR: 'أغطية الهواتف', FR: 'Coques', EN: 'Phone cases' },
    descriptions: {
      AR: 'حماية أنيقة لهاتفك.',
      FR: 'Une protection élégante pour votre téléphone.',
      EN: 'Elegant protection for your phone.',
    },
  },
  {
    slug: 'screen-protectors',
    image: asset('/categories/screen.jpg'),
    names: { AR: 'واقيات الشاشة', FR: 'Protections d’écran', EN: 'Screen protectors' },
    descriptions: {
      AR: 'زجاج مقسّى ضد الصدمات والخدوش.',
      FR: 'Verre trempé anti-chocs et anti-rayures.',
      EN: 'Tempered glass, shock and scratch resistant.',
    },
  },
  {
    slug: 'power-banks',
    image: asset('/categories/powerbank.jpg'),
    names: { AR: 'بطاريات متنقلة', FR: 'Batteries externes', EN: 'Power banks' },
    descriptions: {
      AR: 'طاقة احتياطية أينما كنت.',
      FR: 'De l’énergie partout, tout le temps.',
      EN: 'Backup power wherever you go.',
    },
  },
  {
    slug: 'headphones',
    image: asset('/categories/headphones.jpg'),
    names: { AR: 'سماعات رأس', FR: 'Casques', EN: 'Headphones' },
    descriptions: {
      AR: 'صوت نقي منخفض الجهير وعزل ممتاز.',
      FR: 'Son immersif, basses profondes et isolation excellente.',
      EN: 'Immersive sound, deep bass and excellent isolation.',
    },
  },
  {
    slug: 'accessories',
    image: asset('/categories/accessories.jpg'),
    names: { AR: 'إكسسوارات', FR: 'Accessoires', EN: 'Accessories' },
    descriptions: {
      AR: 'كل ما تحتاجه لهاتفك.',
      FR: 'Tout ce qu’il faut pour votre téléphone.',
      EN: 'Everything your phone needs.',
    },
  },
];

const buildProducts = () => [
  {
    sku: 'AMY-AP-001',
    category: 'airpods',
    names: {
      AR: 'سماعات AirPods Pro 2',
      FR: 'Écouteurs AirPods Pro 2',
      EN: 'AirPods Pro 2 earbuds',
    },
    descriptions: {
      AR: 'إلغاء ضوضاء نشط، صوت محيطي، وعلبة شحن لاسلكي. بطارية تدوم حتى 30 ساعة مع العلبة.',
      FR: 'Réduction de bruit active, audio spatial et boîtier de charge sans fil. Jusqu’à 30 heures d’autonomie avec le boîtier.',
      EN: 'Active noise cancellation, spatial audio and a wireless charging case. Up to 30 hours with the case.',
    },
    retail: 6500, wholesale: 5800, superWholesale: 5200, wMin: 5, sMin: 10,
    images: [asset('/products/airpods-pro-white.jpg'), asset('/products/airpods-pro-black.jpg'), asset('/products/airpods-pro-pink.jpg')],
    featured: true,
    variants: [
      { fr: 'Blanc', ar: 'أبيض', en: 'White', code: '#F2F2F2', stock: 294, image: asset('/products/airpods-pro-white.jpg') },
      { fr: 'Noir', ar: 'أسود', en: 'Black', code: '#1A1A1A', stock: 189, image: asset('/products/airpods-pro-black.jpg') },
      { fr: 'Rose', ar: 'وردي', en: 'Pink', code: '#F3C6D4', stock: 60, image: asset('/products/airpods-pro-pink.jpg') },
    ],
  },
  {
    sku: 'AMY-CH-020',
    category: 'chargers',
    names: {
      AR: 'شاحن سريع 20W USB-C',
      FR: 'Chargeur rapide 20W USB-C',
      EN: '20W USB-C fast charger',
    },
    descriptions: {
      AR: 'شاحن جداري مدمج 20W يدعم الشحن السريع PD. متوافق مع جميع هواتف آيفون وأندرويد.',
      FR: 'Chargeur mural compact 20W compatible Power Delivery. Compatible avec tous les iPhone et Android.',
      EN: 'Compact 20W wall charger with Power Delivery. Works with all iPhone and Android phones.',
    },
    retail: 1200, wholesale: 950, superWholesale: 800, wMin: 10, sMin: 25,
    images: [asset('/products/charger-20w.jpg')],
    featured: true,
    variants: [
      { fr: 'Blanc', ar: 'أبيض', en: 'White', code: '#FFFFFF', stock: 840, image: asset('/products/charger-20w.jpg') },
    ],
  },
  {
    sku: 'AMY-CB-050',
    category: 'cables',
    names: {
      AR: 'كابل USB-C مضفّر 1 متر',
      FR: 'Câble USB-C tressé 1 m',
      EN: 'Braided USB-C cable 1 m',
    },
    descriptions: {
      AR: 'كابل نايلون مضفّر مقاوم للتشابك، يدعم شحن 60W ونقل بيانات حتى 480Mbps.',
      FR: 'Câble en nylon tressé anti-emmêlement, charge 60W et transfert de données jusqu’à 480 Mbps.',
      EN: 'Tangle-proof braided nylon cable, 60W charging and data transfer up to 480 Mbps.',
    },
    retail: 900, wholesale: 650, superWholesale: 520, wMin: 20, sMin: 50,
    images: [asset('/products/cable-usbc-braided.jpg')],
    variants: [
      { fr: 'Gris graphite', ar: 'رمادي', en: 'Graphite', code: '#4A4E57', stock: 2100, image: asset('/products/cable-usbc-braided.jpg') },
    ],
  },
  {
    sku: 'AMY-CS-101',
    category: 'cases',
    names: {
      AR: 'غطاء شفاف ماغ سيف',
      FR: 'Coque transparente MagSafe',
      EN: 'Clear MagSafe case',
    },
    descriptions: {
      AR: 'غطاء شفاف مضاد للاصفرار مع حلقة مغناطيسية متوافقة مع MagSafe. حماية كاملة للحواف.',
      FR: 'Coque transparente anti-jaunissement avec anneau magnétique MagSafe. Protection complète des bords.',
      EN: 'Anti-yellowing clear case with a MagSafe magnetic ring. Full edge protection.',
    },
    retail: 2500, wholesale: 1900, superWholesale: 1600, wMin: 10, sMin: 30,
    images: [asset('/products/case-clear-magsafe.jpg')],
    featured: true,
    variants: [
      { fr: 'Transparent', ar: 'شفاف', en: 'Clear', code: '#DCE4EC', stock: 448, image: asset('/products/case-clear-magsafe.jpg') },
    ],
  },
  {
    sku: 'AMY-CS-102',
    category: 'cases',
    names: { AR: 'غطاء سيليكون أسود', FR: 'Coque silicone noire', EN: 'Black silicone case' },
    descriptions: {
      AR: 'غطاء سيليكون ناعم الملمس ببطانة مخملية داخلية. مقاوم للصدمات.',
      FR: 'Coque silicone au toucher soyeux avec doublure microfibre. Résistante aux chocs.',
      EN: 'Soft-touch silicone case with a microfibre lining. Shock resistant.',
    },
    retail: 1800, wholesale: 1400, superWholesale: 1150, wMin: 10, sMin: 30,
    images: [asset('/products/case-silicone-black.jpg')],
    variants: [
      { fr: 'Noir', ar: 'أسود', en: 'Black', code: '#111111', stock: 616, image: asset('/products/case-silicone-black.jpg') },
      { fr: 'Bleu nuit', ar: 'أزرق داكن', en: 'Midnight blue', code: '#1F2A44', stock: 245, image: asset('/products/case-silicone-black.jpg') },
    ],
  },
  {
    sku: 'AMY-SC-210',
    category: 'screen-protectors',
    names: { AR: 'زجاج مقسّى 9H', FR: 'Verre trempé 9H', EN: '9H tempered glass' },
    descriptions: {
      AR: 'واقي شاشة زجاجي 9H شفاف تمامًا مع طبقة مقاومة للبصمات. علبة من قطعتين.',
      FR: 'Protection d’écran en verre 9H ultra transparente avec traitement anti-traces. Lot de 2.',
      EN: 'Ultra-clear 9H glass screen protector with anti-fingerprint coating. Pack of 2.',
    },
    retail: 700, wholesale: 450, superWholesale: 350, wMin: 25, sMin: 50,
    images: [asset('/products/screen-protector.jpg')],
    variants: [
      { fr: 'Transparent', ar: 'شفاف', en: 'Clear', code: '#EAF0F5', stock: 3500, image: asset('/products/screen-protector.jpg') },
    ],
  },
  {
    sku: 'AMY-PB-100',
    category: 'power-banks',
    names: { AR: 'بطارية متنقلة 10000mAh', FR: 'Batterie externe 10000 mAh', EN: '10000 mAh power bank' },
    descriptions: {
      AR: 'بطارية متنقلة بسعة 10000mAh، منفذين USB وشحن سريع 22.5W. هيكل معدني رفيع.',
      FR: 'Batterie externe 10 000 mAh, double USB et charge rapide 22,5 W. Châssis métal fin.',
      EN: '10,000 mAh power bank with dual USB and 22.5W fast charging. Slim metal body.',
    },
    retail: 4500, wholesale: 3800, superWholesale: 3300, wMin: 5, sMin: 15,
    images: [asset('/products/powerbank-10000.jpg')],
    featured: true,
    variants: [
      { fr: 'Noir', ar: 'أسود', en: 'Black', code: '#0F0F0F', stock: 161, image: asset('/products/powerbank-10000.jpg') },
    ],
  },
  {
    sku: 'AMY-HP-330',
    category: 'headphones',
    names: { AR: 'سماعة رأس لاسلكية', FR: 'Casque sans fil supra-auriculaire', EN: 'Wireless over-ear headphones' },
    descriptions: {
      AR: 'سماعة رأس لاسلكية بتقنية بلوتوث 5.3، عزل ضوضاء سلبي وبطارية تدوم 40 ساعة.',
      FR: 'Casque Bluetooth 5.3, isolation passive et 40 heures d’autonomie.',
      EN: 'Bluetooth 5.3 headphones, passive isolation and 40 hours of battery.',
    },
    retail: 8900, wholesale: 7600, superWholesale: 6900, wMin: 3, sMin: 8,
    images: [asset('/products/headphones-over-ear.jpg')],
    variants: [
      { fr: 'Noir', ar: 'أسود', en: 'Black', code: '#141414', stock: 84, image: asset('/products/headphones-over-ear.jpg') },
    ],
  },
  {
    sku: 'AMY-AC-500',
    category: 'accessories',
    names: { AR: 'حامل هاتف للسيارة مغناطيسي', FR: 'Support téléphone voiture magnétique', EN: 'Magnetic car phone holder' },
    descriptions: {
      AR: 'حامل مغناطيسي قوي لفتحة التهوية، دوران 360 درجة وتركيب بيد واحدة.',
      FR: 'Support magnétique puissant pour grille d’aération, rotation 360° et fixation à une main.',
      EN: 'Strong magnetic air-vent mount with 360° rotation and one-hand docking.',
    },
    retail: 1500, wholesale: 1100, superWholesale: 900, wMin: 15, sMin: 40,
    images: [asset('/categories/accessories.jpg')],
    variants: [
      { fr: 'Noir', ar: 'أسود', en: 'Black', code: '#222222', stock: 60, image: asset('/categories/accessories.jpg') },
    ],
  },
];

async function ensureSequenceDefaults() {
  for (const key of ['order', 'invoice']) {
    await prisma.sequence.upsert({ where: { key }, create: { key, value: 0 }, update: {} });
  }
}

async function main() {
  const force = process.argv.includes('--force');
  const existing = await prisma.user.count();
  if (existing > 0 && !force) {
    console.log('[seed] database already contains users — skipping (use --force to reseed).');
    return;
  }
  if (force) {
    console.log('[seed] --force: clearing demo tables');
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.orderStatusHistory.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.priceHistory.deleteMany();
    await prisma.productPrice.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.productTranslation.deleteMany();
    await prisma.product.deleteMany();
    await prisma.categoryTranslation.deleteMany();
    await prisma.category.deleteMany();
    await prisma.customerProfile.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.sequence.deleteMany();
    await prisma.siteSetting.deleteMany();
  }

  // ---- catalog artwork -----------------------------------------------------
  // Must run before any row is inserted: the demo data resolves its image
  // references through `asset()`.
  await publishAssets();
  const CATEGORIES = buildCategories();
  const PRODUCTS = buildProducts();

  // ---- staff ---------------------------------------------------------------
  const admin = await prisma.user.create({
    data: {
      email: 'admin@amaya.dz',
      name: 'Yacine Amaya',
      phone: '+213555000001',
      passwordHash: await hash('Admin@2026'),
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      email: 'superviseur@amaya.dz',
      name: 'Nadia Belkacem',
      phone: '+213555000002',
      passwordHash: await hash('Super@2026'),
      role: 'SUPERVISOR',
      status: 'ACTIVE',
      createdById: admin.id,
      notes: 'Superviseuse boutique Oran',
    },
  });

  // ---- customers -----------------------------------------------------------
  const wholesale = await prisma.user.create({
    data: {
      email: 'gros@boutique.dz',
      name: 'Karim Benali',
      phone: '+213661234567',
      passwordHash: await hash('Gros@2026'),
      role: 'CUSTOMER',
      tier: 'WHOLESALE',
      status: 'ACTIVE',
      createdById: supervisor.id,
      profile: {
        create: {
          businessName: 'Boutique Benali Télécom',
          address: '12, rue Larbi Ben M’hidi',
          city: 'Oran',
          wilaya: 'Oran',
          taxId: '0987654321',
        },
      },
    },
  });

  const superWholesale = await prisma.user.create({
    data: {
      email: 'supergros@distrib.dz',
      name: 'Sofiane Haddad',
      phone: '+213770112233',
      passwordHash: await hash('Super@2026'),
      role: 'CUSTOMER',
      tier: 'SUPER_WHOLESALE',
      status: 'ACTIVE',
      createdById: supervisor.id,
      profile: {
        create: {
          businessName: 'Haddad Distribution',
          address: 'Zone industrielle, lot 44',
          city: 'Alger',
          wilaya: 'Alger',
          taxId: '1122334455',
        },
      },
    },
  });

  // ---- categories ----------------------------------------------------------
  const categoryIds = {};
  for (const [index, category] of CATEGORIES.entries()) {
    const created = await prisma.category.create({
      data: {
        slug: category.slug,
        image: category.image,
        sortOrder: index,
        isActive: true,
        translations: {
          create: ['AR', 'FR', 'EN'].map((locale) => ({
            locale,
            name: category.names[locale],
            description: category.descriptions[locale],
          })),
        },
      },
    });
    categoryIds[category.slug] = created.id;
  }

  // ---- products ------------------------------------------------------------
  const productIds = [];
  for (const product of PRODUCTS) {
    const frName = product.names.FR;
    const slug = product.sku.toLowerCase();
    const created = await prisma.product.create({
      data: {
        slug,
        sku: product.sku,
        categoryId: categoryIds[product.category],
        retailPrice: money(product.retail),
        wholesalePrice: money(product.wholesale),
        superWholesalePrice: money(product.superWholesale),
        wholesaleMinQty: product.wMin,
        superWholesaleMinQty: product.sMin,
        status: product.variants.reduce((sum, v) => sum + v.stock, 0) > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',
        isFeatured: !!product.featured,
        salesCount: Math.floor(Math.random() * 40),
        translations: {
          create: ['AR', 'FR', 'EN'].map((locale) => ({
            locale,
            name: product.names[locale],
            description: product.descriptions[locale],
          })),
        },
        images: {
          create: product.images.map((url, index) => ({ url, alt: `${frName} — image ${index + 1}`, sortOrder: index })),
        },
        prices: {
          create: [
            { tier: 'RETAIL', unitPrice: money(product.retail), minQuantity: 1, isCurrent: true },
            { tier: 'WHOLESALE', unitPrice: money(product.wholesale), minQuantity: product.wMin, isCurrent: true },
            { tier: 'SUPER_WHOLESALE', unitPrice: money(product.superWholesale), minQuantity: product.sMin, isCurrent: true },
          ],
        },
      },
    });
    for (const [index, variant] of product.variants.entries()) {
      const variantSku = `${product.sku}-${String(index + 1).padStart(2, '0')}`;
      const createdVariant = await prisma.productVariant.create({
        data: {
          productId: created.id,
          sku: variantSku,
          colorNameFr: variant.fr,
          colorNameAr: variant.ar,
          colorNameEn: variant.en,
          colorCode: variant.code,
          image: variant.image,
          stockQuantity: variant.stock,
        },
      });
      if (variant.stock > 0) {
        await prisma.stockMovement.create({
          data: {
            variantId: createdVariant.id,
            type: 'INITIAL',
            quantity: variant.stock,
            resultingQuantity: variant.stock,
            userId: admin.id,
            reason: 'Stock initial',
          },
        });
      }
    }
    productIds.push(created.id);
  }

  // ---- sample orders -------------------------------------------------------
  const firstProduct = await prisma.product.findFirst({
    where: { sku: 'AMY-AP-001' },
    include: { variants: { where: { isActive: true } } },
  });
  const charger = await prisma.product.findFirst({
    where: { sku: 'AMY-CH-020' },
    include: { variants: { where: { isActive: true } } },
  });

  if (firstProduct && charger) {
    const white = firstProduct.variants[0];
    const black = firstProduct.variants[1];

    // Retail guest order (delivered, sells history for analytics)
    const retailSeq = await prisma.sequence.upsert({ where: { key: 'order' }, create: { key: 'order', value: 0 }, update: {} });
    const retailOrder = await prisma.order.create({
      data: {
        orderNumber: `AMY-${new Date().getFullYear()}-00001`,
        customerNameSnapshot: 'Leïla Cherif',
        customerPhoneSnapshot: '0551 22 33 44',
        customerAddressSnapshot: '24, cité 1er Novembre',
        customerCitySnapshot: 'Constantine',
        customerTypeSnapshot: 'RETAIL',
        subtotal: '7700.00',
        deliveryFee: '0.00',
        totalAmount: '7700.00',
        status: 'DELIVERED',
        confirmedAt: new Date(Date.now() - 6 * 86400000),
        deliveredAt: new Date(Date.now() - 3 * 86400000),
        items: {
          create: [
            {
              productId: firstProduct.id,
              variantId: white.id,
              productNameSnapshot: 'AirPods Pro 2 earbuds',
              productNameFrSnapshot: 'Écouteurs AirPods Pro 2',
              skuSnapshot: white.sku,
              colorSnapshot: white.colorNameFr,
              quantity: 1,
              unitPriceSnapshot: '6500.00',
              lineTotal: '6500.00',
              tierSnapshot: 'RETAIL',
            },
            {
              productId: charger.id,
              variantId: charger.variants[0].id,
              productNameSnapshot: '20W USB-C fast charger',
              productNameFrSnapshot: 'Chargeur rapide 20W USB-C',
              skuSnapshot: charger.variants[0].sku,
              colorSnapshot: charger.variants[0].colorNameFr,
              quantity: 1,
              unitPriceSnapshot: '1200.00',
              lineTotal: '1200.00',
              tierSnapshot: 'RETAIL',
            },
          ],
        },
        statusHistory: {
          create: [
            { fromStatus: null, toStatus: 'PENDING', note: 'Order created', createdAt: new Date(Date.now() - 6 * 86400000) },
            { fromStatus: 'PENDING', toStatus: 'CONFIRMED', changedById: supervisor.id, createdAt: new Date(Date.now() - 6 * 86400000) },
            { fromStatus: 'CONFIRMED', toStatus: 'DELIVERED', changedById: supervisor.id, createdAt: new Date(Date.now() - 3 * 86400000) },
          ],
        },
      },
    });

    // Wholesale order (confirmed, waiting for shipment)
    const wholesaleOrder = await prisma.order.create({
      data: {
        orderNumber: `AMY-${new Date().getFullYear()}-00002`,
        customerId: wholesale.id,
        customerNameSnapshot: wholesale.name,
        customerPhoneSnapshot: wholesale.phone,
        customerAddressSnapshot: '12, rue Larbi Ben M’hidi, Oran',
        customerCitySnapshot: 'Oran',
        customerTypeSnapshot: 'WHOLESALE',
        subtotal: '47500.00',
        discount: '0.00',
        deliveryFee: '0.00',
        totalAmount: '47500.00',
        status: 'CONFIRMED',
        confirmedAt: new Date(Date.now() - 86400000),
        createdById: supervisor.id,
        items: {
          create: [
            {
              productId: firstProduct.id,
              variantId: white.id,
              productNameSnapshot: 'AirPods Pro 2 earbuds',
              productNameFrSnapshot: 'Écouteurs AirPods Pro 2',
              skuSnapshot: white.sku,
              colorSnapshot: white.colorNameFr,
              quantity: 5,
              unitPriceSnapshot: '5800.00',
              lineTotal: '29000.00',
              tierSnapshot: 'WHOLESALE',
            },
            {
              productId: firstProduct.id,
              variantId: black.id,
              productNameSnapshot: 'AirPods Pro 2 earbuds',
              productNameFrSnapshot: 'Écouteurs AirPods Pro 2',
              skuSnapshot: black.sku,
              colorSnapshot: black.colorNameFr,
              quantity: 3,
              unitPriceSnapshot: '5800.00',
              lineTotal: '17400.00',
              tierSnapshot: 'WHOLESALE',
            },
            {
              productId: charger.id,
              variantId: charger.variants[0].id,
              productNameSnapshot: '20W USB-C fast charger',
              productNameFrSnapshot: 'Chargeur rapide 20W USB-C',
              skuSnapshot: charger.variants[0].sku,
              colorSnapshot: charger.variants[0].colorNameFr,
              quantity: 1,
              unitPriceSnapshot: '950.00',
              lineTotal: '950.00',
              tierSnapshot: 'WHOLESALE',
            },
          ],
        },
        statusHistory: {
          create: [
            { fromStatus: null, toStatus: 'PENDING', note: 'Order created by supervisor', createdAt: new Date(Date.now() - 2 * 86400000) },
            { fromStatus: 'PENDING', toStatus: 'CONFIRMED', changedById: supervisor.id, createdAt: new Date(Date.now() - 86400000) },
          ],
        },
      },
    });

    // Pending super-wholesale order
    const pendingOrder = await prisma.order.create({
      data: {
        orderNumber: `AMY-${new Date().getFullYear()}-00003`,
        customerId: superWholesale.id,
        customerNameSnapshot: superWholesale.name,
        customerPhoneSnapshot: superWholesale.phone,
        customerAddressSnapshot: 'Zone industrielle, lot 44, Alger',
        customerCitySnapshot: 'Alger',
        customerTypeSnapshot: 'SUPER_WHOLESALE',
        subtotal: '156000.00',
        deliveryFee: '0.00',
        totalAmount: '156000.00',
        status: 'PENDING',
        items: {
          create: [
            {
              productId: firstProduct.id,
              variantId: white.id,
              productNameSnapshot: 'AirPods Pro 2 earbuds',
              productNameFrSnapshot: 'Écouteurs AirPods Pro 2',
              skuSnapshot: white.sku,
              colorSnapshot: white.colorNameFr,
              quantity: 30,
              unitPriceSnapshot: '5200.00',
              lineTotal: '156000.00',
              tierSnapshot: 'SUPER_WHOLESALE',
            },
          ],
        },
        statusHistory: {
          create: [{ fromStatus: null, toStatus: 'PENDING', note: 'Order created', changedById: superWholesale.id }],
        },
      },
    });

    // Reserve stock for the confirmed wholesale order.
    await prisma.productVariant.update({ where: { id: white.id }, data: { reservedQuantity: { increment: 5 } } });
    await prisma.productVariant.update({ where: { id: black.id }, data: { reservedQuantity: { increment: 3 } } });
    await prisma.productVariant.update({ where: { id: charger.variants[0].id }, data: { reservedQuantity: { increment: 1 } } });

    // Invoice for the delivered order.
    const invoice = await prisma.invoice.create({
      data: {
        number: `FAC-${new Date().getFullYear()}-00001`,
        orderId: retailOrder.id,
        version: 1,
        issuedById: supervisor.id,
        customerNameSnapshot: 'Leïla Cherif',
        customerPhoneSnapshot: '0551 22 33 44',
        customerAddressSnapshot: '24, cité 1er Novembre, Constantine',
        subtotal: '7700.00',
        discount: '0.00',
        deliveryFee: '0.00',
        totalAmount: '7700.00',
        snapshot: { orderNumber: retailOrder.orderNumber, customerType: 'RETAIL' },
        items: {
          create: [
            { reference: white.sku, designation: 'Écouteurs AirPods Pro 2', color: 'Blanc', quantity: 1, unitPrice: '6500.00', lineTotal: '6500.00' },
            { reference: charger.variants[0].sku, designation: 'Chargeur rapide 20W USB-C', color: 'Blanc', quantity: 1, unitPrice: '1200.00', lineTotal: '1200.00' },
          ],
        },
      },
    });

    await prisma.sequence.upsert({ where: { key: 'order' }, create: { key: 'order', value: 3 }, update: { value: 3 } });
    await prisma.sequence.upsert({ where: { key: 'invoice' }, create: { key: 'invoice', value: 1 }, update: { value: 1 } });

    await prisma.auditLog.createMany({
      data: [
        { actorId: admin.id, actorName: admin.name, action: 'seed.run', entityType: 'System', summary: 'Demo data seeded', metadata: {} },
        { actorId: supervisor.id, actorName: supervisor.name, action: 'invoice.issue', entityType: 'Invoice', entityId: invoice.id, summary: `Invoice ${invoice.number} issued for ${retailOrder.orderNumber}`, metadata: {} },
        { actorId: supervisor.id, actorName: supervisor.name, action: 'order.status', entityType: 'Order', entityId: wholesaleOrder.id, summary: `${wholesaleOrder.orderNumber}: PENDING → CONFIRMED`, metadata: {} },
        { actorId: supervisor.id, actorName: supervisor.name, action: 'order.create', entityType: 'Order', entityId: pendingOrder.id, summary: `Order ${pendingOrder.orderNumber} created (SUPER_WHOLESALE)`, metadata: {} },
      ],
    });
  }

  // ---- site settings -------------------------------------------------------
  await prisma.siteSetting.createMany({
    data: [
      {
        key: 'business',
        value: {
          name: 'AMAYA — Premium Accessories',
          phone: '+213 555 00 00 00',
          email: 'contact@amaya.dz',
          address: 'Oran, Algérie',
          hours: 'Samedi – Jeudi · 9h – 18h',
          instagram: '@amaya.dz',
          whatsapp: '+213 555 00 00 00',
          deliveryFee: 700,
          freeDeliveryThreshold: 5000,
        },
      },
      {
        key: 'hero.image',
        value: asset('/products/airpods-pro-white.jpg'),
      },
      {
        key: 'hero',
        value: {
          badge: { ar: 'جديد 2026', fr: 'Nouveautés 2026', en: 'New 2026' },
          title: {
            ar: 'الإكسسوار المثالي لهاتفك',
            fr: 'L’accessoire parfait pour votre téléphone',
            en: 'The perfect accessory for your phone',
          },
          subtitle: {
            ar: 'من السماعات إلى الشواحن السريعة، أمايا تختار لك إكسسوارات مستقلة بأسعار عادلة.',
            fr: 'Des écouteurs aux chargeurs rapides, AMAYA sélectionne pour vous des accessoires premium à des prix justes.',
            en: 'From earbuds to fast chargers, AMAYA curates premium accessories at fair prices.',
          },
        },
      },
    ],
    skipDuplicates: true,
  });

  console.log('\n[seed] AMAYA demo data ready:');
  console.log('  Admin        admin@amaya.dz        / Admin@2026');
  console.log('  Supervisor   superviseur@amaya.dz  / Super@2026');
  console.log('  Wholesale    gros@boutique.dz      / Gros@2026');
  console.log('  Super-whol.  supergros@distrib.dz  / Super@2026');
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
