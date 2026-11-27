# AMAYA — Premium Accessories

Plateforme e-commerce d'accessoires de téléphonie mobile pour l'Algérie, avec
**trois paliers tarifaires** (détail, gros, super gros), **arabe par défaut (RTL)**,
français et anglais, et des **factures toujours en français** au format A4.

---

## Sommaire

1. [Démarrage rapide](#démarrage-rapide)
2. [Comptes de démonstration](#comptes-de-démonstration)
3. [Paliers tarifaires](#paliers-tarifaires)
4. [Rôles & permissions](#rôles--permissions)
5. [Cycle de vie d'une commande](#cycle-de-vie-dune-commande)
6. [Factures](#factures)
7. [Internationalisation](#internationalisation)
8. [Architecture](#architecture)
9. [API HTTP](#api-http)
10. [Tests & recette §20](#tests--recette-20)
11. [Variables d'environnement](#variables-denvironnement)
12. [Déploiement](#déploiement)

---

## Démarrage rapide

```bash
npm install
npm run dev          # base de données + migrations + seed + Next.js sur :3000
```

`npm run dev` démarre un PostgreSQL embarqué (PGlite) sur `127.0.0.1:5432`, applique
les migrations Prisma, insère les données de démonstration si la base est vide, puis
lance Next.js sur **http://localhost:3000** (accessible aussi depuis le réseau local).

Autres commandes :

| Commande | Effet |
| --- | --- |
| `npm run db:up` | Démarre la base seule (PGlite, `.pgdata/`) |
| `npm run db:migrate` | Applique `prisma/migrations` |
| `npm run db:seed` | Données de démonstration (9 produits, 8 catégories) |
| `npm run db:reset` | Vide et réinsère la base |
| `npm run api` | Serveur **Express** autonome (port 4000) |
| `npm test` | Tests unitaires + recette §20 |
| `npm run build && npm start` | Build de production |

## Comptes de démonstration

| Rôle | Email | Mot de passe |
| --- | --- | --- |
| Administrateur | `admin@amaya.dz` | `Admin@2026` |
| Superviseur | `superviseur@amaya.dz` | `Super@2026` |
| Client gros | `gros@boutique.dz` | `Gros@2026` |
| Client super gros | `supergros@distrib.dz` | `Super@2026` |

Aucune inscription publique : les comptes professionnels sont **créés par le
personnel** depuis `/admin/customers`. Les visiteurs peuvent commander au détail
en tant qu'invités.

## Paliers tarifaires

| Palier | Qui | Prix | Quantité minimum |
| --- | --- | --- | --- |
| **Détail** | Visiteur / invité | `retailPrice` | 1 |
| **Gros** | Compte `WHOLESALE` | `wholesalePrice` | 5 (défaut, configurable par produit) |
| **Super gros** | Compte `SUPER_WHOLESALE` | `superWholesalePrice` | 10 (défaut, configurable par produit) |

Trois règles non négociables :

1. Le palier vient **du jeton de session**, jamais du corps de la requête.
2. Le serveur **relit** prix, quantité minimum et stock en base avant chaque devis
   et chaque commande (`src/lib/services/pricing-service.ts`). Cacher un bouton ne
   protège de rien : chaque contrôle est refait côté serveur.
3. Le prix unitaire est **figé dans la commande** (`unitPriceSnapshot`), puis
   recopié dans la facture. Modifier un prix ne réécrit jamais l'historique.

## Rôles & permissions

| | Admin | Superviseur | Client |
| --- | --- | --- | --- |
| Boutique, panier, commande | ✅ (détail) | ✅ (détail) | ✅ (son palier) |
| Confirmer / expédier / annuler | ✅ | ✅ (si `manageOrders`) | ❌ |
| Émettre des factures | ✅ | ✅ (si `issueInvoices`) | ❌ |
| Stock, produits, catégories | ✅ | ✅ selon permissions | ❌ |
| Créer des comptes pros | ✅ | ✅ (si `manageCustomers`) | ❌ |
| Superviseurs, paramètres, audit | ✅ | ❌ | ❌ |

Les permissions d'un superviseur sont modifiables dans `/admin/supervisors`
(administrateur uniquement) et sont **revérifiées à chaque action** serveur.

## Cycle de vie d'une commande

```
PENDING ──▶ CONFIRMED ──▶ PREPARING ──▶ READY ──▶ SHIPPED ──▶ DELIVERED
   │            │
   └────────────┴──▶ CANCELLED
```

- **Confirmation** : réservation atomique du stock
  (`UPDATE … WHERE stockQuantity - reservedQuantity >= n`). Deux confirmations
  concurrentes ne peuvent pas dépasser le stock disponible — il n'y a pas de survente.
- **Expédition** : la réservation devient une déduction réelle.
- **Annulation** : la réservation est libérée.
- Chaque transition écrit une ligne dans `OrderStatusHistory` et `StockMovement`.

## Factures

- **Toujours en français**, quelle que soit la langue de la boutique.
- **A4**, prêtes à imprimer, avec numéro séquentiel `FAC-AAAA-00001`.
- Deux formats : HTML (`/invoices/{id}?print=1`) et PDF (`/invoices/{id}/pdf`).
- **Immuables** : une réédition crée une nouvelle version (`v2`, `v3`…) avec son
  propre numéro ; l'ancienne reste intacte, avec les prix de l'époque.
- Aucune suppression possible : l'historique financier est conservé.

## Internationalisation

| Langue | Code | Sens | Défaut |
| --- | --- | --- | --- |
| العربية | `ar` | RTL | ✅ |
| Français | `fr` | LTR | |
| English | `en` | LTR | |

Le choix est mémorisé dans le cookie `amaya_locale` (un an). À la première visite,
`Accept-Language` est respecté s'il demande explicitement `fr` ou `en` ; sinon
l'arabe s'applique. Les dictionnaires sont dans `src/i18n/` et restent synchronisés
grâce au type `DictionaryShape` dérivé du français.

## Architecture

```
src/
├── app/
│   ├── (storefront)/     boutique publique — accueil, catalogue, produit, panier, checkout
│   ├── (auth)/           connexion
│   ├── (account)/        espace client — commandes, profil, mot de passe
│   ├── (admin)/          back-office — tableau de bord, commandes, produits, stock…
│   ├── api/              routes HTTP (fines enveloppes autour de lib/api/handlers.ts)
│   ├── invoices/[id]/    facture HTML imprimable + PDF
│   └── actions/          Server Actions (panier, auth, admin, paramètres)
├── components/
│   ├── ui/               primitives (Button, Field, Badge, Table, Price…)
│   ├── storefront/       header, footer, cartes produit, filtres
│   ├── admin/            shell, KPI, graphiques, formulaires métier
│   └── account/          composants de l'espace client
├── lib/
│   ├── api/              http.ts · session.ts · handlers.ts (toute l'API)
│   ├── services/         catalog, pricing-service, orders, inventory, products,
│   │                     customers, analytics, sequence
│   ├── pricing.ts        règles de palier, minimums, machine à états
│   ├── i18n.ts / i18n/   résolution de langue + dictionnaires
│   ├── invoice-*.ts      gabarit HTML, PDF (pdfkit), libellés français
│   ├── auth.ts           session + permissions (`can`)
│   └── prisma.ts         client Prisma + adaptateur PG
├── generated/prisma/     client Prisma généré (TypeScript)
└── proxy.ts              langue par défaut (convention proxy de Next 16)

server/index.ts           serveur Express autonome (mêmes handlers)
scripts/                  db, migrate, seed, reset, recette
prisma/                   schéma (16 modèles) + migrations
assets/catalog/           visuels de démo (produits, catégories) — hors de public/
tests/                    unitaires + intégration §20
```

**Images.** Les visuels produits et catégories ne sont pas servis par
l'application : `assets/catalog/**` ne contient que les fichiers **maîtres** de
démonstration, et les URL publiques vivent dans Neon Object Storage
(`ProductImage.url`, `Category.image`, `ProductVariant.image`). Le seed les
téléverse automatiquement ; une base déjà remplie se met à jour via
**`/admin/settings` → Migrer les images**. Seuls le logo et les icônes restent
dans `public/`.

**Une seule implémentation des règles.** Next.js et le serveur Express appellent
tous deux `src/lib/api/handlers.ts`. Le runtime par défaut du produit est Next.js ;
Express est une seconde porte d'entrée pour les clients natifs et les intégrations.

## API HTTP

Authentification : cookie `amaya_session` (HttpOnly) **ou**
`Authorization: Bearer <jwt>`. Un jeton explicite prime toujours sur le cookie.

| Méthode | Route | Accès |
| --- | --- | --- |
| `GET` | `/api/health` | public |
| `POST` | `/api/auth/login` | public |
| `GET` | `/api/auth/me` | connecté |
| `POST` | `/api/auth/password` | connecté |
| `GET` | `/api/categories?locale=` | public |
| `GET` | `/api/products?locale&category&q&sort&stock&page` | public (prix selon palier) |
| `GET` | `/api/products/{slug}` | public (prix selon palier) |
| `POST` | `/api/cart/quote` | public (devis revalidé) |
| `POST` | `/api/orders` | public (invité accepté) |
| `GET` | `/api/orders` | client (ses commandes) |
| `GET` | `/api/orders/{id}` | client (la sienne) / personnel |
| `PATCH` | `/api/orders/{id}/status` | personnel |
| `POST` | `/api/orders/{id}/invoice` | personnel |
| `GET` | `/api/invoices/{id}/pdf` \| `/html` | personnel / propriétaire |
| `GET` | `/api/admin/orders?status&q` | personnel |
| `POST` `PATCH` | `/api/admin/customers[/{id}]` | personnel |
| `POST` `PUT` | `/api/admin/products[/{id}]` | personnel |
| `POST` | `/api/admin/stock` | personnel |
| `GET` | `/api/admin/reports/export?range=` | personnel (CSV) |

Enveloppe de réponse : `{ "ok": true, … }` ou
`{ "ok": false, "error": { "code": "MIN_QTY", "message": "…" } }`.
Codes : `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
`VALIDATION` 422, `CONFLICT`/`STOCK`/`MIN_QTY` 409.

## Tests & recette §20

```bash
npm test                              # unitaires + intégration
BASE_URL=http://127.0.0.1:3000 npm test   # réutilise un serveur déjà lancé
npx tsx scripts/acceptance.mjs        # recette manuelle, 50 vérifications
```

`tests/pricing.test.ts` vérifie les paliers et les minimums sans base de données.
`tests/acceptance.test.ts` couvre les dix exigences du cahier des charges §20 via
l'API réelle :

| # | Exigence | Test |
| --- | --- | --- |
| 1 | Trois paliers, pas de fuite de prix | « retail visitors see retail prices only » |
| 2 | Minimums par produit, côté serveur | « below-minimum … rejected » |
| 3 | Prix jamais fournis par le client | « forged unitPrice is ignored » |
| 4 | Commande invité au détail | « guest can order at retail » |
| 5 | Stock atomique, sans survente | « concurrent confirmations cannot oversell » |
| 6 | Réservation / libération | « confirming reserves … cancelling releases » |
| 7 | Facture française A4, immuable | « invoices are French, printable … immutable » |
| 8 | Permissions backend | « customers cannot reach staff endpoints » |
| 9 | Arabe par défaut, RTL, persistance | « storefront renders Arabic RTL by default » |
| 10 | Contrat API stable | « API contract is JSON with stable error envelopes » |

## Variables d'environnement

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5432/amaya` | Connexion PostgreSQL |
| `AUTH_SECRET` | valeur de dev | Signature des JWT — **à changer en production** |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | URL publique (métadonnées) |
| `PORT` | `3000` | Port Next.js |
| `API_PORT` | `4000` | Port du serveur Express |
| `BUSINESS_PHONE` / `BUSINESS_EMAIL` / `BUSINESS_ADDRESS` | valeurs de dev | Coordonnées affichées |
| `COMPANY_ADDRESS` | `Oran, Algérie` | Adresse imprimée sur la facture |
| `COMPANY_RC` / `COMPANY_NIF` / `COMPANY_AI` | vide | Identifiants légaux — **omis** tant qu'ils ne sont pas renseignés |

Les paramètres métier (frais de livraison, seuil de gratuité, minimums par défaut,
informations de facturation) sont éditables dans `/admin/settings` et stockés dans
la table `SiteSetting`.

## Déploiement

```bash
npm run build
npm start            # Next.js sur 0.0.0.0:$PORT
npm run api          # optionnel : API Express sur 0.0.0.0:$API_PORT
```

- Les deux processus écoutent sur `0.0.0.0` : ils sont joignables depuis un
  conteneur, un réseau local ou un reverse-proxy.
- En production, pointez `DATABASE_URL` vers un PostgreSQL managé et exécutez
  `npm run db:migrate` avant le premier démarrage.
- **Changez `AUTH_SECRET`.** Les cookies de session sont `HttpOnly`, `SameSite=Lax`.
- Le serveur Express ne sert que `/api/**` : le HTML du site reste sur Next.js.
