/* ========================================
   Still Got It Collective - Merch Storefront
   Catalog from /content/merch.json
   Cart in localStorage
   Checkout via Cloudflare Worker -> Stripe Payment Elements
   ======================================== */

(function () {
  'use strict';

  const CART_KEY = 'sgic_merch_cart_v1';
  const ABANDONED_CART_API = 'https://sgic-merch-api.rpretzer.workers.dev/api/carts/abandoned';
  const REQUEST_TIMEOUT_MS = 15000; // 15 second timeout for API requests
  let abandonedCartToken = null;

  /**
   * Fetch with timeout support using AbortController
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<Response>}
   */
  async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const els = {
    grid: document.getElementById('merch-grid'),
    source: document.getElementById('merch-source'),
    cartCount: document.getElementById('cart-count'),
    cartItems: document.getElementById('cart-items'),
    subtotal: document.getElementById('cart-subtotal'),
    estShipping: document.getElementById('cart-est-shipping'),
    estTax: document.getElementById('cart-est-tax'),
    estTotal: document.getElementById('cart-est-total'),
    estimates: document.getElementById('cart-estimates'),
    totalRow: document.getElementById('cart-total-row'),
    checkout: document.getElementById('checkout'),
    clear: document.getElementById('clear-cart'),
    openCart: document.getElementById('open-cart'),
    closeCart: document.getElementById('close-cart'),
    navCart: document.getElementById('nav-cart'),
    error: document.getElementById('merch-error'),
    // Modal elements
    modal: document.getElementById('product-modal'),
    modalImages: document.getElementById('modal-images'),
    modalNav: document.getElementById('modal-nav'),
    modalCounter: document.getElementById('modal-counter'),
    modalTitle: document.getElementById('modal-title'),
    modalPrice: document.getElementById('modal-price'),
    modalDescription: document.getElementById('modal-description')
  };

  // Modal state
  let currentModalImages = [];
  let currentModalIndex = 0;

  // Estimated shipping rates (flat rate per item for US standard shipping)
  const EST_SHIPPING_BASE = 499; // $4.99 base
  const EST_SHIPPING_PER_ITEM = 199; // $1.99 per additional item
  const EST_TAX_RATE = 0.07; // 7% estimated average US sales tax

  function formatMoney(cents, currency = 'USD') {
    const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    return fmt.format((Number(cents) || 0) / 100);
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : { items: [] };
      if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
      return parsed;
    } catch {
      return { items: [] };
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    // Track abandoned cart (debounced)
    if (cart.items && cart.items.length > 0) {
      trackAbandonedCart(cart);
    }
  }

  // Debounced abandoned cart tracking
  let abandonCartTimeout = null;
  async function trackAbandonedCart(cart) {
    clearTimeout(abandonCartTimeout);
    abandonCartTimeout = setTimeout(async () => {
      try {
        const res = await fetchWithTimeout(ABANDONED_CART_API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            items: cart.items,
            currency: 'USD',
            email: null // Can be collected later
          })
        }, 10000); // 10 second timeout for non-critical abandoned cart tracking
        const data = await res.json().catch(() => ({}));
        if (data.recoveryToken) {
          abandonedCartToken = data.recoveryToken;
          localStorage.setItem('sgic_abandoned_cart_token', data.recoveryToken);
        }
      } catch (err) {
        // Silently fail - abandoned cart tracking is non-critical
        // Error logged only in development if needed
      }
    }, 2000); // Wait 2 seconds after last cart change
  }

  function cartCount(cart) {
    return (cart.items || []).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  }

  function setError(msg) {
    if (!els.error) return;
    if (!msg) {
      els.error.hidden = true;
      els.error.textContent = '';
      return;
    }
    els.error.hidden = false;
    els.error.textContent = msg;
  }

  function normalizeQty(n) {
    const q = Math.floor(Number(n) || 0);
    return Math.max(1, Math.min(20, q));
  }

  function addToCart(cart, productId, variantId, qty) {
    const key = `${productId}::${variantId || ''}`;
    const existing = cart.items.find((x) => x.key === key);
    if (existing) existing.qty = normalizeQty((existing.qty || 0) + qty);
    else cart.items.push({ key, productId, variantId: variantId || null, qty: normalizeQty(qty) });
    return cart;
  }

  function removeFromCart(cart, key) {
    cart.items = cart.items.filter((x) => x.key !== key);
    return cart;
  }

  function updateQty(cart, key, qty) {
    const it = cart.items.find((x) => x.key === key);
    if (!it) return cart;
    it.qty = normalizeQty(qty);
    return cart;
  }

  function getVariantLabel(product, variantId) {
    if (!variantId) return '';
    const v = (product.variants || []).find((x) => x.id === variantId);
    return v?.label || '';
  }

  function getDisplayName(productName) {
    return (productName || '').replace(/\s*\/\s*(XS|S|M|L|XL|2XL|3XL|4XL|5XL)$/i, '');
  }

  // ===== Product Modal =====

  function openProductModal(product, currency = 'USD') {
    if (!els.modal) return;

    // Gather all images (main image + any mockups array if available)
    const images = [];
    if (product.image) images.push(product.image);
    if (Array.isArray(product.images)) {
      product.images.forEach((img) => {
        if (img && !images.includes(img)) images.push(img);
      });
    }
    if (Array.isArray(product.mockups)) {
      product.mockups.forEach((img) => {
        if (img && !images.includes(img)) images.push(img);
      });
    }

    currentModalImages = images;
    currentModalIndex = 0;

    // Populate images
    if (els.modalImages) {
      els.modalImages.innerHTML = '';
      images.forEach((src, i) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = `${product.name || 'Product'} - Image ${i + 1}`;
        img.loading = i === 0 ? 'eager' : 'lazy';
        els.modalImages.appendChild(img);
      });
    }

    // Show/hide navigation if multiple images
    if (els.modalNav) {
      els.modalNav.hidden = images.length <= 1;
    }
    updateModalCounter();

    const displayName = getDisplayName(product.name || 'Product');
    if (els.modalTitle) els.modalTitle.textContent = displayName;
    if (els.modalPrice) els.modalPrice.textContent = formatMoney(product.priceCents, currency);
    if (els.modalDescription) {
      els.modalDescription.textContent = product.description || '';
      els.modalDescription.hidden = !product.description;
    }

    // Show modal
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    // Focus trap
    els.modal.focus();
  }

  function closeProductModal() {
    if (!els.modal) return;
    els.modal.hidden = true;
    document.body.style.overflow = '';
  }

  function updateModalCounter() {
    if (els.modalCounter && currentModalImages.length > 0) {
      els.modalCounter.textContent = `${currentModalIndex + 1} / ${currentModalImages.length}`;
    }
  }

  function navigateModal(direction) {
    if (currentModalImages.length <= 1) return;

    currentModalIndex = (currentModalIndex + direction + currentModalImages.length) % currentModalImages.length;
    updateModalCounter();

    // Scroll to image
    if (els.modalImages) {
      const targetImg = els.modalImages.children[currentModalIndex];
      if (targetImg) {
        targetImg.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      }
    }
  }

  function initModalListeners() {
    if (!els.modal) return;

    // Close on backdrop click or close button
    els.modal.querySelectorAll('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', closeProductModal);
    });

    // Navigation buttons
    const prevBtn = els.modal.querySelector('.merch-modal-prev');
    const nextBtn = els.modal.querySelector('.merch-modal-next');
    if (prevBtn) prevBtn.addEventListener('click', () => navigateModal(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateModal(1));

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (els.modal.hidden) return;
      if (e.key === 'Escape') closeProductModal();
      if (e.key === 'ArrowLeft') navigateModal(-1);
      if (e.key === 'ArrowRight') navigateModal(1);
    });
  }

  function getItemPrice(product, variantId) {
    if (!variantId || !product.variants) return product.priceCents;
    const v = product.variants.find((x) => x.id === variantId);
    return v?.priceCents || product.priceCents;
  }

  function computeSubtotal(cart, catalog) {
    const byId = new Map((catalog.products || []).map((p) => [p.id, p]));
    return (cart.items || []).reduce((sum, it) => {
      const p = byId.get(it.productId);
      if (!p) return sum;
      const itemPrice = getItemPrice(p, it.variantId);
      return sum + (Number(itemPrice) || 0) * (Number(it.qty) || 0);
    }, 0);
  }

  function computeEstimates(cart, subtotalCents) {
    const totalQty = cartCount(cart);
    if (totalQty === 0) {
      return { shipping: 0, tax: 0, total: 0 };
    }
    // Estimated shipping: base + per additional item
    const shippingCents = EST_SHIPPING_BASE + (Math.max(0, totalQty - 1) * EST_SHIPPING_PER_ITEM);
    // Estimated tax on subtotal only (shipping taxability varies by state)
    const taxCents = Math.round(subtotalCents * EST_TAX_RATE);
    const totalCents = subtotalCents + shippingCents + taxCents;
    return { shipping: shippingCents, tax: taxCents, total: totalCents };
  }

  function renderCatalog(catalog) {
    if (!els.grid) return;
    const currency = catalog.currency || 'USD';
    els.grid.innerHTML = '';
    if (els.source) els.source.textContent = (els.grid.dataset.merchSource || '/content/merch.json');

    (catalog.products || []).forEach((p) => {
      const card = document.createElement('article');
      card.className = 'announcement-card merch-card fade-in';

      if (p.image) {
        const media = document.createElement('div');
        media.className = 'card-image';
        media.setAttribute('role', 'button');
        media.setAttribute('tabindex', '0');
        media.setAttribute('aria-label', `View ${p.name || 'product'} images`);
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.src = p.image;
        img.alt = p.name || 'Merch item';
        media.appendChild(img);
        // Open modal on click
        media.addEventListener('click', () => openProductModal(p, currency));
        media.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openProductModal(p, currency);
          }
        });
        card.appendChild(media);
      }

      const content = document.createElement('div');
      content.className = 'card-content';

      const h3 = document.createElement('h3');
      h3.textContent = getDisplayName(p.name) || 'Item';
      content.appendChild(h3);

      const price = document.createElement('div');
      price.className = 'merch-price';
      // Get initial price (from first variant if available, else base price)
      const getVariantPrice = (variantId) => {
        if (!variantId || !p.variants) return p.priceCents;
        const v = p.variants.find((x) => x.id === variantId);
        return v?.priceCents || p.priceCents;
      };
      const initialVariantId = (p.variants && p.variants.length > 0) ? p.variants[0].id : null;
      price.textContent = formatMoney(getVariantPrice(initialVariantId), currency);
      content.appendChild(price);

      if (p.description) {
        const desc = document.createElement('p');
        desc.className = 'merch-description';
        desc.textContent = p.description;
        content.appendChild(desc);
      }

      let variantSelect = null;
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        const row = document.createElement('div');
        row.className = 'merch-variant-row';
        variantSelect = document.createElement('select');
        variantSelect.className = 'merch-select';
        (p.variants || []).forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v.id;
          // Show price in variant label if different from base
          const variantPriceLabel = v.priceCents && v.priceCents !== p.priceCents
            ? ` - ${formatMoney(v.priceCents, currency)}`
            : '';
          opt.textContent = (v.label || v.id) + variantPriceLabel;
          variantSelect.appendChild(opt);
        });
        // Update price display when variant changes
        variantSelect.addEventListener('change', () => {
          price.textContent = formatMoney(getVariantPrice(variantSelect.value), currency);
        });
        row.appendChild(variantSelect);
        content.appendChild(row);
      }

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = 'Add to cart';
      btn.addEventListener('click', () => {
        const cart = loadCart();
        const variantId = variantSelect ? variantSelect.value : null;
        addToCart(cart, p.id, variantId, 1);
        saveCart(cart);
        renderCart(loadCart(), catalog);
        window.location.hash = '#cart';
        setError('');

        // Animate cart icon
        if (els.navCart) {
          els.navCart.classList.add('is-animating');
          els.navCart.addEventListener('animationend', () => {
            els.navCart.classList.remove('is-animating');
          }, { once: true });
        }

        if (typeof window.showToast === 'function') {
          const variantLabel = getVariantLabel(p, variantId);
          const itemName = variantLabel ? `${getDisplayName(p.name)} (${variantLabel})` : getDisplayName(p.name);
          window.showToast({ title: 'Added to cart', message: itemName, variant: 'success', timeout: 3000 });
        }
      });
      content.appendChild(btn);

      card.appendChild(content);
      els.grid.appendChild(card);
    });

    if (typeof window.__observeFadeIns === 'function') window.__observeFadeIns(els.grid);
  }

  function renderCart(cart, catalog) {
    const currency = catalog.currency || 'USD';
    if (els.cartCount) els.cartCount.textContent = String(cartCount(cart));
    if (els.cartItems) els.cartItems.innerHTML = '';
    setError('');

    const byId = new Map((catalog.products || []).map((p) => [p.id, p]));

    (cart.items || []).forEach((it) => {
      const p = byId.get(it.productId);
      if (!p) return;

      const row = document.createElement('div');
      row.className = 'merch-cart-item';

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'merch-cart-item-title';
      
      const variantLabel = getVariantLabel(p, it.variantId);
      const displayName = getDisplayName(p.name || it.productId);
      const titleText = variantLabel ? `${displayName} (${variantLabel})` : displayName;
      title.textContent = titleText;
      left.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'merch-cart-item-meta';
      const itemPrice = getItemPrice(p, it.variantId);
      meta.textContent = formatMoney(itemPrice, currency);
      left.appendChild(meta);

      const right = document.createElement('div');
      right.className = 'merch-qty';

      const qty = document.createElement('input');
      qty.type = 'number';
      qty.min = '1';
      qty.max = '20';
      qty.value = String(it.qty || 1);
      qty.addEventListener('change', () => {
        const cart2 = loadCart();
        updateQty(cart2, it.key, qty.value);
        saveCart(cart2);
        renderCart(cart2, catalog);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-tertiary';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        const cart2 = loadCart();
        const productName = p.name || it.productId;
        removeFromCart(cart2, it.key);
        saveCart(cart2);
        renderCart(cart2, catalog);
        if (typeof window.showToast === 'function') {
          window.showToast({ title: 'Removed from cart', message: productName, variant: 'info', timeout: 2000 });
        }
      });

      right.appendChild(qty);
      right.appendChild(remove);

      row.appendChild(left);
      row.appendChild(right);
      els.cartItems.appendChild(row);
    });

    const subtotalCents = computeSubtotal(cart, catalog);
    if (els.subtotal) els.subtotal.textContent = formatMoney(subtotalCents, currency);

    // Calculate and display estimates
    const estimates = computeEstimates(cart, subtotalCents);
    if (els.estShipping) els.estShipping.textContent = formatMoney(estimates.shipping, currency);
    if (els.estTax) els.estTax.textContent = formatMoney(estimates.tax, currency);
    if (els.estTotal) els.estTotal.textContent = formatMoney(estimates.total, currency);

    // Show/hide estimates section based on cart contents
    const hasItems = cart.items.length > 0;
    if (els.estimates) {
      els.estimates.hidden = !hasItems;
    }
    if (els.totalRow) {
      els.totalRow.hidden = !hasItems;
    }
  }

  function createCheckout(catalog) {
    const cart = loadCart();
    if (!cart.items.length) {
      setError('Your cart is empty.');
      if (typeof window.showToast === 'function') {
        window.showToast({ title: 'Cart is empty', message: 'Add items to your cart first', variant: 'error', timeout: 3000 });
      }
      return;
    }
    // Redirect to checkout page
    window.location.href = '/merch/checkout.html';
  }

  /**
   * Loads product catalog from API (synced from Printful).
   * Fallback: /content/merch.json (editable via /admin)
   * @returns {Promise<Object>} Product catalog
   */
  async function loadCatalog() {
    const apiBase = window.SGIC_CONFIG?.API_BASE || 'https://sgic-merch-api.rpretzer.workers.dev/api';
    const src = els.grid?.dataset?.merchSource || `${apiBase}/products`;
    const url = new URL(src, window.location.href);
    // Add cache-busting to ensure fresh catalog
    const fetchUrl = url.toString() + (url.toString().includes('?') ? '&' : '?') + `t=${Date.now()}`;
    const res = await fetchWithTimeout(fetchUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load merch catalog (${res.status})`);
    return await res.json();
  }

  function hookUI(catalog) {
    if (els.checkout) els.checkout.addEventListener('click', () => createCheckout(catalog));
    if (els.clear) els.clear.addEventListener('click', () => {
      saveCart({ items: [] });
      renderCart(loadCart(), catalog);
      if (typeof window.showToast === 'function') {
        window.showToast({ title: 'Cart cleared', message: 'All items removed', variant: 'info', timeout: 2000 });
      }
    });
    const openCart = () => { window.location.hash = '#cart'; };
    if (els.openCart) els.openCart.addEventListener('click', openCart);
    if (els.navCart) els.navCart.addEventListener('click', openCart);
    if (els.closeCart) els.closeCart.addEventListener('click', () => {
      // Force scroll to products even if hash is already #products
      const productsSection = document.getElementById('products');
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth' });
      }
      window.location.hash = '#products';
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initModalListeners();
    try {
      const catalog = await loadCatalog();
      renderCatalog(catalog);
      renderCart(loadCart(), catalog);
      hookUI(catalog);
    } catch (err) {
      if (els.grid) {
        els.grid.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'ticket-card';
        const h = document.createElement('h3');
        h.textContent = 'Could not load merch.';
        const p = document.createElement('p');
        p.textContent = err?.message || 'Unknown error';
        card.appendChild(h);
        card.appendChild(p);
        els.grid.appendChild(card);
      }
    }
  });
})();


