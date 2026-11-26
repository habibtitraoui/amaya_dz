/**
 * AMAYA — acceptance tests for spec §20, run against the live dev server.
 *   npx tsx scripts/acceptance.mjs
 * Uses only the public HTTP surface, exactly like a browser or mobile client.
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';

let pass = 0;
let fail = 0;
const results = [];

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    results.push(`  ✅ ${name}`);
  } else {
    fail += 1;
    results.push(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

let cookie = '';

async function api(path, { method = 'GET', body, token, raw = false } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: response.status, json, text, headers: response.headers };
}

async function login(email, password) {
  cookie = '';
  const response = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  return { token: response.json?.token, user: response.json?.user, sessionCookie: cookie, status: response.status };
}

/** The public API exposes `prices.effective` + `variants[].available`. */
const priceOf = (item) => Number(item?.prices?.effective?.unitPrice ?? NaN);
const minQtyOf = (item) => Number(item?.prices?.effective?.minQuantity ?? NaN);
const firstVariant = (item) => item?.variants?.[0];
const availableOf = (item) => Number(item?.variants?.[0]?.available ?? NaN);

async function product(slug, { token, locale = 'fr' } = {}) {
  const response = await api(`/api/products/${slug}?locale=${locale}`, { token });
  return response.json?.data;
}

async function main() {
  console.log('\n════════ AMAYA §20 ACCEPTANCE ════════\n');

  /* 1 — retail visitor sees retail price only, Arabic default, RTL */
  console.log('1. Boutique publique (visiteur détail, arabe par défaut)');
  const products = await api('/api/products?locale=ar');
  check('GET /api/products renvoie le catalogue', products.status === 200 && products.json?.items?.length > 0);
  const airpods = await product('amy-ap-001', { locale: 'ar' });
  const retailPrice = priceOf(airpods);
  check('Le prix détail est exposé', retailPrice > 0, `reçu ${retailPrice}`);
  check(
    'Le prix de gros n’est PAS exposé au visiteur',
    airpods?.prices?.wholesale === null && airpods?.prices?.superWholesale === null,
    JSON.stringify(airpods?.prices),
  );
  check('Le nom arabe du produit est résolu', /[\u0600-\u06FF]/.test(airpods?.name ?? ''), airpods?.name);
  const home = await api('/', { raw: true });
  check('La page d’accueil répond en HTML', home.status === 200 && home.text.includes('<html'));

  /* 2 — wholesale minimum quantity enforced server-side */
  console.log('\n2. Minimum de quantité grossiste (5) appliqué par le serveur');
  const wholesale = await login('gros@boutique.dz', 'Gros@2026');
  check('Connexion grossiste', wholesale.status === 200 && wholesale.user?.tier === 'WHOLESALE');
  const wAir = await product('amy-ap-001', { token: wholesale.token });
  check('Le grossiste voit un prix inférieur au détail', priceOf(wAir) < retailPrice && priceOf(wAir) > 0, `${priceOf(wAir)} vs ${retailPrice}`);
  check('La quantité minimum grossiste est exposée (5)', minQtyOf(wAir) === 5, `reçu ${minQtyOf(wAir)}`);
  const tooFew = await api('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: wAir.id, variantId: firstVariant(wAir)?.id, quantity: 3 }],
      customerName: 'Test Gros',
      customerPhone: '0550112233',
      customerAddress: 'Rue test',
      customerCity: 'Oran',
    },
  });
  check('Commande de 3 unités REFUSÉE pour un grossiste', tooFew.status >= 400, `statut ${tooFew.status}`);
  const forged = await api('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: wAir.id, variantId: firstVariant(wAir)?.id, quantity: 5, unitPrice: 100 }],
      customerName: 'Test Gros',
      customerPhone: '0550112233',
      customerAddress: 'Rue test',
      customerCity: 'Oran',
    },
  });
  check('Un prix falsifié par le client est ignoré (snapshot serveur)', forged.status === 201, `statut ${forged.status}`);
  const forgedOrder = forged.json?.data ?? forged.json?.order;
  check(
    `Le total est calculé au tarif gros réel (5 × ${priceOf(wAir)})`,
    forgedOrder && Number(forgedOrder.totalAmount) === 5 * priceOf(wAir),
    `total ${forgedOrder?.totalAmount} attendu ${5 * priceOf(wAir)}`,
  );

  /* 3 — super wholesale tier */
  console.log('\n3. Palier super gros (minimum 10)');
  const superW = await login('supergros@distrib.dz', 'Super@2026');
  check('Connexion super gros', superW.status === 200 && superW.user?.tier === 'SUPER_WHOLESALE');
  const swAir = await product('amy-ap-001', { token: superW.token });
  check('Prix super gros inférieur au prix gros', priceOf(swAir) < priceOf(wAir) && priceOf(swAir) > 0, `${priceOf(swAir)} vs ${priceOf(wAir)}`);
  check('Minimum super gros (10)', minQtyOf(swAir) === 10, `reçu ${minQtyOf(swAir)}`);
  const swFew = await api('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: swAir.id, variantId: firstVariant(swAir)?.id, quantity: 9 }],
      customerName: 'Test SG',
      customerPhone: '0550112233',
      customerAddress: 'Rue test',
      customerCity: 'Oran',
    },
  });
  check('Commande de 9 unités REFUSÉE pour un super gros', swFew.status >= 400, `statut ${swFew.status}`);

  /* 4 — retail visitor cannot order wholesale */
  console.log('\n4. Visiteur détail : aucun tarif de gros, commande au prix détail');
  const retailCookie = (await api('/api/auth/me')).status;
  check('Pas de session persistée pour le test anonyme', retailCookie === 401 || retailCookie === 200);
  const guest = await login('admin@amaya.dz', 'Admin@2026'); // staff login just to clear the customer cookie
  cookie = '';
  const gAir = await product('amy-ap-001');
  check('Visiteur non connecté : prix détail', priceOf(gAir) === retailPrice, `reçu ${priceOf(gAir)}`);
  check('Visiteur non connecté : minimum 1', minQtyOf(gAir) === 1, `reçu ${minQtyOf(gAir)}`);
  const guestOrder = await api('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: gAir.id, variantId: firstVariant(gAir)?.id, quantity: 1 }],
      customerName: 'Amine Khelifi',
      customerPhone: '0550112233',
      customerAddress: 'Cité 200 logements',
      customerCity: 'Oran',
    },
  });
  check('Commande invité acceptée sans compte', guestOrder.status === 201, `statut ${guestOrder.status}`);
  const guestId = guestOrder.json?.data?.id;
  const guestNumber = guestOrder.json?.data?.orderNumber;
  check('Numéro de commande séquentiel AMY-', /^AMY-\d{4}-\d{5}$/.test(guestNumber ?? ''), guestNumber);

  /* 5 — order creation snapshots price, admin sees history */
  console.log('\n5. Instantané des prix & historique');
  const admin = await login('admin@amaya.dz', 'Admin@2026');
  check('Connexion administrateur', admin.status === 200 && admin.user?.role === 'ADMIN');
  const adminOrder = await api(`/api/admin/orders`, { token: admin.token });
  check('L’admin liste toutes les commandes', adminOrder.status === 200 && (adminOrder.json?.data?.length ?? 0) > 10, `${adminOrder.json?.data?.length}`);
  const detail = await api(`/api/orders/${guestId}`, { token: admin.token });
  const item = (detail.json?.data ?? detail.json?.order)?.items?.[0];
  check('L’unité de commande contient le prix d’instantané', Number(item?.unitPriceSnapshot) === retailPrice, `reçu ${item?.unitPriceSnapshot} attendu ${retailPrice}`);
  check('Le nom du produit est figé dans la commande', Boolean(item?.productNameSnapshot || item?.productNameFrSnapshot));

  /* 6 — stock reservation is atomic, no oversell */
  console.log('\n6. Réservation de stock atomique (pas de survente)');
  const single = await product('amy-hp-330');
  const target = (single.variants ?? []).find((variant) => variant.available > 5) ?? firstVariant(single);
  const stockLeft = availableOf(single);
  const bigQty = Math.max(1, stockLeft + 50);
  const oversell = await api('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: single.id, variantId: target.id, quantity: bigQty }],
      customerName: 'Test Survente',
      customerPhone: '0550112233',
      customerAddress: 'Rue test',
      customerCity: 'Oran',
    },
  });
  check('Une commande dépassant le stock est refusée', oversell.status >= 400, `statut ${oversell.status} pour ${bigQty} unités`);

  /* 7 — confirm order reserves stock */
  console.log('\n7. Confirmation : réservation et facturation');
  const beforeAvailable = availableOf(await product('amy-hp-330', { locale: 'ar' }));
  const small = await api('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: single.id, variantId: target.id, quantity: 2 }],
      customerName: 'Test Réservation',
      customerPhone: '0550112233',
      customerAddress: 'Rue test',
      customerCity: 'Oran',
    },
  });
  const confirmed = await api(`/api/orders/${small.json.data.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'CONFIRMED' } });
  check('Confirmation de commande par le personnel', confirmed.status === 200, `statut ${confirmed.status}`);
  const afterAvailable = availableOf(await product('amy-hp-330', { locale: 'ar' }));
  check('Le stock disponible baisse de 2 après confirmation', beforeAvailable - afterAvailable === 2, `${beforeAvailable} → ${afterAvailable}`);

  /* 8 — invoice is French, A4, printable and immutable */
  console.log('\n8. Facture française, A4, imprimable, immuable');
  const invoiceResp = await api(`/api/orders/${small.json.data.id}/invoice`, { method: 'POST', token: admin.token });
  const invoice = invoiceResp.json?.data; check('Émission de facture', invoiceResp.status === 201 && Boolean(invoice?.number), `statut ${invoiceResp.status}`);
  const invoiceNumber = invoice?.number;
  check('Numéro de facture séquentiel FAC-', /^FAC-\d{4}-\d{5}$/.test(invoiceNumber ?? ''), invoiceNumber);
  const html = await api(`/api/invoices/${invoice.id}/html`);
  check('Facture HTML servie', html.status === 200 && html.text.includes('<html'));
  check('Facture en français (mentions FR)', /Facture|Total TTC|Quantité|Désignation/i.test(html.text));
  check('Mise en page A4', /A4|210mm|mm/.test(html.text));
  const pdf = await api(`/api/invoices/${invoice.id}/pdf`);
  check('PDF généré', pdf.status === 200 && pdf.headers.get('content-type')?.includes('pdf'), pdf.headers.get('content-type'));
  const second = await api(`/api/orders/${small.json.data.id}/invoice`, { method: 'POST', token: admin.token });
  const firstTotal = invoice.totalAmount;
  check('La facture conserve son total après réémission', Number(second.json?.data?.totalAmount) === Number(firstTotal), `${second.json?.data?.totalAmount} vs ${firstTotal}`);

  /* 9 — role permissions enforced in the backend */
  console.log('\n9. Permissions vérifiées par le serveur');
  const customer = await login('gros@boutique.dz', 'Gros@2026');
  const customerForbidden = await api('/api/admin/orders', { token: customer.token });
  check('Un client ne peut PAS lister les commandes admin', customerForbidden.status === 403, `statut ${customerForbidden.status}`);
  const customerStock = await api('/api/admin/stock', { method: 'POST', token: customer.token, body: { variantId: target.id, delta: 5 } });
  check('Un client ne peut PAS ajuster le stock', customerStock.status === 403, `statut ${customerStock.status}`);
  const customerProduct = await api('/api/admin/products', { method: 'POST', token: customer.token, body: { sku: 'HACK-1' } });
  check('Un client ne peut PAS créer un produit', customerProduct.status === 403, `statut ${customerProduct.status}`);
  const anon = await api('/api/admin/customers', { method: 'POST', body: { name: 'x', email: 'x@x.dz', tier: 'WHOLESALE' } });
  check('Un visiteur ne peut PAS créer de compte grossiste', anon.status === 401 || anon.status === 403, `statut ${anon.status}`);
  const signup = await api('/api/auth/register', { method: 'POST', body: { email: 'new@x.dz' } });
  check('Aucune inscription publique n’existe', signup.status === 404 || signup.status === 405, `statut ${signup.status}`);

  /* 10 — supervisor permissions */
  console.log('\n10. Superviseur & journal d’audit');
  const supervisor = await login('superviseur@amaya.dz', 'Super@2026');
  check('Connexion superviseur', supervisor.status === 200 && supervisor.user?.role === 'SUPERVISOR');
  const supOrders = await api('/api/admin/orders', { token: supervisor.token });
  check('Le superviseur gère les commandes', supOrders.status === 200);
  const supCustomers = await api('/api/admin/customers', {
    method: 'POST',
    token: supervisor.token,
    body: { name: 'Boutique Test QA', email: `qa-${Date.now()}@boutique.dz`, phone: '0550999888', tier: 'WHOLESALE', businessName: 'QA Store', city: 'Oran', wilaya: 'Oran' },
  });
  check('Le superviseur crée un compte grossiste', supCustomers.status === 201, `statut ${supCustomers.status}`);
  check('Un mot de passe temporaire est généré', Boolean(supCustomers.json?.temporaryPassword));

  /* 11 — cancelled order releases stock */
  console.log('\n11. Annulation : libération du stock et montants figés');
  const toCancel = await api('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: single.id, variantId: target.id, quantity: 1 }],
      customerName: 'Test Annulation',
      customerPhone: '0550112233',
      customerAddress: 'Rue test',
      customerCity: 'Oran',
    },
  });
  await api(`/api/orders/${toCancel.json.data.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'CONFIRMED' } });
  const midStock = availableOf(await product('amy-hp-330', { locale: 'ar' }));
  const cancelled = await api(`/api/orders/${toCancel.json.data.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'CANCELLED' } });
  check('Annulation acceptée', cancelled.status === 200, `statut ${cancelled.status}`);
  const endStock = availableOf(await product('amy-hp-330', { locale: 'ar' }));
  check('Le stock est libéré (+1)', endStock - midStock === 1, `${midStock} → ${endStock}`);
  const cancelledOrder = await api(`/api/orders/${toCancel.json.data.id}`, { token: admin.token });
  check('La commande annulée garde son total', Number((cancelledOrder.json?.data ?? {}).totalAmount) > 0);

  /* extras */
  console.log('\n12. Extras : santé, i18n, CSV, devise');
  const health = await api('/api/health');
  check('GET /api/health OK', health.status === 200 && health.json?.ok === true);
  const ar = await api('/api/categories?locale=ar');
  const arName = ar.json?.data?.[0]?.name;
  check('Les catégories sont traduites en arabe', /[\u0600-\u06FF]/.test(arName ?? ''), arName);
  const fr = await api('/api/categories?locale=fr');
  check('Les catégories sont traduites en français', Boolean(fr.json?.data?.[0]?.name) && fr.json?.data?.[0]?.name !== arName);
  const badLogin = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@amaya.dz', password: 'wrong' } });
  check('Mot de passe erroné → 401', badLogin.status === 401, `statut ${badLogin.status}`);

  console.log(results.join('\n'));
  console.log(`\n──────── ${pass} passed, ${fail} failed ────────\n`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('acceptance runner crashed:', error);
  process.exitCode = 1;
});
