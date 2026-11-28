# Hosting AMAYA (`amaya_dz`) on Vercel & Neon — Step-by-Step Setup Guide

This guide walks you step by step through deploying **AMAYA — Premium Accessories** (`Next.js 16` + `Prisma 7` + `PostgreSQL`) to **Vercel** (application & API hosting) and **Neon** (serverless PostgreSQL).

---

## Architecture Overview in Production

| Layer | Local Development (`npm run dev`) | Production (**Vercel + Neon**) |
| --- | --- | --- |
| **Web Storefront & Admin** | Next.js 16 dev server (`:3000`) | Vercel Serverless Functions + Edge CDN |
| **HTTP REST API (`/api/**`)** | Next.js Route Handlers (or optional Express `:4000`) | Next.js Route Handlers on Vercel (`src/app/api/**`) — **no separate Express server needed** |
| **Locale & RTL Routing** | `src/proxy.ts` (Next.js 16 proxy) | Vercel Edge/Node runtime (`amaya_locale` cookie, Arabic RTL default) |
| **Database** | Embedded PGlite (`scripts/db.mjs` on `127.0.0.1:5432`) | **Neon Serverless PostgreSQL** (via pooled `DATABASE_URL`) |
| **ORM & Connection Pool** | Prisma 7 WASM Client + `@prisma/adapter-pg` | Same (`PG_POOL_MAX` controls per-function pool size + automatic transient retry) |
| **French A4 PDF Invoices** | `pdfkit` (`src/lib/invoice-pdf.ts`) | Generated in-memory inside `/invoices/[id]/pdf` & `/api/invoices/[id]/pdf` |

> **Important repo-specific notes before you begin:**
> 1. `src/generated/` (the generated Prisma 7 client) is in `.gitignore`, and `package.json` defines `"build": "next build"`. On Vercel, you **must** run `npm run db:generate` before `npm run build` (shown in Step 3).
> 2. `prisma.config.ts` reads `env('DATABASE_URL')` at build time, so `DATABASE_URL` **must** be configured in Vercel Environment Variables **before** triggering the build.
> 3. `package.json` requires **Node.js `>=22`** (`"engines": { "node": ">=22" }`).

---

## Prerequisites

- Your repository (`habibtitraoui/amaya_dz`) pushed to **GitHub**.
- A **[Neon](https://console.neon.tech)** account (Free or Launch plan).
- A **[Vercel](https://vercel.com)** account connected to your GitHub account.
- **Node.js 22+** installed locally (`node -v`) if you plan to run database seed/admin bootstrap scripts from your terminal.

---

## Step 1 — Create & Configure the PostgreSQL Database in Neon

1. Sign in to the **[Neon Console](https://console.neon.tech)** and click **New Project**.
2. Fill in the project details:
   - **Project name:** `amaya-dz`
   - **Postgres version:** `16` or `17`
   - **Database name:** `amaya` (or keep default `neondb`)
   - **Region:** Select **AWS Europe (Frankfurt — `eu-central-1`)** or **AWS Europe (Paris — `eu-west-3`)**.
     > *Why EU?* These are the lowest-latency regions for customers in **Algeria (`DZ`)**, and we will match Vercel's Function Region to the exact same city in Step 3.
3. Click **Create project**.
4. In the Neon project dashboard, click **Connect** to open the connection string modal and copy **both** URLs (keep them safe for Steps 3 & 4):

   - **1. Pooled Connection String** *(Toggle **Connection pooling: ON** — hostname contains `-pooler`)*:
     ```text
     postgresql://<user>:<password>@ep-xxxx-xxxx-pooler.eu-central-1.aws.neon.tech/amaya?sslmode=require
     ```
     Use this as **`DATABASE_URL` in Vercel**. Neon's built-in PgBouncer pooler safely multiplexes concurrent serverless function connections.

   - **2. Direct Connection String** *(Toggle **Connection pooling: OFF** — no `-pooler` in hostname)*:
     ```text
     postgresql://<user>:<password>@ep-xxxx-xxxx.eu-central-1.aws.neon.tech/amaya?sslmode=require
     ```
     Keep this handy for running one-off CLI commands (`db:seed`, `db:reset`, admin bootstrap) from your local terminal.

---

## Step 2 — Generate a Production `AUTH_SECRET`

AMAYA signs `amaya_session` JWT cookies using `AUTH_SECRET` (`src/lib/session.ts`).
> **Critical:** `src/lib/session.ts` enforces a **minimum length of 24 characters**. If `AUTH_SECRET` is missing or shorter than 24 characters, it falls back to a predictable development key.

Run either command locally to generate a strong 32-byte secret and copy the output:

```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Step 3 — Create & Configure the Project in Vercel

### 3.1 Import the GitHub Repository

1. Open **[vercel.com/new](https://vercel.com/new)** → **Import Git Repository**.
2. Select **`habibtitraoui/amaya_dz`** and click **Import**.

### 3.2 Configure Build & Output Settings (Mandatory Override)

Expand **Build and Output Settings** on the Vercel setup screen:

| Setting | Value |
| --- | --- |
| **Framework Preset** | `Next.js` *(auto-detected)* |
| **Root Directory** | `./` |
| **Build Command** *(enable **Override**)* | `npm run db:generate && npm run db:migrate && npm run build` |
| **Output Directory** | *Leave default (Next.js default)* |
| **Install Command** | *Leave default (`npm install`)* |

**What this Build Command does on every deploy:**
1. `npm run db:generate` — Generates the TypeScript Prisma 7 client into `src/generated/prisma`.
2. `npm run db:migrate` — Runs `scripts/migrate.mjs`, which connects to Neon, creates `_amaya_migrations` if needed, applies `prisma/migrations/0001_init/migration.sql` inside a transaction, and skips already-applied migrations in milliseconds on subsequent deploys.
3. `npm run build` — Runs `next build`.

> **Optional alternative (in code instead of dashboard override):** If you prefer leaving Vercel's Build Command on default, update `"build"` in `package.json` to:
> ```json
> "build": "npm run db:generate && npm run db:migrate && next build"
> ```

### 3.3 Add Environment Variables (Before Clicking Deploy)

Expand **Environment Variables** and add the following keys (enable **Production**, **Preview**, and **Development** unless noted):

| Variable | Required? | Example / Value | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@ep-...-pooler.eu-central-1.aws.neon.tech/amaya?sslmode=require` | Neon **Pooled** PostgreSQL URL (needed at both build & runtime) |
| `AUTH_SECRET` | **Yes** | *(32-byte random string from Step 2, `>= 24` chars)* | Signs `amaya_session` HttpOnly JWT cookies |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | `https://amaya-dz.vercel.app` *(or `https://amaya.dz`, no trailing slash)* | Base URL for OpenGraph/metadata (`src/app/layout.tsx`) |
| `PG_POOL_MAX` | **Recommended** | `2` | Caps each serverless instance's internal `pg.Pool` (`src/lib/prisma.ts`, default `5`) |
| `AWS_ENDPOINT_URL_S3` | **Yes** (image uploads) | `https://br-xxxx.storage.c-2.eu-central-1.aws.neon.tech` | Neon Object Storage branch endpoint (`src/lib/storage.ts`) |
| `AWS_REGION` | **Yes** (image uploads) | `eu-central-1` | Storage region — must match the Neon project region |
| `AWS_ACCESS_KEY_ID` | **Yes** (image uploads) | *(storage credential `token_id`, e.g. `nak_live_…`)* | S3 access key used by `POST /api/admin/uploads` |
| `AWS_SECRET_ACCESS_KEY` | **Yes** (image uploads) | *(storage credential `s3_secret_access_key`, e.g. `nsk_live_…`)* | S3 secret key — shown **once** when the credential is created |
| `NEON_STORAGE_BUCKET` | **Yes** (image uploads) | `amaya-media` | Bucket created with `access: 'public_read'` (see Step 5.4) |
| `BUSINESS_PHONE` | Optional | `+213 555 00 00 00` | Fallback storefront phone (editable later in `/admin/settings`) |
| `BUSINESS_EMAIL` | Optional | `contact@amaya.dz` | Fallback storefront email (editable later in `/admin/settings`) |
| `BUSINESS_ADDRESS` | Optional | `Oran, Algérie` | Fallback storefront address (editable later in `/admin/settings`) |
| `COMPANY_ADDRESS` | Optional | `Oran, Algérie` | Emitter address printed on French A4 invoices |
| `COMPANY_RC` | Optional | *(leave empty until registered)* | Registre du Commerce on invoices (line omitted when blank) |
| `COMPANY_NIF` | Optional | *(leave empty until registered)* | NIF on invoices (line omitted when blank) |
| `COMPANY_AI` | Optional | *(leave empty until registered)* | Article d'Imposition on invoices (line omitted when blank) |

### 3.4 Deploy & Match Node.js 22 + EU Function Region

1. Click **Deploy** and wait for the initial build to finish.
2. Verify **Node.js Version** and **Function Region** in your new Vercel project:
   - Go to **Project → Settings → General → Node.js Version** → confirm **`22.x`** is selected.
   - Go to **Project → Settings → Functions → Function Region** → select **Frankfurt, Germany (`fra1`)** (if your Neon DB is in `eu-central-1`) or **Paris, France (`cdg1`)** (if your Neon DB is in `eu-west-3`), then click **Save**.
3. If you changed either setting (or updated `NEXT_PUBLIC_SITE_URL` to your actual `.vercel.app` URL), go to **Deployments → ⋯ → Redeploy** so the changes take effect.

---

## Step 4 — Initialize the Database & Create Your Admin Account

AMAYA intentionally has **no public sign-up page** — retail buyers check out as guests, while B2B (`WHOLESALE` / `SUPER_WHOLESALE`) and staff accounts are created from `/admin`.

After Step 3, your Neon database has all 16 tables migrated, **but zero users**. Choose **either Option 4A or Option 4B** below depending on whether this is a real store or a demo/staging environment:

### Option 4A — Clean Production Bootstrap (Recommended for Live Store)

> *Why choose 4A for production?* `npm run db:seed` creates sample orders (`AMY-YYYY-00001..3`) and a sample invoice (`FAC-YYYY-00001`). Invoices are immutable once issued, but deleting an order also removes its linked invoice and invoice lines, so bootstrapping only your real Admin account keeps your invoice numbering (`FAC-YYYY-00001`) 100% clean.

From a local clone of the repo (with `npm install` completed), run this one-liner using your Neon **Direct** URL and your desired admin email/password:

```bash
DATABASE_URL="postgresql://<user>:<password>@ep-xxxx.eu-central-1.aws.neon.tech/amaya?sslmode=require" \
ADMIN_EMAIL="admin@amaya.dz" \
ADMIN_NAME="Administrateur AMAYA" \
ADMIN_PASSWORD='ChangeMe-StrongPassword-2026' \
node -e '
import("node:crypto").then(async ({ randomBytes, scryptSync }) => {
  const { default: pg } = await import("pg");
  const salt = randomBytes(16);
  const hash = scryptSync(process.env.ADMIN_PASSWORD.normalize("NFKC"), salt, 64);
  const passwordHash = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
  const id = "adm_" + randomBytes(10).toString("hex");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`
    INSERT INTO "Sequence" ("key", "value")
    VALUES (\x27order\x27, 0), (\x27invoice\x27, 0)
    ON CONFLICT ("key") DO NOTHING;
  `);
  await client.query(
    `INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, \x27ADMIN\x27, \x27ACTIVE\x27, NOW(), NOW())
     ON CONFLICT ("email") DO NOTHING;`,
    [id, process.env.ADMIN_EMAIL.toLowerCase().trim(), process.env.ADMIN_NAME, passwordHash]
  );
  await client.end();
  console.log("Production admin & sequences initialized successfully.");
});
'
```

### Option 4B — Full Demo Catalog & Accounts (`npm run db:seed`)

If you want the 8 categories, 9 mobile-accessory products, 4 demo accounts, and sample orders/invoices right away:

```bash
npm install
npm run db:generate
DATABASE_URL="postgresql://<user>:<password>@ep-xxxx.eu-central-1.aws.neon.tech/amaya?sslmode=require" \
AWS_ENDPOINT_URL_S3="https://br-xxxx.storage.c-2.eu-central-1.aws.neon.tech" \
AWS_REGION="eu-central-1" \
AWS_ACCESS_KEY_ID="<token_id>" \
AWS_SECRET_ACCESS_KEY="<nsk_…>" \
NEON_STORAGE_BUCKET="amaya-media" \
npm run db:seed
```

> **Catalog artwork.** The demo images ship in `assets/catalog/**` — deliberately
> **outside** `public/`, so they are never served by the app and never bloat the
> build. The seed uploads each one to Object Storage (`catalog/products/…`,
> `catalog/categories/…`) and stores the returned public URLs.
> Without the `AWS_*` variables it falls back to copying the files into `public/`
> so a bare `npm run dev` still renders images (`SEED_ASSET_MODE=public` forces
> that behaviour explicitly).

> **Security checklist if you run `db:seed` on a public URL:**
> 1. Log in immediately at `https://<your-app>.vercel.app/login` with `admin@amaya.dz` / `Admin@2026`.
> 2. Go to **`/account`** and **change the Admin password immediately**.
> 3. Go to **`/admin/supervisors`** and **`/admin/customers`** and suspend or change passwords for the demo accounts (`superviseur@amaya.dz`, `gros@boutique.dz`, `supergros@distrib.dz`).

---

## Step 5 — Verify Your Production Deployment

Run through these 5 quick checks after deploying:

1. **Database & API Health Check:**
   Open `https://<your-app>.vercel.app/api/health` in your browser. You should receive HTTP `200`:
   ```json
   {
     "ok": true,
     "service": "amaya-api",
     "database": "up",
     "time": "2026-..."
   }
   ```
2. **Storefront & RTL Default:**
   Open `https://<your-app>.vercel.app` in a private/incognito window. Verify Arabic (`RTL`) renders by default and switching between **العربية / Français / English** persists across page reloads.
3. **Admin Sign-In & Settings:**
   Sign in at `https://<your-app>.vercel.app/login` → open **`/admin`** → visit **`/admin/settings`** to set your store phone, WhatsApp, email, hours, delivery fee (DZD), and free-delivery threshold.
4. **Product Images (Neon Object Storage):**
   Vercel Serverless Functions have a read-only filesystem at runtime, so uploads go to **Neon Object Storage** — S3-compatible storage in the same Neon project (5 GB free, no credit card, image bytes never touch Postgres compute):
   - Provision it once in Neon: `npm i @neon/config && neon link`, add a `neon.ts` declaring `buckets: { 'amaya-media': { access: 'public_read' } }` (public read is required — storefront visitors load these URLs anonymously), then `neon deploy`. This writes the `AWS_*` variables; add `NEON_STORAGE_BUCKET=amaya-media` alongside them in Vercel (table in §3.3).
   - In `/admin/products` and `/admin/categories`, click **Téléverser un fichier**: the browser optimizes the image to WebP (≤1600 px, ~100–200 KB), `POST /api/admin/uploads` stores it in the bucket, and the returned public HTTPS URL is saved in `ProductImage.url` / `Category.image`. **No schema change** — pasting an external `https://…` URL into the same field still works (`next.config.ts` already allows all HTTPS remote image hosts).
5. **Existing demo artwork → Object Storage:**
   An installation seeded before the move keeps `/products/…` and `/categories/…`
   paths in the database, which no longer resolve once the files leave `public/`.
   Fix it in one click: sign in as **Admin** → **`/admin/settings`** → **Migrer les images**.
   The action uploads every master in `assets/catalog/**` to deterministic keys
   (`catalog/products/…`, `catalog/categories/…`, so re-running never duplicates objects),
   rewrites `ProductImage.url`, `ProductVariant.image`, `Category.image` and the homepage
   banner, and reports how many references changed plus any it could not resolve.
   It is **idempotent** — images already pointing at storage are left untouched — and the
   same logic runs as `POST /api/admin/catalog-migration` for scripted use.

   The banner image is now the **`hero.image`** setting (Section « Page d’accueil » in
   `/admin/settings`), so it can be uploaded like any other picture — no code change needed.

6. **French A4 Invoice PDF Generation:**
   Open an order in `/admin/orders`, issue an invoice, and verify both:
   - Printable HTML view: `/invoices/<invoiceId>?print=1`
   - Server-rendered PDF: `/invoices/<invoiceId>/pdf`

---

## Step 6 — Connect a Custom Domain (e.g. `amaya.dz`)

1. In Vercel, open **Project → Settings → Domains**.
2. Enter your domain (e.g. `amaya.dz` and `www.amaya.dz`) and click **Add**.
3. Update your domain registrar's DNS records as instructed by Vercel:
   - **Apex (`amaya.dz`):** `A` record → `76.76.21.21`
   - **Subdomain (`www`):** `CNAME` record → `cname.vercel-dns.com`
4. Wait for Vercel to provision SSL automatically (usually a few minutes).
5. Go to **Project → Settings → Environment Variables**, update `NEXT_PUBLIC_SITE_URL` to `https://amaya.dz`, and **Redeploy** Production.

---

## Step 7 — (Optional) Neon Branching for Preview Deployments

To keep Pull Request preview deployments isolated from production data:

- **Manual Preview Branch:** In the Neon Console, go to **Branches → Create Branch** (forked from `main`, named `preview`). Copy its `-pooler` connection string, and in Vercel **Settings → Environment Variables**, add a separate `DATABASE_URL` scoped **only** to **Preview** (keeping your `main` Neon URL scoped to **Production**).
- **Automated PR Branches:** Install the official **[Neon Postgres Integration on Vercel Marketplace](https://vercel.com/marketplace/neon)** to automatically create and destroy isolated Neon database branches for every GitHub Pull Request.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build fails with `Module not found: Can't resolve '@/generated/prisma/client'` | `src/generated/` is gitignored and `next build` ran before Prisma Client was generated. | Override Vercel **Build Command** to `npm run db:generate && npm run db:migrate && npm run build`. |
| Build fails with `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` | `prisma.config.ts` requires `DATABASE_URL` even during `db:generate`. | Add `DATABASE_URL` in Vercel **Environment Variables** for **both** Production and Preview, then redeploy. |
| `/api/health` returns `503 {"ok":false,"database":"down"}` | Invalid connection string, missing `?sslmode=require`, or wrong password. | Re-copy the **Pooled** connection string from Neon (**Connect → Connection pooling: ON**), ensure `?sslmode=require` is present, update `DATABASE_URL` in Vercel, and redeploy. |
| First visit after 5+ minutes of inactivity takes ~1–2 seconds | Neon Free plan suspends idle compute after 5 minutes (*Scale to Zero*). | Expected on Free tier (`src/lib/prisma.ts` has a 10s timeout + automatic retry so requests succeed). Upgrade to Neon Launch/Scale to disable or lengthen auto-suspend if instant cold starts are required. |
| Login succeeds locally, or sessions reset unexpectedly in production | `AUTH_SECRET` is missing or `< 24` characters. | Set `AUTH_SECRET` in Vercel to a random string of **at least 32 characters** and redeploy. |
| Node engine warning or build error on Vercel | Repo specifies `"engines": { "node": ">=22" }`. | Set **Node.js Version** to **`22.x`** in **Vercel → Project Settings → General**. |
