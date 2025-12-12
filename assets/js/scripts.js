/* ========================================
   The Still Got It Collective - JavaScript
   Smooth scroll, fade-ins, lightbox, hamburger menu
   ======================================== */

(function() {
    'use strict';

    // ===== Latest Updates (Decap CMS) =====
    // Source: /content/updates.json
    // Editors: use /admin to update cards (no HTML edits needed)
    async function loadLatestUpdates() {
        const grid = document.getElementById('announcements-grid');
        if (!grid) return;

        const source = grid.dataset.updatesSource || 'content/updates.json';
        const url = new URL(source, window.location.href);

        try {
            const res = await fetch(url.toString(), { cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to load updates.json (${res.status})`);
            const data = await res.json();
            if (!data || !Array.isArray(data.updates)) throw new Error('Invalid updates.json format');

            const updates = [...data.updates].sort((a, b) => {
                const ap = a?.pinned ? 1 : 0;
                const bp = b?.pinned ? 1 : 0;
                if (ap !== bp) return bp - ap;
                const ad = Date.parse(a?.date || '') || 0;
                const bd = Date.parse(b?.date || '') || 0;
                return bd - ad;
            });

            // Clear fallback HTML once CMS content is ready
            grid.innerHTML = '';

            const fmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

            updates.forEach((u) => {
                const card = document.createElement('article');
                card.className = 'announcement-card fade-in';

                if (u?.image) {
                    const media = document.createElement('div');
                    media.className = 'card-image';
                    const img = document.createElement('img');
                    img.loading = 'lazy';
                    img.src = u.image;
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
                if (u?.date && !Number.isNaN(Date.parse(u.date))) {
                    dateP.textContent = fmt.format(new Date(u.date));
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
            console.warn('Latest updates load failed:', err);
        }
    }

    // ===== Site Settings (Decap CMS) =====
    // Source: /content/site.json
    async function loadSiteSettings() {
        const url = new URL('content/site.json', window.location.href);
        try {
            const res = await fetch(url.toString(), { cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to load site.json (${res.status})`);
            const settings = await res.json();

            // Hero tagline
            const heroTagline = document.getElementById('hero-tagline');
            if (heroTagline && settings?.hero?.tagline) {
                heroTagline.textContent = settings.hero.tagline;
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
            const ebLink = document.getElementById('eventbrite-link');
            const ebLabel = document.getElementById('eventbrite-label');
            if (ebLink && settings?.tickets?.eventbriteUrl) ebLink.href = settings.tickets.eventbriteUrl;
            if (ebLabel && settings?.tickets?.eventbriteLabel) ebLabel.textContent = settings.tickets.eventbriteLabel;

            const sqLink = document.getElementById('square-link');
            const sqLabel = document.getElementById('square-label');
            if (sqLink && settings?.tickets?.squareUrl) sqLink.href = settings.tickets.squareUrl;
            if (sqLabel && settings?.tickets?.squareLabel) sqLabel.textContent = settings.tickets.squareLabel;

            // Instagram
            const igHandle = document.getElementById('instagram-handle');
            if (igHandle && settings?.instagram?.username) igHandle.textContent = `@${settings.instagram.username}`;

            const igProfileUrl = settings?.instagram?.profileUrl;
            if (igProfileUrl) {
                document.querySelectorAll('a[data-instagram-profile]').forEach((a) => {
                    a.href = igProfileUrl;
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
        } catch (err) {
            console.warn('Site settings load failed:', err);
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

    // ===== Gallery Lightbox Modal =====
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    const lightboxCounter = document.getElementById('lightbox-counter');
    
    let currentImageIndex = 0;
    const images = Array.from(galleryItems).map(item => ({
        src: item.querySelector('img').src,
        alt: item.querySelector('img').alt
    }));

    // Open lightbox when clicking on gallery item
    galleryItems.forEach((item, index) => {
        item.addEventListener('click', function() {
            currentImageIndex = index;
            openLightbox();
        });
    });

    function openLightbox() {
        if (!lightbox || !lightboxImage) return;
        
        updateLightboxImage();
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Update counter
        if (lightboxCounter) {
            lightboxCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
        }
    }

    function closeLightbox() {
        if (!lightbox) return;
        
        lightbox.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }

    function updateLightboxImage() {
        if (!lightboxImage || !images[currentImageIndex]) return;
        
        lightboxImage.src = images[currentImageIndex].src;
        lightboxImage.alt = images[currentImageIndex].alt;
    }

    function showPrevImage() {
        currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
        updateLightboxImage();
        if (lightboxCounter) {
            lightboxCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
        }
    }

    function showNextImage() {
        currentImageIndex = (currentImageIndex + 1) % images.length;
        updateLightboxImage();
        if (lightboxCounter) {
            lightboxCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
        }
    }

    // Close lightbox
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }

    // Close on backdrop click
    if (lightbox) {
        lightbox.addEventListener('click', function(e) {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (!lightbox || !lightbox.classList.contains('active')) return;
        
        switch(e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                showPrevImage();
                break;
            case 'ArrowRight':
                showNextImage();
                break;
        }
    });

    // Previous/Next buttons
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', function(e) {
            e.stopPropagation();
            showPrevImage();
        });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', function(e) {
            e.stopPropagation();
            showNextImage();
        });
    }

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

    // ===== Initialize on DOM Load =====
    document.addEventListener('DOMContentLoaded', function() {
        // Any initialization code that needs to run after DOM is ready
        console.log('The Still Got It Collective website loaded successfully!');
        loadSiteSettings();
        loadLatestUpdates();
    });

})();