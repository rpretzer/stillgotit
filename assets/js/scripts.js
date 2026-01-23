/* ========================================
   The Still Got It Collective - JavaScript
   Smooth scroll, fade-ins, lightbox, hamburger menu
   ======================================== */

(function() {
    'use strict';

    /**
     * Adds cache-busting query parameter to local image URLs.
     * Skips external CDN URLs (they handle their own caching).
     * @param {string} url - Image URL to process
     * @returns {string} URL with timestamp query parameter (if local) or original URL (if external)
     */
    function addImageCacheBust(url) {
        if (!url || typeof url !== 'string') return url;
        
        // Relative paths (starting with /) - always cache-bust
        if (url.startsWith('/')) {
            const separator = url.includes('?') ? '&' : '?';
            return url + separator + `t=${Date.now()}`;
        }
        
        // Absolute URLs (http:// or https://)
        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const urlObj = new URL(url);
                // Only cache-bust if it's the same origin (local GitHub Pages)
                if (urlObj.origin === window.location.origin) {
                    const separator = url.includes('?') ? '&' : '?';
                    return url + separator + `t=${Date.now()}`;
                }
                // External CDN (Cloudflare Images, etc.) - don't cache-bust
                // They handle their own caching and versioning
                return url;
            } catch {
                // Invalid URL, return as-is
                return url;
            }
        }
        
        // Relative paths without leading slash - add cache-busting
        const separator = url.includes('?') ? '&' : '?';
        return url + separator + `t=${Date.now()}`;
    }

    /**
     * Loads and renders latest updates from CMS.
     * Source: /content/updates.json (editable via /admin)
     * Respects CMS order (no sorting applied).
     * @returns {Promise<void>}
     */
    async function loadLatestUpdates() {
        const grid = document.getElementById('announcements-grid');
        if (!grid) return;

        const source = grid.dataset.updatesSource || 'content/updates.json';
        const url = new URL(source, window.location.href);

        try {
            // Add cache-busting to ensure fresh content
            const fetchUrl = url.toString() + (url.toString().includes('?') ? '&' : '?') + `t=${Date.now()}`;
            const res = await fetch(fetchUrl, { 
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            if (!res.ok) throw new Error(`Failed to load updates.json (${res.status})`);
            const data = await res.json();
            if (!data || !Array.isArray(data.updates)) throw new Error('Invalid updates.json format');

            // Use updates in CMS order (no sorting - respect editor's arrangement)
            const updates = data.updates;

            // Clear fallback HTML once CMS content is ready
            grid.innerHTML = '';

            const fmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

            updates.forEach((u) => {
                const card = document.createElement('article');
                card.className = 'announcement-card fade-in';

                const updateImgSrc = u?.image || u?.imageUpload;
                if (updateImgSrc) {
                    const media = document.createElement('div');
                    media.className = 'card-image';
                    const img = document.createElement('img');
                    img.loading = 'lazy';
                    img.src = addImageCacheBust(updateImgSrc);
                    img.alt = u.alt || u.title || 'Update image';
                    media.appendChild(img);
                    card.appendChild(media);
                }

                const content = document.createElement('div');
                content.className = 'card-content';

                const h3 = document.createElement('h3');
                h3.textContent = u?.title || 'Update';
                content.appendChild(h3);

                const dateP = document.createElement('p');
                dateP.className = 'card-date';
                if (u?.date) {
                    let d;
                    // Check if date matches YYYY-MM-DD format
                    if (typeof u.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(u.date)) {
                        const parts = u.date.split('-');
                        // Create date in local time
                        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                    } else {
                        d = new Date(u.date);
                    }
                    
                    if (!Number.isNaN(d.getTime())) {
                        dateP.textContent = fmt.format(d);
                    } else {
                        dateP.textContent = '';
                    }
                } else {
                    dateP.textContent = '';
                }
                content.appendChild(dateP);

                const bodyP = document.createElement('p');
                bodyP.textContent = u?.body || '';
                content.appendChild(bodyP);

                if (u?.ctaUrl && u?.ctaLabel) {
                    const a = document.createElement('a');
                    const style = (u?.ctaStyle || 'primary').toLowerCase() === 'secondary' ? 'secondary' : 'primary';
                    a.className = `btn btn-${style}`;
                    a.href = u.ctaUrl;
                    a.textContent = u.ctaLabel;
                    content.appendChild(a);
                }

                card.appendChild(content);
                grid.appendChild(card);
            });

            // Observe newly injected fade-ins
            if (typeof window.__observeFadeIns === 'function') {
                window.__observeFadeIns(grid);
            }
        } catch (err) {
            // Keep fallback HTML in place if loading fails
            console.error('Latest updates load failed:', err);
            console.error('Failed URL:', url.toString());
        }
    }

    /**
     * Loads and hydrates static page content from CMS (About, Contact, Legal, Merch pages).
     * Dynamically injects content from JSON files so editors can update via Decap CMS.
     * @returns {Promise<void>}
     */
    async function loadPageContent() {
        const pageSlug = document.body?.dataset?.page;
        if (!pageSlug) return;

        const source = document.body.dataset.pageSource || `content/pages/${pageSlug}.json`;
        const url = new URL(source, window.location.href);

        const grid = document.getElementById('page-content-grid');
        const heroTitle = document.querySelector('main .section-title');
        const heroSubtitle = document.querySelector('main .section-subtitle');

        try {
            // Add cache-busting query parameter to ensure fresh content
            const cacheBuster = `?t=${Date.now()}`;
            const fetchUrl = url.toString() + (url.toString().includes('?') ? '&' : '?') + `t=${Date.now()}`;
            const res = await fetch(fetchUrl, { 
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            if (!res.ok) throw new Error(`Failed to load page content (${res.status})`);
            const data = await res.json();

            // Meta + canonicals (override site defaults)
            if (data?.metaTitle) {
                document.title = data.metaTitle;
            }
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc && data?.metaDescription) {
                metaDesc.setAttribute('content', data.metaDescription);
            }
            const canonical = document.querySelector('link[rel="canonical"]');
            if (canonical && data?.canonicalUrl) {
                canonical.setAttribute('href', data.canonicalUrl);
            }

            // Hero copy
            if (heroTitle && data?.heroTitle) {
                heroTitle.textContent = data.heroTitle;
            }
            if (heroSubtitle && typeof data?.heroSubtitle === 'string') {
                heroSubtitle.textContent = data.heroSubtitle;
            }

            // Merch page specific content (if this is the merch page)
            // NOTE: CMS only manages static UI labels. It does NOT touch:
            // - Product catalog data (loaded from /content/merch.json by merch.js)
            // - Cart totals (calculated dynamically by merch.js)
            // - Product prices, names, or descriptions (from catalog JSON)
            // - Stripe payment elements (rendered by Stripe SDK)
            if (pageSlug === 'merch') {
                const merchHeroTitle = document.getElementById('merch-hero-title');
                if (merchHeroTitle && data?.heroTitle) merchHeroTitle.textContent = data.heroTitle;
                const merchHeroSubtitle = document.getElementById('merch-hero-subtitle');
                if (merchHeroSubtitle && data?.heroSubtitle) merchHeroSubtitle.textContent = data.heroSubtitle;
                const merchCatalogLabel = document.getElementById('merch-catalog-label');
                if (merchCatalogLabel && data?.catalogLabel) merchCatalogLabel.textContent = data.catalogLabel;
                const merchLoadingTitle = document.getElementById('merch-loading-title');
                if (merchLoadingTitle && data?.loadingMessage) merchLoadingTitle.textContent = data.loadingMessage;
                const merchLoadingSubtext = document.getElementById('merch-loading-subtext');
                if (merchLoadingSubtext && data?.loadingSubtext) merchLoadingSubtext.textContent = data.loadingSubtext;
                const merchCartTitle = document.getElementById('merch-cart-title');
                if (merchCartTitle && data?.cartTitle) merchCartTitle.textContent = data.cartTitle;
                const merchCartClose = document.getElementById('close-cart');
                if (merchCartClose && data?.cartCloseLabel) merchCartClose.textContent = data.cartCloseLabel;
                // Only update the label, NOT the cart-subtotal value (which is calculated dynamically)
                const merchSubtotalLabel = document.getElementById('merch-subtotal-label');
                if (merchSubtotalLabel && data?.subtotalLabel) merchSubtotalLabel.textContent = data.subtotalLabel;
                const merchShippingNote = document.getElementById('merch-shipping-note');
                if (merchShippingNote && data?.shippingNote) merchShippingNote.textContent = data.shippingNote;
                const merchCheckout = document.getElementById('checkout');
                if (merchCheckout && data?.checkoutLabel) merchCheckout.textContent = data.checkoutLabel;
                const merchClearCart = document.getElementById('clear-cart');
                if (merchClearCart && data?.clearCartLabel) merchClearCart.textContent = data.clearCartLabel;
                // Error message is only set here as fallback; merch.js will override if there's an actual error
                const merchError = document.getElementById('merch-error');
                if (merchError && data?.errorMessage && merchError.hidden) {
                    // Only set if error is hidden (not currently showing a dynamic error)
                    merchError.textContent = data.errorMessage;
                }
            }

            // Section content
            if (grid && Array.isArray(data?.sections)) {
                grid.innerHTML = '';
                data.sections.forEach((section) => {
                    if (!section?.title) return;

                    const block = document.createElement('div');
                    block.className = 'content-block';

                    const h2 = document.createElement('h2');
                    h2.textContent = section.title;
                    block.appendChild(h2);

                    if (Array.isArray(section.body)) {
                        section.body.forEach((paragraph) => {
                            // Handle both string format (legacy) and object format (CMS)
                            const text = typeof paragraph === 'string' 
                                ? paragraph 
                                : (paragraph?.paragraph || paragraph?.text || '');
                            if (!text) return;
                            const p = document.createElement('p');
                            p.innerHTML = text;
                            block.appendChild(p);
                        });
                    }

                    if (Array.isArray(section.contacts)) {
                        section.contacts.forEach((contact) => {
                            if (!contact?.label && !contact?.value) return;
                            const p = document.createElement('p');
                            if (contact?.label) {
                                const strong = document.createElement('strong');
                                strong.textContent = `${contact.label}:`;
                                p.appendChild(strong);
                                p.appendChild(document.createTextNode(' '));
                            }
                            if (contact?.url) {
                                const a = document.createElement('a');
                                a.href = contact.url;
                                a.textContent = contact.value || contact.url;
                                if (/^https?:\/\//i.test(contact.url)) {
                                    a.target = '_blank';
                                    a.rel = 'noopener noreferrer';
                                }
                                p.appendChild(a);
                            } else if (contact?.value) {
                                p.appendChild(document.createTextNode(contact.value));
                            }
                            block.appendChild(p);
                        });
                    }

                    grid.appendChild(block);
                });

                if (typeof window.__observeFadeIns === 'function') {
                    window.__observeFadeIns(grid);
                }
            }
        } catch (err) {
            // Keep fallback HTML if loading fails
            console.error('Page content load failed:', err);
            console.error('Failed URL:', url.toString());
            // Log error but don't throw - fallback HTML will remain visible
        }
    }

    // ===== JSON-LD helper =====
    function injectJsonLd(id, data) {
        try {
            if (!data) return;
            const existing = document.getElementById(id);
            if (existing && existing.parentNode) {
                existing.parentNode.removeChild(existing);
            }
            const script = document.createElement('script');
            script.type = 'application/ld+json';
            script.id = id;
            script.textContent = JSON.stringify(data);
            document.head.appendChild(script);
        } catch (e) {
            console.warn('Failed to inject JSON-LD', e);
        }
    }

    /**
     * Loads site-wide settings from CMS and applies them to the page.
     * Source: /content/site.json
     * Handles hero content, Instagram previews, tickets/merch cards, checkout/success page labels.
     * @returns {Promise<void>}
     */
    async function loadSiteSettings() {
        const url = new URL('content/site.json', window.location.href);
        try {
            // Add cache-busting to ensure fresh content
            const fetchUrl = url.toString() + (url.toString().includes('?') ? '&' : '?') + `t=${Date.now()}`;
            const res = await fetch(fetchUrl, { 
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            if (!res.ok) throw new Error(`Failed to load site.json (${res.status})`);
            const settings = await res.json();
            const hasPageSlug = !!document.body?.dataset?.page;

            // Meta tags (only on main index.html)
            if (!hasPageSlug && document.querySelector('meta[name="description"]')) {
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc && settings?.meta?.description) metaDesc.setAttribute('content', settings.meta.description);
                const metaKeywords = document.querySelector('meta[name="keywords"]');
                if (metaKeywords && settings?.meta?.keywords) metaKeywords.setAttribute('content', settings.meta.keywords);
                const ogTitle = document.querySelector('meta[property="og:title"]');
                if (ogTitle && settings?.meta?.siteName) ogTitle.setAttribute('content', `${settings.meta.siteName} - ${settings.meta.tagline || ''}`);
                const ogDesc = document.querySelector('meta[property="og:description"]');
                if (ogDesc && settings?.meta?.description) ogDesc.setAttribute('content', settings.meta.description);
                const ogImage = document.querySelector('meta[property="og:image"]');
                if (ogImage && settings?.meta?.ogImage) ogImage.setAttribute('content', settings.meta.ogImage);
                const ogUrl = document.querySelector('meta[property="og:url"]');
                if (ogUrl && settings?.meta?.ogUrl) ogUrl.setAttribute('content', settings.meta.ogUrl);
                const twitterTitle = document.querySelector('meta[name="twitter:title"]');
                if (twitterTitle && settings?.meta?.siteName) twitterTitle.setAttribute('content', `${settings.meta.siteName} - ${settings.meta.tagline || ''}`);
                const twitterDesc = document.querySelector('meta[name="twitter:description"]');
                if (twitterDesc && settings?.meta?.description) twitterDesc.setAttribute('content', settings.meta.description);
                const twitterImage = document.querySelector('meta[name="twitter:image"]');
                if (twitterImage && settings?.meta?.ogImage) twitterImage.setAttribute('content', settings.meta.ogImage);

                // Structured data: Organization + WebSite
                const siteUrl = settings?.meta?.ogUrl || window.location.origin;
                const orgSameAs = [];
                if (settings?.instagram?.profileUrl) {
                    orgSameAs.push(settings.instagram.profileUrl);
                }
                if (Array.isArray(settings?.footer?.socialLinks)) {
                    settings.footer.socialLinks.forEach((s) => {
                        if (s?.url) orgSameAs.push(s.url);
                    });
                }

                const orgLd = {
                    '@type': 'Organization',
                    name: settings?.meta?.siteName || 'The Still Got It Collective',
                    url: siteUrl,
                    logo: settings?.meta?.ogImage || undefined,
                    description: settings?.meta?.description || undefined,
                    sameAs: orgSameAs.length ? orgSameAs : undefined
                };

                const websiteLd = {
                    '@type': 'WebSite',
                    name: settings?.meta?.siteName || 'The Still Got It Collective',
                    url: siteUrl
                };

                injectJsonLd('sgic-ld-site', {
                    '@context': 'https://schema.org',
                    '@graph': [orgLd, websiteLd]
                });

                // Structured data: Events (if calendar is present)
                if (document.getElementById('events-grid')) {
                    try {
                        const eventsUrl = new URL('data/events.json', window.location.href);
                        fetch(eventsUrl.toString(), { cache: 'no-store' })
                            .then((r) => r.ok ? r.json() : null)
                            .then((events) => {
                                if (!Array.isArray(events) || !events.length) return;
                                const graph = events.map((ev) => {
                                    const imgUrl = ev.image ? new URL(ev.image, siteUrl).toString() : undefined;
                                    return {
                                        '@type': 'Event',
                                        name: ev.title,
                                        startDate: ev.date, // ISO date (YYYY-MM-DD)
                                        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                                        eventStatus: 'https://schema.org/EventScheduled',
                                        location: {
                                            '@type': 'Place',
                                            name: ev.location || ev.venue || 'Event venue',
                                            address: {
                                                '@type': 'PostalAddress',
                                                addressLocality: ev.venue || 'Cleveland',
                                                addressRegion: 'OH',
                                                addressCountry: 'US'
                                            }
                                        },
                                        image: imgUrl,
                                        description: ev.description,
                                        organizer: {
                                            '@type': 'Organization',
                                            name: settings?.meta?.siteName || 'The Still Got It Collective',
                                            url: siteUrl
                                        },
                                        offers: ev.ticketUrl ? {
                                            '@type': 'Offer',
                                            url: ev.ticketUrl,
                                            availability: 'https://schema.org/InStock'
                                        } : undefined
                                    };
                                });

                                injectJsonLd('sgic-ld-events', {
                                    '@context': 'https://schema.org',
                                    '@graph': graph
                                });
                            })
                            .catch((err) => {
                                console.warn('Failed to load events for JSON-LD', err);
                            });
                    } catch (err) {
                        console.warn('Events JSON-LD setup failed', err);
                    }
                }
            }

            // Page title
            if (!hasPageSlug && settings?.meta?.siteName && document.title && !document.title.includes('Merch') && !document.title.includes('Checkout') && !document.title.includes('Order')) {
                document.title = `${settings.meta.siteName} - ${settings.meta.tagline || ''}`;
            }

            // Hero section
            const heroTitle = document.querySelector('.hero-title');
            if (heroTitle && settings?.hero?.title) heroTitle.textContent = settings.hero.title;
            const heroTagline = document.getElementById('hero-tagline');
            if (heroTagline && settings?.hero?.tagline) heroTagline.textContent = settings.hero.tagline;
            const heroCtaPrimary = document.getElementById('hero-cta-primary');
            if (heroCtaPrimary) {
                if (settings?.hero?.ctaPrimaryLabel) heroCtaPrimary.textContent = settings.hero.ctaPrimaryLabel;
                if (settings?.hero?.ctaPrimaryUrl) heroCtaPrimary.href = settings.hero.ctaPrimaryUrl;
            }
            const heroCtaSecondary = document.getElementById('hero-cta-secondary');
            if (heroCtaSecondary) {
                if (settings?.hero?.ctaSecondaryLabel) heroCtaSecondary.textContent = settings.hero.ctaSecondaryLabel;
                if (settings?.hero?.ctaSecondaryUrl) heroCtaSecondary.href = settings.hero.ctaSecondaryUrl;
            }

            // Hero background image (CMS override)
            const heroBg = document.querySelector('.hero-background.hero-background-img');
            const heroImgUrl = settings?.hero?.imageUrl;
            if (heroBg && heroImgUrl && typeof heroImgUrl === 'string' && heroImgUrl.trim().length > 0) {
                const cachedHeroUrl = addImageCacheBust(heroImgUrl.trim());
                heroBg.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url("${cachedHeroUrl}")`;
                heroBg.style.backgroundSize = 'cover';
                heroBg.style.backgroundPosition = 'center';
            }

            // Section titles
            const announcementsTitle = document.querySelector('#announcements .section-title');
            if (announcementsTitle && settings?.sections?.announcements?.title) announcementsTitle.textContent = settings.sections.announcements.title;
            const eventsTitle = document.querySelector('#upcoming-events .section-title, #calendar .section-title');
            if (eventsTitle && settings?.sections?.events?.title) eventsTitle.textContent = settings.sections.events.title;
            const eventsEmpty = document.getElementById('events-empty');
            if (eventsEmpty && settings?.sections?.events?.emptyMessage) eventsEmpty.textContent = settings.sections.events.emptyMessage;
            const galleryTitle = document.querySelector('#gallery .section-title');
            if (galleryTitle && settings?.sections?.gallery?.title) galleryTitle.textContent = settings.sections.gallery.title;
            const ticketsSectionTitle = document.querySelector('#tickets .section-title');
            if (ticketsSectionTitle && settings?.sections?.tickets?.title) ticketsSectionTitle.textContent = settings.sections.tickets.title;
            const instagramTitle = document.querySelector('#instagram .section-title');
            if (instagramTitle && settings?.sections?.instagram?.title) instagramTitle.textContent = settings.sections.instagram.title;
            const instagramSubtitle = document.querySelector('#instagram .section-subtitle');
            if (instagramSubtitle && settings?.sections?.instagram?.subtitle && settings?.instagram?.username) {
                instagramSubtitle.innerHTML = settings.sections.instagram.subtitle.replace('{handle}', `<a data-instagram-profile href="${settings.instagram.profileUrl || '#'}" target="_blank" rel="noopener noreferrer" class="instagram-link"><span id="instagram-handle">@${settings.instagram.username}</span></a>`);
            }

            // Banner
            const emojiEl = document.getElementById('banner-emoji');
            const strongEl = document.getElementById('banner-strong');
            const textEl = document.getElementById('banner-text');
            const linkEl = document.getElementById('banner-link');
            if (emojiEl && typeof settings?.banner?.emoji === 'string') emojiEl.textContent = settings.banner.emoji;
            if (strongEl && settings?.banner?.strongText) strongEl.textContent = settings.banner.strongText;
            if (textEl && settings?.banner?.text) textEl.textContent = ` ${settings.banner.text} `;
            if (linkEl && settings?.banner?.ctaUrl) linkEl.href = settings.banner.ctaUrl;
            if (linkEl && settings?.banner?.ctaLabel) linkEl.textContent = settings.banner.ctaLabel;

            // Tickets
            const ticketsLink = document.getElementById('tickets-link');
            const ticketsLabel = document.getElementById('tickets-label');
            if (ticketsLink && settings?.tickets?.ticketsUrl) ticketsLink.href = settings.tickets.ticketsUrl;
            if (ticketsLabel && settings?.tickets?.ticketsLabel) ticketsLabel.textContent = settings.tickets.ticketsLabel;

            const ticketsTitle = document.getElementById('tickets-buy-title');
            const ticketsBody = document.getElementById('tickets-buy-body');
            const ticketsNote = document.getElementById('tickets-buy-note');
            if (ticketsTitle && settings?.tickets?.ticketsTitle) ticketsTitle.textContent = settings.tickets.ticketsTitle;
            if (ticketsBody && settings?.tickets?.ticketsBody) ticketsBody.textContent = settings.tickets.ticketsBody;
            if (ticketsNote && typeof settings?.tickets?.ticketsNote === 'string') ticketsNote.textContent = settings.tickets.ticketsNote;

            const sqLink = document.getElementById('square-link');
            const sqLabel = document.getElementById('square-label');
            if (sqLink && settings?.tickets?.squareUrl) sqLink.href = settings.tickets.squareUrl;
            if (sqLabel && settings?.tickets?.squareLabel) sqLabel.textContent = settings.tickets.squareLabel;

            // If a link is internal (relative path or hash), don't force a new tab.
            // (index.html sets target=_blank by default for external links)
            function normalizeLinkTarget(a) {
                if (!a || !a.href) return;
                const href = a.getAttribute('href') || '';
                const isInternal = href.startsWith('/') || href.startsWith('#');
                if (isInternal) {
                    a.removeAttribute('target');
                    a.removeAttribute('rel');
                } else {
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                }
            }
            normalizeLinkTarget(ticketsLink);
            normalizeLinkTarget(sqLink);

            const sqTitle = document.getElementById('tickets-merch-title');
            const sqBody = document.getElementById('tickets-merch-body');
            const sqNote = document.getElementById('tickets-merch-note');
            if (sqTitle && settings?.tickets?.squareTitle) sqTitle.textContent = settings.tickets.squareTitle;
            if (sqBody && settings?.tickets?.squareBody) sqBody.textContent = settings.tickets.squareBody;
            if (sqNote && typeof settings?.tickets?.squareNote === 'string') sqNote.textContent = settings.tickets.squareNote;

            // Instagram
            const igHandle = document.getElementById('instagram-handle');
            if (igHandle && settings?.instagram?.username) igHandle.textContent = `@${settings.instagram.username}`;

            const igProfileUrl = settings?.instagram?.profileUrl;
            if (igProfileUrl) {
                document.querySelectorAll('a[data-instagram-profile]').forEach((a) => {
                    a.href = igProfileUrl;
                });
            }

            // Instagram preview tiles (optional)
            const igGrid = document.getElementById('instagram-grid');
            if (igGrid && Array.isArray(settings?.instagram?.previews) && settings.instagram.previews.length > 0) {
                igGrid.innerHTML = '';
                settings.instagram.previews.forEach((p, idx) => {
                    if (!p?.image) return;
                    const a = document.createElement('a');
                    a.className = 'instagram-tile';
                    a.setAttribute('data-instagram-profile', '');
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.href = igProfileUrl || '#';

                    const img = document.createElement('img');
                    img.loading = 'lazy';
                    img.src = addImageCacheBust(p.image);
                    img.alt = p.alt || `Instagram preview ${idx + 1}`;
                    a.appendChild(img);
                    igGrid.appendChild(a);
                });
            }

            // Footer
            const footerOrgName = document.querySelector('.footer-section h4');
            if (footerOrgName && settings?.footer?.organizationName) {
                const firstH4 = document.querySelector('.footer-section:first-child h4');
                if (firstH4) firstH4.textContent = settings.footer.organizationName;
            }
            const footerTagline = document.querySelector('.footer-section:first-child p');
            if (footerTagline && settings?.footer?.tagline) footerTagline.textContent = settings.footer.tagline;
            const footerCopyright = document.querySelector('.footer-bottom p');
            if (footerCopyright && settings?.footer?.copyright) footerCopyright.textContent = settings.footer.copyright;
            const quickLinksTitle = document.querySelector('.footer-section:nth-child(2) h4');
            if (quickLinksTitle && settings?.footer?.quickLinksTitle) quickLinksTitle.textContent = settings.footer.quickLinksTitle;
            const connectTitle = document.querySelector('.footer-section:nth-child(3) h4');
            if (connectTitle && settings?.footer?.connectTitle) connectTitle.textContent = settings.footer.connectTitle;

            // Footer social links (optional)
            const footerLinks = document.getElementById('footer-social-links');
            if (footerLinks && Array.isArray(settings?.footer?.socialLinks) && settings.footer.socialLinks.length > 0) {
                footerLinks.innerHTML = '';
                settings.footer.socialLinks.forEach((s) => {
                    if (!s?.label || !s?.url) return;
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.textContent = s.label;
                    a.href = s.url;
                    a.setAttribute('aria-label', s.label);
                    if (/^https?:\/\//i.test(s.url)) {
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                    }
                    li.appendChild(a);
                    footerLinks.appendChild(li);
                });
            }

            // Calendar embed (optional)
            const embedUrl = settings?.calendar?.embedUrl;
            const placeholder = document.getElementById('calendar-placeholder');
            const wrapper = document.getElementById('calendar-wrapper');
            if (wrapper && placeholder && typeof embedUrl === 'string' && embedUrl.trim().length > 0) {
                const iframe = document.createElement('iframe');
                iframe.src = embedUrl.trim();
                iframe.title = 'Event Calendar';
                iframe.loading = 'lazy';
                iframe.referrerPolicy = 'no-referrer-when-downgrade';
                wrapper.replaceChild(iframe, placeholder);
            }

            // Merch page copy (skip if page is CMS-managed via loadPageContent)
            if (document.querySelector('.merch-hero') && !document.body?.dataset?.page) {
                const merchHeroTitle = document.getElementById('merch-hero-title');
                if (merchHeroTitle && settings?.merch?.heroTitle) merchHeroTitle.textContent = settings.merch.heroTitle;
                const merchHeroSubtitle = document.getElementById('merch-hero-subtitle');
                if (merchHeroSubtitle && settings?.merch?.heroSubtitle) merchHeroSubtitle.textContent = settings.merch.heroSubtitle;
                const merchCatalogLabel = document.getElementById('merch-catalog-label');
                if (merchCatalogLabel && settings?.merch?.catalogLabel) merchCatalogLabel.textContent = settings.merch.catalogLabel;
                const merchCartTitle = document.getElementById('merch-cart-title');
                if (merchCartTitle && settings?.merch?.cartTitle) merchCartTitle.textContent = settings.merch.cartTitle;
                const merchCartClose = document.getElementById('close-cart');
                if (merchCartClose && settings?.merch?.cartCloseLabel) merchCartClose.textContent = settings.merch.cartCloseLabel;
                const merchSubtotalLabel = document.getElementById('merch-subtotal-label');
                if (merchSubtotalLabel && settings?.merch?.subtotalLabel) merchSubtotalLabel.textContent = settings.merch.subtotalLabel;
                const merchShippingNote = document.getElementById('merch-shipping-note');
                if (merchShippingNote && settings?.merch?.shippingNote) merchShippingNote.textContent = settings.merch.shippingNote;
                const merchCheckout = document.getElementById('checkout');
                if (merchCheckout && settings?.merch?.checkoutLabel) merchCheckout.textContent = settings.merch.checkoutLabel;
                const merchClearCart = document.getElementById('clear-cart');
                if (merchClearCart && settings?.merch?.clearCartLabel) merchClearCart.textContent = settings.merch.clearCartLabel;
                const merchLoadingTitle = document.getElementById('merch-loading-title');
                if (merchLoadingTitle && settings?.merch?.loadingMessage) merchLoadingTitle.textContent = settings.merch.loadingMessage;
                const merchLoadingSubtext = document.getElementById('merch-loading-subtext');
                if (merchLoadingSubtext && settings?.merch?.loadingSubtext) merchLoadingSubtext.textContent = settings.merch.loadingSubtext;
                
                // Update page title and meta
                if (settings?.merch?.pageTitle) document.title = settings.merch.pageTitle;
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc && settings?.merch?.pageDescription) metaDesc.setAttribute('content', settings.merch.pageDescription);
            }

            // Checkout page copy
            // NOTE: CMS only manages static UI labels. It does NOT touch:
            // - Stripe Payment Element (#payment-element - rendered by Stripe SDK)
            // - Payment amounts or totals (calculated from cart by checkout.js)
            // - Form field values (user input or Stripe-managed)
            // - Order processing state (managed by checkout.js and Stripe)
            if (document.querySelector('.checkout-page')) {
                const checkoutTitle = document.getElementById('checkout-title');
                if (checkoutTitle && settings?.checkout?.title) checkoutTitle.textContent = settings.checkout.title;
                const shippingTitle = document.getElementById('shipping-title');
                if (shippingTitle && settings?.checkout?.shippingTitle) shippingTitle.textContent = settings.checkout.shippingTitle;
                const paymentTitle = document.getElementById('payment-title');
                if (paymentTitle && settings?.checkout?.paymentTitle) paymentTitle.textContent = settings.checkout.paymentTitle;
                const continueBtn = document.getElementById('continue-to-payment');
                if (continueBtn && settings?.checkout?.continueLabel) continueBtn.textContent = settings.checkout.continueLabel;
                const backBtn = document.getElementById('back-to-shipping');
                if (backBtn && settings?.checkout?.backLabel) backBtn.textContent = settings.checkout.backLabel;
                const payBtn = document.getElementById('submit-payment');
                if (payBtn && settings?.checkout?.payNowLabel) payBtn.textContent = settings.checkout.payNowLabel;
                const processingText = document.getElementById('processing-text');
                if (processingText && settings?.checkout?.processingLabel) processingText.textContent = settings.checkout.processingLabel;
                
                // Update page title and meta
                if (settings?.checkout?.pageTitle) document.title = settings.checkout.pageTitle;
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc && settings?.checkout?.pageDescription) metaDesc.setAttribute('content', settings.checkout.pageDescription);
            }

            // Success page copy
            if (document.querySelector('.merch-main') && document.getElementById('order-details')) {
                const successTitle = document.getElementById('success-title');
                if (successTitle && settings?.success?.title) successTitle.textContent = settings.success.title;
                const successMessage = document.getElementById('success-message');
                if (successMessage && settings?.success?.message) successMessage.textContent = settings.success.message;
                const successNote = document.getElementById('order-note');
                if (successNote && settings?.success?.note) successNote.textContent = settings.success.note;
                const backToMerch = document.getElementById('back-to-merch');
                if (backToMerch && settings?.success?.backToMerchLabel) backToMerch.textContent = settings.success.backToMerchLabel;
                const backToSite = document.getElementById('back-to-site');
                if (backToSite && settings?.success?.backToSiteLabel) backToSite.textContent = settings.success.backToSiteLabel;
                
                // Update page title
                if (settings?.success?.pageTitle) document.title = settings.success.pageTitle;
            }
        } catch (err) {
            console.error('Site settings load failed:', err);
            console.error('Failed URL:', url.toString());
        }
    }

    // ===== Mobile Hamburger Menu =====
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', !isExpanded);
        });

        // Close menu when clicking on a nav link
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            const isClickInside = navMenu.contains(event.target) || hamburger.contains(event.target);
            if (!isClickInside && navMenu.classList.contains('active')) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                hamburger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // ===== Smooth Scroll Navigation =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip if it's just "#"
            if (href === '#') return;
            
            const target = document.querySelector(href);
            
            if (target) {
                e.preventDefault();
                
                // Calculate offset for fixed navbar
                const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 0;
                const targetPosition = target.offsetTop - navbarHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ===== Scroll-triggered Fade-ins =====
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const fadeInObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optionally unobserve after animation to improve performance
                fadeInObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    function observeFadeIns(root = document) {
        root.querySelectorAll('.fade-in:not(.visible)').forEach(el => {
            fadeInObserver.observe(el);
        });
    }

    // Expose for dynamic content (e.g., CMS updates render)
    window.__observeFadeIns = observeFadeIns;

    // Observe all elements with fade-in class
    observeFadeIns(document);

    // ===== Navbar Scroll Effect =====
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        
        if (navbar) {
            if (currentScroll > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
        
        lastScroll = currentScroll;
    });

    /**
     * Loads and renders gallery images from CMS with pagination.
     * Source: /content/gallery.json (editable via /admin)
     * Supports both repo uploads (Decap) and external CDN/DAM URLs.
     * @returns {Promise<void>}
     */
    async function loadGallery() {
        const grid = document.getElementById('gallery-grid');
        if (!grid) return;

        const source = grid.dataset.gallerySource || 'content/gallery.json';
        const url = new URL(source, window.location.href);

        try {
            // Add cache-busting to ensure fresh content
            const fetchUrl = url.toString() + (url.toString().includes('?') ? '&' : '?') + `t=${Date.now()}`;
            const res = await fetch(fetchUrl, { 
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            if (!res.ok) throw new Error(`Failed to load gallery.json (${res.status})`);
            const data = await res.json();
            if (!data || !Array.isArray(data.images)) throw new Error('Invalid gallery.json format');

            const items = [...data.images].sort((a, b) => {
                const af = a?.featured ? 1 : 0;
                const bf = b?.featured ? 1 : 0;
                return bf - af;
            });

            // Pagination
            const state = {
                items,
                page: 1,
                pageSize: 12
            };

            const prevEl = document.getElementById('gallery-prev');
            const nextEl = document.getElementById('gallery-next');

            // Clear fallback HTML once CMS content is ready
            grid.innerHTML = '';

            function renderPage() {
                const total = state.items.length;
                const pages = Math.max(1, Math.ceil(total / state.pageSize));
                state.page = Math.min(Math.max(1, state.page), pages);
                const start = (state.page - 1) * state.pageSize;
                const slice = state.items.slice(start, start + state.pageSize);

                grid.innerHTML = '';
                slice.forEach((img, idx) => {
                    const fullSrc = img?.src || img?.srcUpload;
                    if (!fullSrc) return;
                    const cell = document.createElement('div');
                    cell.className = 'gallery-item';
                    cell.dataset.galleryIndex = String(start + idx);

                    const el = document.createElement('img');
                    el.loading = 'lazy';
                    const thumbSrc = img?.thumb || img?.thumbUpload || fullSrc;
                    el.src = addImageCacheBust(thumbSrc);
                    el.alt = img.alt || `Gallery image ${start + idx + 1}`;
                    el.dataset.fullSrc = addImageCacheBust(fullSrc);
                    cell.appendChild(el);
                    grid.appendChild(cell);
                });

                if (prevEl) prevEl.disabled = state.page <= 1;
                if (nextEl) nextEl.disabled = state.page >= pages;

                if (typeof window.__observeFadeIns === 'function') {
                    window.__observeFadeIns(grid);
                }
            }

            if (prevEl) prevEl.addEventListener('click', () => { state.page -= 1; renderPage(); });
            if (nextEl) nextEl.addEventListener('click', () => { state.page += 1; renderPage(); });

            // Initial render
            renderPage();
        } catch (err) {
            console.error('Gallery load failed:', err);
            console.error('Failed URL:', url.toString());
        }
    }

    function getGalleryImagesFromDOM() {
        const grid = document.getElementById('gallery-grid');
        if (!grid) return [];
        return Array.from(grid.querySelectorAll('.gallery-item img')).map((img) => ({
            src: img.dataset.fullSrc || img.src,
            alt: img.alt || 'Gallery image'
        }));
    }

    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    const lightboxCounter = document.getElementById('lightbox-counter');

    let currentImageIndex = 0;

    function openLightboxAt(index) {
        const images = getGalleryImagesFromDOM();
        if (!images.length) return;
        currentImageIndex = Math.max(0, Math.min(index, images.length - 1));
        openLightbox(images);
    }

    function openLightbox(images) {
        if (!lightbox || !lightboxImage) return;
        updateLightboxImage(images);
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        if (lightboxCounter) {
            lightboxCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
        }
    }

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    function updateLightboxImage(images) {
        if (!lightboxImage || !images[currentImageIndex]) return;
        lightboxImage.src = images[currentImageIndex].src;
        lightboxImage.alt = images[currentImageIndex].alt;
    }

    function showPrevImage() {
        const images = getGalleryImagesFromDOM();
        if (!images.length) return;
        currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
        updateLightboxImage(images);
        if (lightboxCounter) lightboxCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
    }

    function showNextImage() {
        const images = getGalleryImagesFromDOM();
        if (!images.length) return;
        currentImageIndex = (currentImageIndex + 1) % images.length;
        updateLightboxImage(images);
        if (lightboxCounter) lightboxCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
    }

    // Delegated click handler so dynamically-rendered items work
    const galleryGrid = document.getElementById('gallery-grid');
    if (galleryGrid) {
        galleryGrid.addEventListener('click', (e) => {
            const item = e.target?.closest?.('.gallery-item');
            if (!item) return;
            const imgs = Array.from(galleryGrid.querySelectorAll('.gallery-item'));
            const idx = imgs.indexOf(item);
            if (idx >= 0) openLightboxAt(idx);
        });
    }

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightbox) {
        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox) closeLightbox();
        });
    }
    document.addEventListener('keydown', function(e) {
        if (!lightbox || !lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') showPrevImage();
        if (e.key === 'ArrowRight') showNextImage();
    });
    if (lightboxPrev) lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); showPrevImage(); });
    if (lightboxNext) lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); showNextImage(); });

    // ===== Back to Top Button =====
    const backToTop = document.getElementById('back-to-top');
    
    window.addEventListener('scroll', function() {
        if (backToTop) {
            if (window.pageYOffset > 300) {
                backToTop.style.opacity = '1';
                backToTop.style.visibility = 'visible';
            } else {
                backToTop.style.opacity = '0';
                backToTop.style.visibility = 'hidden';
            }
        }
    });

    // Initially hide back to top button
    if (backToTop) {
        backToTop.style.opacity = '0';
        backToTop.style.visibility = 'hidden';
        backToTop.style.transition = 'opacity 0.3s, visibility 0.3s';
    }

    // ===== Parallax Effect for Hero (Subtle) =====
    const hero = document.getElementById('hero');
    const heroBackground = document.querySelector('.hero-background');
    
    if (heroBackground) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const heroHeight = hero?.offsetHeight || 0;
            
            if (scrolled < heroHeight) {
                const parallaxSpeed = 0.5;
                heroBackground.style.transform = `translateY(${scrolled * parallaxSpeed}px)`;
            }
        });
    }

    // ===== Image Lazy Loading Enhancement =====
    if ('loading' in HTMLImageElement.prototype) {
        // Browser supports native lazy loading
        const images = document.querySelectorAll('img[loading="lazy"]');
        images.forEach(img => {
            img.src = img.src; // Trigger loading if needed
        });
    } else {
        // Fallback for browsers without native lazy loading
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
        document.body.appendChild(script);
    }

    // ===== Toast Notifications =====
    // Global toast notification system
    (function() {
        let toastStack = null;
        
        function ensureToastStack() {
            if (!toastStack) {
                toastStack = document.createElement('div');
                toastStack.className = 'toast-stack';
                toastStack.setAttribute('aria-live', 'polite');
                toastStack.setAttribute('aria-atomic', 'true');
                document.body.appendChild(toastStack);
            }
            return toastStack;
        }
        
        window.showToast = function(options) {
            const { title, message, variant = 'info', timeout = 5000 } = options || {};
            if (!title && !message) return;
            
            const stack = ensureToastStack();
            const toast = document.createElement('div');
            toast.className = `toast toast--${variant}`;
            toast.setAttribute('role', 'alert');
            
            const content = document.createElement('div');
            content.className = 'toast-content';
            if (title) {
                const titleEl = document.createElement('strong');
                titleEl.className = 'toast-title';
                titleEl.textContent = title;
                content.appendChild(titleEl);
            }
            if (message) {
                const msgEl = document.createElement('span');
                msgEl.className = 'toast-message';
                msgEl.textContent = message;
                content.appendChild(msgEl);
            }
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.innerHTML = '×';
            closeBtn.addEventListener('click', () => {
                toast.classList.add('toast--dismissing');
                setTimeout(() => toast.remove(), 300);
            });
            
            toast.appendChild(content);
            toast.appendChild(closeBtn);
            stack.appendChild(toast);
            
            // Trigger animation
            requestAnimationFrame(() => {
                toast.classList.add('toast--visible');
            });
            
            // Auto-dismiss
            if (timeout > 0) {
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.classList.add('toast--dismissing');
                        setTimeout(() => toast.remove(), 300);
                    }
                }, timeout);
            }
        };
    })();

    // ===== Dark Mode Toggle =====
    (function() {
        const THEME_KEY = 'sgic_theme';
        const THEME_DARK = 'dark';
        const THEME_LIGHT = 'light';
        const NORMALIZE = (p) => (p || '').replace(/\/+$/, '') || '/';

        function getStoredTheme() {
            const stored = localStorage.getItem(THEME_KEY);
            // Default to dark mode if no stored preference
            return stored || THEME_DARK;
        }

        function setTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem(THEME_KEY, theme);
        }

        function createToggle(theme) {
            const navMenu = document.getElementById('nav-menu');
            if (!navMenu) {
                // Retry if nav-menu doesn't exist yet
                setTimeout(() => createToggle(theme), 100);
                return;
            }
            
            // Don't create duplicate
            if (document.getElementById('theme-toggle')) return;

            const li = document.createElement('li');

            const label = document.createElement('label');
            label.className = 'theme-toggle-switch';
            label.id = 'theme-toggle';

            const textSpan = document.createElement('span');
            textSpan.className = 'theme-toggle-label';
            textSpan.textContent = 'Dark mode';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'theme-toggle-input';
            input.checked = theme === THEME_DARK;
            input.setAttribute('aria-label', 'Toggle dark mode');

            const slider = document.createElement('span');
            slider.className = 'theme-toggle-slider';

            label.appendChild(textSpan);
            label.appendChild(input);
            label.appendChild(slider);
            li.appendChild(label);
            navMenu.appendChild(li);

            input.addEventListener('change', () => {
                const newTheme = input.checked ? THEME_DARK : THEME_LIGHT;
                setTheme(newTheme);
            });
        }

        // Initialize theme immediately (before DOM is ready)
        const theme = getStoredTheme();
        setTheme(theme);

        // Create toggle - try multiple times to ensure it's added
        function ensureToggleCreated() {
            const navMenu = document.getElementById('nav-menu');
            if (!navMenu) {
                // Retry if nav-menu doesn't exist yet
                setTimeout(ensureToggleCreated, 100);
                return;
            }
            // Check if toggle already exists
            if (document.getElementById('theme-toggle')) {
                return;
            }
            // Create the toggle
            createToggle(theme);
        }

        // Try immediately if DOM is ready
        if (document.readyState !== 'loading') {
            ensureToggleCreated();
        }

        // Also try on DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => {
            ensureToggleCreated();
        });

        // Multiple retry attempts to catch edge cases
        setTimeout(ensureToggleCreated, 100);
        setTimeout(ensureToggleCreated, 300);
        setTimeout(ensureToggleCreated, 500);
        setTimeout(ensureToggleCreated, 1000);
        
        // Also try when nav menu becomes visible (in case it's dynamically shown)
        const navMenu = document.getElementById('nav-menu');
        if (navMenu) {
            const observer = new MutationObserver(() => {
                if (navMenu.classList.contains('active') && !document.getElementById('theme-toggle')) {
                    ensureToggleCreated();
                }
            });
            observer.observe(navMenu, { attributes: true, attributeFilter: ['class'] });
        }

        // Remove the current page link from the hamburger menu to save space
        function pruneCurrentPageLink() {
            const menu = document.getElementById('nav-menu');
            if (!menu) return;
            const currentPath = NORMALIZE(window.location.pathname);
            menu.querySelectorAll('a[href]').forEach((a) => {
                const href = a.getAttribute('href') || '';
                // Skip in-page anchors like #hero
                if (href.startsWith('#')) return;
                try {
                    const url = new URL(href, window.location.origin);
                    const hrefPath = NORMALIZE(url.pathname);
                    if (hrefPath === currentPath) {
                        const li = a.closest('li');
                        if (li && li.parentNode) {
                            li.parentNode.removeChild(li);
                        }
                    }
                } catch {
                    // ignore malformed hrefs
                }
            });
        }

        if (document.readyState !== 'loading') {
            pruneCurrentPageLink();
        } else {
            document.addEventListener('DOMContentLoaded', pruneCurrentPageLink);
        }
        // Also retry shortly after load in case the menu is hydrated late
        setTimeout(pruneCurrentPageLink, 300);
        setTimeout(pruneCurrentPageLink, 600);
    })();

    // ===== Copyright Year =====
    function updateCopyrightYear() {
        const yearEls = document.querySelectorAll('.copyright-year');
        const currentYear = new Date().getFullYear();
        yearEls.forEach(el => {
            el.textContent = currentYear;
        });
    }

    // ===== Initialize on DOM Load =====
    document.addEventListener('DOMContentLoaded', function() {
        updateCopyrightYear();
        loadSiteSettings();
        loadPageContent();
        loadLatestUpdates();
        loadGallery();
    });

})();