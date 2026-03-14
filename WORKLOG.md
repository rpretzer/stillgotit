# Work Log — The Still Got It Collective

Most recent entries at the top.

---

## 2026-03-13 (continued)

### Session: claude/review-project-QZTyu

#### Actions Taken

- **Created `CLAUDE.md`** — Project orientation file covering file map, deployment notes, common maintenance tasks (events, gallery, announcements, merch), content style, credentials reference, architecture overview, and known open items.

- **Created `agents.md`** — Agentic behavior guidelines covering: what agents may do freely vs. what requires confirmation, working branch conventions, content update patterns, brand voice notes, and hard prohibitions.

- **GA4 audit** — Confirmed `G-M23KTK21ZD` is already correct in `index.html`, `merch/index.html`, `merch/checkout.html`. HANDOFF item was already resolved.

- **Toast notifications audit** — Confirmed `window.showToast` is fully wired in `merch.js` (add to cart, remove, clear, empty cart) and `checkout.js` (errors, shipping calculated, order created, payment success). HANDOFF item was already resolved.

- **Abandoned cart audit** — Confirmed Worker already implements 30-day expiration (enforced on read), `recovered_at` timestamp on recovery, and upsert logic to prevent duplicate tokens per email. HANDOFF item was already resolved.

- **Dark mode audit** — Confirmed dark mode toggle is fully implemented in `scripts.js` with `localStorage` persistence and `data-theme` attribute on `<html>`. HANDOFF noted this as missing — it was already done.

- **GA4 added to secondary pages** — `about/`, `contact/`, `legal/`, `events/`, `merch/success/`, `merch/recover.html` were all missing the GA4 snippet. Added to all six. Skipped `tickets/` (JS redirect — tag won't fire before navigation).

- **Gap assessment launched** — Subagent running assessment on CORS policy, rate limiting, cron cleanup, sitemap completeness, unsubscribe/cancel pages, promo code form, and admin CMS config. Results pending.

#### Commits
- `05a8e99` Add CLAUDE.md for ongoing maintenance and content updates
- `bd40a8b` Add agents.md with guidelines for AI-assisted maintenance
- `2a45267` Add GA4 tracking to secondary pages

---

### Gap Assessment — Findings & Actions

Full assessment run by subagent against 10 areas. Results:

| Area | Finding | Action |
|---|---|---|
| CORS policy | Reflects any origin — effectively open to all domains | Needs Worker fix + deploy |
| Rate limiting | `/api/carts/abandoned` has 1/hr per email; `/api/checkout` has none | Needs Worker fix + deploy |
| Abandoned cart cleanup | Cron only syncs Printful; expired carts accumulate in D1 indefinitely | Needs Worker fix + deploy |
| Sitemap | Missing `/events/`; no `<lastmod>` on any entry; checkout/success pages shouldn't be indexed | **Fixed** — see commit |
| Unsubscribe page | Functional mailto handler; no GA4 intentionally | No action needed |
| Cancel page | Static page, no GA4 | **Fixed** — GA4 added |
| Promo code form | Hidden by default — correct UX | No action needed |
| Dark mode toggle | JS-injected into navbar — works, slight paint delay possible | No action needed |
| merch.json empty | No graceful fallback if Worker API fails | **Fixed** — static fallback added to `merch.js` |
| admin/config.yml | All CMS collection paths verified correct | No action needed |

#### Actions Taken (gap follow-up)

- **Sitemap fixed** — Added `/events/` entry; added `<lastmod>2026-03-13</lastmod>` to all entries; removed transactional pages (`merch/checkout.html`, `merch/success/`) that should not be indexed.
- **merch.js fallback** — If Worker API is unreachable or returns non-OK, `loadCatalog()` now falls back to `/content/merch.json` before throwing. Graceful degradation instead of hard error.
- **GA4 on cancel page** — `merch/cancel/index.html` now has GA4 tag for consistent tracking of checkout abandonment events.

#### Commits (gap follow-up)
- `(pending)` Fix sitemap, merch.js fallback, cancel page GA4

---

## Open / Pending

### Worker changes — code committed, awaiting manual deploy

All three Worker changes are coded and committed. `CLOUDFLARE_API_TOKEN` is not
available in this environment so `wrangler deploy` must be run manually.

```bash
cd workers/merch-backend
wrangler deploy
```

- [x] **CORS lockdown** — `corsHeaders()` now validates origin against allowlist (`www` + apex). Rejects unknown origins by returning the primary domain header (browser will block the request).
- [x] **Checkout rate limiting** — `POST /api/checkout` now checks the `orders` table for recent attempts: max 3 per email per 5 minutes. Returns 429 on breach. Uses existing D1 table, no migration required.
- [x] **Abandoned cart cron cleanup** — Daily `scheduled()` handler now runs both Printful sync and `DELETE FROM abandoned_carts WHERE created_at < datetime('now', '-30 days')` in parallel.

### Known longer-term items (from HANDOFF)
- [ ] Migrate to full `merch-platform` stack (Node/Next/Prisma) — future, not urgent
- [ ] Newsletter/email signup — no mechanism exists currently
- [ ] Promo code backend support — checkout form placeholder only
