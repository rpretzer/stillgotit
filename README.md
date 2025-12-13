# The Still Got It Collective Website

A modern, mobile-first single-page scrolling website for The Still Got It Collective event planning business.

## Features

- **Brand design system** - Centralized color + typography tokens
- **Mobile-First Responsive** - Fully responsive design that works on all devices
- **Smooth Scroll Navigation** - Smooth scrolling between sections
- **Gallery Lightbox** - Interactive image gallery with lightbox modal
- **Event Calendar** - Ready for Google Calendar or Notion embed
- **SEO Optimized** - Complete meta tags and Open Graph support
- **Decap CMS** - Non-technical editing for site content

## File Structure

```
still-got-it-collective/
├── index.html              # Main HTML file
├── CNAME                   # Custom domain configuration
├── favicon.svg             # Site favicon
├── README.md               # This file
└── assets/
    ├── css/
    │   └── style.css       # All styles
    ├── js/
    │   └── scripts.js      # JavaScript functionality
    └── images/
        ├── logo.svg        # Logo (placeholder)
        └── README.md       # Image guidelines
```

## CMS (Decap)

- **Admin UI**: `/admin/`
- **Editable content**:
  - `content/site.json` (hero banner, ticketing link, merch link, Instagram, footer socials, optional calendar embed)
  - `content/updates.json` (Latest Updates cards)
  - `content/gallery.json` (Event Gallery items + metadata)

## Setup for GitHub Pages

1. Push this repository to GitHub
2. Go to Settings → Pages
3. Select source branch (usually `main`)
4. The site will be available at `https://YOUR_USERNAME.github.io/stillgotit/`
5. For custom domain, add the CNAME file (already included) and configure DNS

## Customization

### Update Links

- **Ticketing provider (TicketsCandy, etc.)**: Update the ticketing URL/label in `content/site.json` (via `/admin`)
- **Square Store**: Update the Square Store URL/label in `content/site.json` (via `/admin`)
- **Instagram**: Update Instagram username/profile URL (and optional preview tiles) in `content/site.json` (via `/admin`)

### Add Your Calendar (CMS-controlled)

Set `content/site.json.calendar.embedUrl` (via `/admin`) to your embed URL.

### Repo-based image pipeline (free) — recommended for now

This workflow lets you drop originals into a folder, push, and GitHub Actions generates optimized WebP outputs for the gallery.

- **Drop originals here** (commit these): `assets/images/_incoming_raw/`
- **Generated outputs here** (auto-committed by CI):
  - `assets/images/uploads/gallery/full/` (max width 1600)
  - `assets/images/uploads/gallery/thumb/` (600×600 crop)
  - `assets/images/uploads/gallery/manifest.json` (maps raw → outputs)

**How to use (day-to-day):**
1. Add JPG/PNG/etc into `assets/images/_incoming_raw/`
2. Commit + push
3. Wait for GitHub Actions “Process incoming images” to finish
4. In `/admin/` → **Site Content → Event Gallery**, add an item and select:
   - **Full image upload (fallback)**: pick a file from `assets/images/uploads/gallery/full/`
   - **Thumbnail upload (fallback)**: pick a file from `assets/images/uploads/gallery/thumb/`
   - Add tags/location/date as desired

If you prefer, you can copy/paste the paths from `assets/images/uploads/gallery/manifest.json` into `content/gallery.json` as `src`/`thumb` URLs.

### Replace Images

- Add your logo to `assets/images/logo.svg` (or update the path in HTML)
- Add `og-image.jpg` for social media previews

## Deployment

This site is ready for GitHub Pages deployment. Just push to the `main` branch and enable Pages in repository settings.

## License

© 2025 RSP Management Solutions LLC. All rights reserved.