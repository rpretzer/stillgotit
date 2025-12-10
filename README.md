# The Still Got It Collective Website

A modern, mobile-first single-page scrolling website for The Still Got It Collective event planning business.

## Features

- **Retro Daylight Design** - 90s-inspired pastel color palette with warm gradients
- **Mobile-First Responsive** - Fully responsive design that works on all devices
- **Smooth Scroll Navigation** - Smooth scrolling between sections
- **Gallery Lightbox** - Interactive image gallery with lightbox modal
- **Event Calendar** - Ready for Google Calendar or Notion embed
- **SEO Optimized** - Complete meta tags and Open Graph support

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

## Setup for GitHub Pages

1. Push this repository to GitHub
2. Go to Settings → Pages
3. Select source branch (usually `main`)
4. The site will be available at `https://YOUR_USERNAME.github.io/stillgotit/`
5. For custom domain, add the CNAME file (already included) and configure DNS

## Customization

### Update Links

- **Eventbrite**: Replace `YOUR_ORGANIZATION_ID` in the tickets section
- **Square Store**: Replace `YOUR_SQUARE_STORE_URL` in the merch section
- **Instagram**: Update Instagram username in all links

### Add Your Calendar

Replace the calendar placeholder in `index.html` with your embed code:

**Google Calendar:**
```html
<iframe src="https://calendar.google.com/calendar/embed?src=YOUR_CALENDAR_ID&ctz=America%2FNew_York" 
        style="border: 0" width="100%" height="600" frameborder="0" scrolling="no"></iframe>
```

**Notion:**
```html
<iframe src="YOUR_NOTION_CALENDAR_EMBED_URL" 
        width="100%" height="600" frameborder="0"></iframe>
```

### Replace Images

- Add your logo to `assets/images/logo.svg` (or update the path in HTML)
- Replace placeholder images in gallery, announcements, and Instagram sections
- Add `og-image.jpg` for social media previews

### Colors

Colors are defined in CSS variables at the top of `assets/css/style.css`. Update these to match your brand:

- `--coral`: #FFAB91
- `--cream`: #FFF8E1
- `--light-teal`: #E1F5FE
- `--sunny-orange`: #FFB74D
- `--mint-tan`: #C5E1A5
- `--soft-peach`: #FFCCBC

## Deployment

This site is ready for GitHub Pages deployment. Just push to the `main` branch and enable Pages in repository settings.

## License

© 2025 RSP Management Solutions LLC. All rights reserved.