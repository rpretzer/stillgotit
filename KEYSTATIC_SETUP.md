# Keystatic CMS Setup Guide

This replaces Decap CMS (`/admin/`) with Keystatic Cloud. The admin UI will
live at a separate Cloudflare Pages deployment (e.g., `cms.stillgotitcollective.com`).
The main GitHub Pages site is unchanged.

---

## Architecture

```
stillgotitcollective.com        ← GitHub Pages (unchanged)
cms.stillgotitcollective.com    ← Cloudflare Pages (new, Keystatic admin)
         │
         └── reads/writes → rpretzer/stillgotit (GitHub repo, main branch)
                                → triggers GitHub Pages rebuild automatically
```

---

## Step 1 — Sign up at Keystatic Cloud

1. Go to [keystatic.cloud](https://keystatic.cloud) and sign in with GitHub.
2. Create a new **Project**, point it at `rpretzer/stillgotit`.
3. Install the Keystatic GitHub App on the repo when prompted.
4. Copy your **project slug** — it looks like `your-team/your-project`.
5. Open `keystatic/keystatic.config.ts` and replace the placeholder:
   ```ts
   cloud: {
     project: 'your-team/your-project', // ← paste your slug here
   },
   ```
6. Commit and push.

---

## Step 2 — Deploy to Cloudflare Pages

1. In the Cloudflare dashboard → **Pages** → **Create a project** → **Connect to Git**.
2. Select the `rpretzer/stillgotit` repo.
3. Set the build configuration:
   - **Root directory:** `keystatic`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** `20`
4. Add a **Custom Domain**: `cms.stillgotitcollective.com` (or similar).
5. Deploy.

---

## Step 3 — Configure Keystatic Cloud callback URL

Back in the Keystatic Cloud dashboard, add your deployed URL as an allowed
redirect:

```
https://cms.stillgotitcollective.com
```

---

## Step 4 — Invite editors

In the Keystatic Cloud project dashboard, invite colleagues by email. They'll
receive an invite and can log in at:

```
https://cms.stillgotitcollective.com/keystatic
```

No GitHub account required for editors — Keystatic Cloud handles auth.

---

## Local Development

To run the admin locally (edits files directly on disk):

```bash
cd keystatic
npm install
npm run dev
# → http://localhost:4321/keystatic
```

In local mode Keystatic doesn't use Cloud auth — it runs unauthenticated and
edits files directly. Change `storage.kind` to `'local'` temporarily if needed.

---

## What Gets Edited Where

| Keystatic Sidebar Label | JSON File |
|---|---|
| Site Content | `content/site.json` |
| Latest Updates | `content/updates.json` |
| Events Calendar | `data/events.json` |
| Event Gallery | `content/gallery.json` |
| Merch Catalog | `content/merch.json` |
| About Page | `content/pages/about.json` |
| Contact Page | `content/pages/contact.json` |
| Events Page Settings | `content/pages/events.json` |
| Merch Page Settings | `content/pages/merch.json` |
| Legal Page | `content/pages/legal.json` |

Every save in Keystatic commits directly to `main`, which triggers the GitHub
Pages deploy workflow automatically (30–60 second propagation).

---

## Keeping Decap

The existing Decap admin at `/admin/` still works during the transition. Once
Keystatic is live and editors are comfortable, remove the `/admin/` directory
and the Sveltia auth Worker (`sveltia-cms-auth.rpretzer.workers.dev`).
