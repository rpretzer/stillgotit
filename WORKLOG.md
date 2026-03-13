# Work Log — The Still Got It Collective

Most recent entries at the top.

---

## 2026-03-13

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

## Open / Pending

### Awaiting gap assessment results
- CORS policy in Worker — reflects any origin; may need locking to production domain (requires `wrangler deploy`)
- Rate limiting — no rate limiting on `/api/checkout`, `/api/carts/abandoned`, or `/api/sync/products`
- Expired abandoned cart purge — cron only syncs Printful; expired carts accumulate in D1
- Sitemap completeness — secondary pages may be missing
- Unsubscribe / cancel pages — GA4 and functionality TBD
- Promo code form — placeholder "coming soon" message; visibility TBD
- Admin CMS config (`admin/config.yml`) — verify collections match repo structure

### Known longer-term items (from HANDOFF)
- [ ] Migrate to full `merch-platform` stack (Node/Next/Prisma) — future, not urgent
- [ ] Newsletter/email signup — no mechanism exists currently
- [ ] Promo code backend support — checkout form placeholder only
