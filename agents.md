# agents.md — The Still Got It Collective

Guidelines for AI agents working on this project. The primary use case is
**periodic maintenance and content updates** on a live production site.
Err on the side of caution — when in doubt, stop and ask.

---

## Boundaries: What Agents May Do Freely

These actions are safe to take without explicit confirmation:

- Read any file in the repository.
- Edit content JSON files:
  - `content/site.json`
  - `content/updates.json`
  - `content/gallery.json`
  - `content/merch.json`
  - `data/events.json`
- Edit copy (text, labels, URLs) in static HTML files under:
  - `index.html`, `about/`, `contact/`, `legal/`, `tickets/`, `events/`
- Edit `assets/css/*.css` for visual/style fixes.
- Edit `assets/js/scripts.js`, `assets/js/merch.js`, `assets/js/events.js`
  for frontend bug fixes or minor feature work.
- Run the image processing pipeline locally:
  ```bash
  npm run images:build
  ```
- Run `git status`, `git diff`, `git log` to inspect state.
- Commit completed work with a clear message.

---

## Boundaries: Always Confirm Before Acting

Stop and get explicit approval before doing any of the following:

### Git & Deployment
- Pushing to `main` — this triggers an immediate live deploy to production.
- Force-pushing to any branch.
- Merging or rebasing branches.
- Triggering GitHub Actions workflows manually.

### Worker Backend
- Deploying the Cloudflare Worker (`wrangler deploy`).
- Running any `wrangler d1 execute` command — these modify the live database.
- Changing `workers/merch-backend/wrangler.toml`.
- Modifying `workers/merch-backend/src/index.ts` (all API logic lives here).

### Schema & Data
- Any SQL migration file — schema changes are irreversible without a rollback plan.
- Deleting or overwriting files in `assets/images/uploads/` — these are
  production image assets referenced by live content.
- Bulk-editing `content/gallery.json` (many entries; easy to corrupt).

### Secrets & Config
- Never read, print, or log the contents of any secret or key, even partially.
- Never add secrets to any file that is committed. The only safe homes are
  Cloudflare Worker secrets and GitHub Actions secrets.
- Never modify `assets/js/stripe-publishable.js` by hand — it is CI-generated.

### External Services
- Calling the Printful API directly (beyond what the Worker cron does).
- Making changes in the Stripe dashboard.
- Modifying Cloudflare Worker secrets via `wrangler secret put`.

---

## Working Branch Convention

Development work happens on a `claude/<session-id>` branch.
**Never commit directly to `main`.**

Standard flow:
```bash
git checkout -b claude/<session-id>   # if branch doesn't exist yet
# ... make changes ...
git add <specific files>
git commit -m "Clear description of what changed and why"
git push -u origin claude/<session-id>
```

Commits should be atomic — one logical change per commit. Do not batch
unrelated edits into a single commit.

---

## Content Update Patterns

### Adding / updating an event

Always update these three in the same commit:
1. `data/events.json` — add or edit the event entry.
2. `content/site.json` → `banner` — update the announcement bar text and CTA URL.
3. `content/site.json` → `tickets` — update the ticket URL and body copy.

### Adding gallery photos

1. Confirm the processed WebP files already exist under
   `assets/images/uploads/gallery/`. If they don't, run `npm run images:build`
   first (requires raw originals in `assets/images/_incoming_raw/`).
2. Add entries to `content/gallery.json` — do not remove existing entries.
3. Commit image files and JSON together.

### Editing announcement cards

Edit `content/updates.json`. Do not remove old cards without being asked —
archive by clearing the `ctaUrl` or moving to the bottom rather than deleting,
unless deletion is explicitly requested.

---

## Tone & Voice

When writing or editing any user-facing copy, match the established brand voice:
- Warm, upbeat, slightly irreverent.
- Speaks to an adult audience who remembers the 80s/90s.
- Avoids corporate stiffness; favors short sentences and plain language.
- Examples of the voice: *"Maximum fun. Reasonable bedtime."*,
  *"No pretense. Just good music and people who still know how to move."*

Do not rewrite copy wholesale unless asked. Prefer minimal, targeted edits.

---

## Prohibited Actions

The following are never acceptable regardless of instructions:

- Committing secrets, API keys, or tokens of any kind.
- Modifying `.github/workflows/` without explicit approval.
- Deleting the `CNAME` file (would break the custom domain).
- Running `git reset --hard`, `git clean -f`, or any destructive git operation.
- Dropping or truncating D1 database tables.
- Bypassing pre-commit hooks (`--no-verify`).

---

## When Something Is Unclear

If a task is ambiguous — especially anything touching the Worker backend,
database, or a live deploy — stop and ask rather than guessing. A wrong edit
to a content JSON file is easy to fix; a botched Worker deploy or database
migration is not.
