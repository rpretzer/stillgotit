## Still Got It Collective – Engineering Handoff (2025‑12‑15)

This document summarizes the current state of the project, key architecture decisions, integrations, and open follow‑ups so another engineer can continue safely.

---

### 1. Repos & Major Areas

- **Static marketing site (GitHub Pages root)**
  - HTML/CSS/JS in the repo root (`index.html`, `assets/css/style.css`, `assets/js/scripts.js`, etc.).
  - Content managed by **Decap CMS** (`/admin/`, `content/*.json`, `data/events.json`, `content/site.json`, `content/gallery.json`).
  - Image assets live under `assets/images/...` with processed variants and a `manifest.json`.
- **Merch storefront (static front-end)**
  - Lives under `/merch`:
    - `merch/index.html` – storefront landing + product grid + cart drawer.
    - `merch/checkout.html` – 2‑step checkout (shipping → Stripe Payment Element).
    - `merch/success/index.html` – order confirmation page pulling order details from backend.
    - `merch/recover.html` – abandoned cart recovery page.
  - JS:
    - `assets/js/merch.js` – catalog fetch, cart logic, abandoned cart save, redirect to `/merch/checkout.html`.
    - `assets/js/checkout.js` – checkout flow with Stripe Payment Elements.
    - `assets/js/recover-cart.js` – abandoned cart recovery logic.
    - `assets/js/stripe-publishable.js` – injected at build time with Stripe publishable key by GitHub Actions.
- **Cloudflare Worker backend (production)**
  - Located in `workers/merch-backend/` (D1 + Workers runtime).
  - Handles:
    - `POST /api/checkout` – creates Stripe PaymentIntent and order row in D1.
    - `POST /api/stripe/webhook` – Stripe webhook: marks orders as paid and triggers Printful fulfillment.
    - `GET /api/products` – product catalog for frontend.
    - `GET /api/orders/:id` – order detail for success page.
    - `POST /api/carts/abandoned` – save abandoned carts.
    - `GET /api/carts/recover/:token` / `POST /api/carts/recover/:token` – abandoned cart recovery.
  - D1 schema files:
    - `workers/merch-backend/schema.sql` – orders, order_items, order_events.
    - `workers/merch-backend/schema-abandoned-carts.sql` – abandoned cart storage.
- **Merch monorepo prototype (`merch-platform/`) – NOT currently used in prod**
  - Intended for a future “full app” (Node/Express/Next.js + Postgres + Prisma, Stripe, Printful).
  - Key files:
    - `merch-platform/apps/api/prisma/schema.prisma`
    - `merch-platform/apps/api/src/env.ts`
    - `merch-platform/apps/api/src/printful/client.ts`
    - `merch-platform/apps/api/src/routes/stripeWebhook.ts`
    - `merch-platform/apps/api/src/index.ts`
  - This is a reference / future path; current live flow uses the Cloudflare Worker only.

---

### 2. Frontend: Static Site & UX

- **Global CSS system**
  - Centralized in `assets/css/style.css` with a comprehensive design token system:
    - Color palette (`--color-primary-*`, `--color-secondary-*`, `--bg-*`, `--text-*`, etc.).
    - Typography tokens (font families, sizes, weights, line heights).
    - Spacing, radii, shadows, transitions.
  - Key sections styled here:
    - `hero` (including `hero-background` overlay, `hero-ctas`, `.announcement-banner`).
    - Gallery (`.gallery-grid`, `.gallery-item`, lightbox modal).
    - Events calendar container.
    - Tickets & merch sections, Instagram block, footer.
  - **Accessibility:** buttons and text updated to meet WCAG AA contrast where possible.

- **Hero section**
  - Narrative and CTAs live in `index.html` hero section.
  - Background image is **CMS‑configurable** via `content/site.json`:
    - `hero.imageUrl` is used by `assets/js/scripts.js` to set `.hero-background.hero-background-img`.
  - Additional legibility changes:
    - Hero text uses `color: var(--text-inverse)` over a darker overlay.
    - `.announcement-banner` uses white background and dark body text.

- **Gallery**
  - Markup in `index.html` under gallery section.
  - Data source:
    - Primary: `content/gallery.json` (managed by Decap).
    - Images are also mirrored from `assets/images/uploads/...` via the image processing script and `manifest.json`.
  - Client logic in `assets/js/scripts.js`:
    - Fetches gallery JSON, sorts by `featured`, sets up **pagination** (default 12 items per page).
    - Injects `.gallery-item` cells dynamically.
    - Removes legacy “gallery size selector” – user sees pager controls only.
    - Lightbox implementation (`#lightbox`) with keyboard navigation and previous/next.

- **Events calendar**
  - Data source: `data/events.json` (Decap‑managed).
  - `assets/js/events.js`:
    - Renders a month grid (7‑column layout fixed in `assets/css/events.css`).
    - Shows event details in a modal overlay.
  - Combined view: the old “Upcoming” + “Calendar iframe” were consolidated into this single calendar experience.

- **Merch checkout UI**
  - `merch/checkout.html`:
    - Mobile‑first, two‑step flow.
    - Step 1: shipping/contact form with semantic fields and `autocomplete` attributes.
    - Step 2: embedded Stripe Payment Element and order summary.
  - `assets/css/merch.css`:
    - Modern layout with consistent spacing, stacked cards, and responsive columns.
    - Fixes for variant selects (`.merch-select`) to avoid black‑on‑black issues (light background, dark text).

- **Global toast notifications**
  - CSS in `assets/css/style.css`: `.toast-stack`, `.toast`, `.toast--success|error|info`, etc.
  - JS utility in `assets/js/scripts.js`:
    - Exposes `window.showToast({ title, message, variant, timeout })`.
    - Renders toasts into a stack, auto‑dismiss after `timeout`, clickable to dismiss immediately.
  - Intended for lightweight user feedback (e.g., “Added to cart”, “Settings saved”).

---

### 3. Image Processing Pipeline

- **Script:** `tools/process-images.mjs`
  - Uses `sharp` to generate resized/optimized derivatives.
  - **Idempotent**:
    - Generates hashed filenames to avoid overwriting.
    - Merges into a central `manifest.json` and skips already‑processed items.
  - **Inputs:**
    - `--input` – base directory for images (e.g. `assets/images/uploads` or `assets/images/_incoming_raw`).
    - `--files` – optional subset.
    - `--dry-run` – log what would be done without writing.
  - Output:
    - Multiple size variants (thumb/medium/full, WebP/JPEG) and `manifest.json` per gallery.

- **Usage:**
  - Local:
    - `npm run images:build` (ensure `sharp` is installed – `npm install` has already been done once).
  - CI:
    - Can be wired into GitHub Actions as necessary; currently manual/on‑demand use is expected.

---

### 4. Merch Flow (Live Path)

**High‑level flow:**

1. User browses `/merch`:
   - `assets/js/merch.js` fetches product catalog from the Worker: `GET /api/products`.
   - Renders product cards with image, price, description, and optional variant selector.
2. Cart:
   - Cart is stored in `localStorage`.
   - `merch.js` supports add/remove/update quantity; updates cart icon count.
   - On certain conditions (e.g., leaving checkout), cart is also saved as **abandoned** via `POST /api/carts/abandoned`.
3. Checkout:
   - `createCheckout` in `merch.js` navigates to `/merch/checkout.html`.
   - `assets/js/checkout.js`:
     - Validates shipping/contact form.
     - Calls Worker `POST /api/checkout` with cart and customer/shipping info.
     - Receives `{ clientSecret, orderId }` for Stripe PaymentIntent.
     - Initializes Stripe Payment Element using publishable key from `assets/js/stripe-publishable.js`.
     - Calls `elements.submit()` then `stripe.confirmPayment({ elements, clientSecret, confirmParams, redirect: 'if_required' })`.
     - On success:
       - Clears `localStorage` cart.
       - Redirects to `/merch/success/?orderId=...`.
4. Post‑payment:
   - Stripe sends webhook to Worker `POST /api/stripe/webhook`.
   - Worker verifies webhook signature, marks `orders.status = 'PAID'`, and triggers Printful fulfillment for Printful‑backed SKUs.
5. Order confirmation:
   - `merch/success/index.html`:
     - `assets/js/success-order.js` (or similar) fetches `GET /api/orders/:id` from Worker and renders details.

---

### 5. Backends & Environments

#### 5.1 Cloudflare Worker (merch backend)

- **Config:** `workers/merch-backend/wrangler.toml`
  - Bound to a D1 database (ID already updated).
  - Secrets expected:
    - `STRIPE_SECRET_KEY` – Stripe secret key (use test key in test env).
    - `STRIPE_WEBHOOK_SECRET` – for verifying Stripe webhooks.
    - `PRINTFUL_TOKEN` – OAuth2 Printful token for `Authorization: Bearer ...`.
  - Old Square‑related vars removed.

- **Key runtime files:**
  - `index.ts` (or equivalent entry):
    - All `/api/*` routes (checkout, products, orders, carts, webhook).
    - Handles Stripe PaymentIntent creation and error reporting.
  - `printful/client.ts`:
    - Uses `PRINTFUL_TOKEN` via `Authorization: Bearer ${env.PRINTFUL_TOKEN}`.
  - Database access:
    - Uses D1 (Cloudflare) for prod; Prisma + Postgres only in the unused `merch-platform` prototype.

#### 5.2 GitHub Actions / CI

- Workflow: `.github/workflows/pages.yml`
  - Builds static site for GitHub Pages.
  - Injects Stripe publishable key from secret into `assets/js/stripe-publishable.js`.
    - Secret name must match what the workflow expects (e.g. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` or similar).
  - Manual trigger enabled via `workflow_dispatch` to debug and redeploy.

---

### 6. Analytics

- **Google Analytics 4 (GA4)**
  - GA4 tag snippets are in:
    - `index.html`
    - `merch/index.html`
    - `merch/checkout.html`
  - The UA is a GA4 ID (e.g., `G-XXXXXXXXXX`); earlier troubleshooting showed tags present, even if Google’s checker occasionally did not detect them (likely cache/ad‑block/latency).
  - **Recent request:** user asked to update the tag to **`G-M23KTK21ZD`**.  
    - This requires a search/replace of the old GA4 ID in all GA snippets in the above HTML files and redeploy via GitHub Actions.
    - This edit is **not yet applied** in this handoff.

---

### 7. Abandoned Cart Feature

- **Database:**
  - Schema in `workers/merch-backend/schema-abandoned-carts.sql`.
  - Stores:
    - Cart JSON payload.
    - Customer email and metadata.
    - Unique recovery token and timestamps.
- **Worker API:**
  - `POST /api/carts/abandoned` – store cart when a user leaves at checkout.
  - `GET /api/carts/recover/:token` – look up cart by token.
  - `POST /api/carts/recover/:token` – (for future) mark recovery used or update cart.
- **Frontend:**
  - `assets/js/merch.js` – triggers save to backend when conditions suggest abandonment.
  - `merch/recover.html` + `assets/js/recover-cart.js` – loads abandoned cart from tokenized URL and restores it into localStorage/cart UI.

---

### 8. Known Issues / Edge Cases

- **Stripe:**
  - If `STRIPE_SECRET_KEY` or publishable key are missing/mismatched:
    - Worker may log `"Invalid API Key provided: undefined"`.
    - Frontend may show “Stripe is not configured. Please contact support.”
  - The system has been tested in both live and test mode; using a test card against live keys will produce expected “Your card was declined (test card in live mode)” errors.
- **GA4 detection:**
  - Google’s “Tag not detected” sometimes appeared despite correct snippet.
  - Recommended to verify via Real‑Time reports and tag assistant rather than relying solely on that tester.
- **CMS / gallery:**
  - If `content/gallery.json` or `data/events.json` are missing or invalid, the JS falls back to console warnings and static markup.

---

### 9. How to Run / Develop Locally

Assuming a Linux/macOS dev environment with Node and npm installed.

- **Install dependencies:**

```bash
cd /home/rpretzer/still-got-it-collective
npm install
```

- **Build/process images:**

```bash
npm run images:build
```

- **Serve static site** (pick any static server, e.g.):

```bash
npx serve .
```

- **Cloudflare Worker (if working on backend locally):**
  - From `workers/merch-backend/`:

```bash
wrangler d1 execute <DB_NAME> --file=schema.sql
wrangler d1 execute <DB_NAME> --file=schema-abandoned-carts.sql
wrangler dev
```

Set the required secrets using `wrangler secret put STRIPE_SECRET_KEY`, etc.

---

### 10. Open Follow‑Ups / Next Steps

- **[HIGH] Update GA4 tag to `G-M23KTK21ZD`**
  - Search for the old GA ID in:
    - `index.html`
    - `merch/index.html`
    - `merch/checkout.html`
  - Replace with `G-M23KTK21ZD`, commit, push, and re‑run GitHub Pages workflow.

- **[MEDIUM] Integrate toast notifications in UX flows**
  - Use `window.showToast` in:
    - `assets/js/merch.js` (e.g., “Item added to cart”).
    - `assets/js/checkout.js` (non‑blocking info/errors).
    - Other key interactions (newsletter signup, etc.) if desired.

- **[MEDIUM] Harden abandoned cart recovery**
  - Add server‑side logic to mark carts as “recovered” or “expired”.
  - Consider rate limiting and token expiration.

- **[MEDIUM] Future: migrate to full merch-platform**
  - If you decide to move from Workers+D1 to a full Node/Next/Prisma stack, the `merch-platform/` scaffolding is a good starting point.
  - Requires proper Docker Compose setup, Postgres provisioning, and re‑plumbing the front‑end to call the new API instead of the Worker.

- **[LOW] Dark mode**
  - There is a `prefers-color-scheme: dark` block in `assets/css/style.css`, but no toggle UI yet.
  - Could be wired up with a `data-theme` attribute and a small JS helper.

---

### 11. Git / Workflow Notes

- User preference: **always push after commit**.
  - Usual pattern so far:

```bash
git add <files>
git commit -m "message"
git push origin main
```

- When remote diverged, `git pull --rebase` has been used to reconcile.
- GitHub Pages deploy is handled via the `pages.yml` GitHub Actions workflow; you may need to trigger it manually via **Actions → workflow_dispatch** when editing secrets or env‑related code.

---

### 12. Quick Orientation Checklist for New Engineer

1. Confirm you have access to:
   - GitHub repo with GitHub Pages enabled.
   - Cloudflare account with Worker + D1 DB.
   - Stripe dashboard (keys + webhooks).
   - Printful API access and OAuth token.
   - GA4 property (`G-M23KTK21ZD`).
2. Verify env:
   - Run `wrangler whoami` and make sure the correct account is targeted.
   - Check Worker secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PRINTFUL_TOKEN`).
   - Check GitHub Actions secrets for the Stripe **publishable** key.
3. Do a test order in **Stripe test mode**:
   - Switch both backend secret key and frontend publishable key to test keys.
   - Use a Stripe test card; confirm:
     - Checkout page loads Payment Element.
     - Payment succeeds.
     - Worker webhook marks order paid and (optionally) kicks off a test Printful flow.
4. Tackle open follow‑ups above, starting with GA4 ID update and any user‑requested UX tweaks.

This handoff should give you enough context to make safe changes and continue the project; if anything seems ambiguous, start by reading `index.html`, `assets/js/scripts.js`, `assets/js/merch.js`, and `workers/merch-backend/index.ts` to build a mental model of the request/response flows and page layout. 


