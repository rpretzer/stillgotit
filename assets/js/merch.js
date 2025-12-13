/* ========================================
   Still Got It Collective - Merch Storefront
   Catalog from /content/merch.json
   Cart in localStorage
   Checkout via Cloudflare Worker -> Square hosted checkout
   ======================================== */

(function () {
  'use strict';

  const CART_KEY = 'sgic_merch_cart_v1';

  const els = {
    grid: document.getElementById('merch-grid'),
    source: document.getElementById('merch-source'),
    cartCount: document.getElementById('cart-count'),
    cartItems: document.getElementById('cart-items'),
    subtotal: document.getElementById('cart-subtotal'),
    checkout: document.getElementById('checkout'),
    clear: document.getElementById('clear-cart'),
    openCart: document.getElementById('open-cart'),
    closeCart: document.getElementById('close-cart'),
    error: document.getElementById('merch-error')
  };

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

  function computeSubtotal(cart, catalog) {
    const byId = new Map((catalog.products || []).map((p) => [p.id, p]));
    return (cart.items || []).reduce((sum, it) => {
      const p = byId.get(it.productId);
      if (!p) return sum;
      return sum + (Number(p.priceCents) || 0) * (Number(it.qty) || 0);
    }, 0);
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
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.src = p.image;
        img.alt = p.name || 'Merch item';
        media.appendChild(img);
        card.appendChild(media);
      }

      const content = document.createElement('div');
      content.className = 'card-content';

      const h3 = document.createElement('h3');
      h3.textContent = p.name || 'Item';
      content.appendChild(h3);

      const price = document.createElement('div');
      price.className = 'merch-price';
      price.textContent = formatMoney(p.priceCents, currency);
      content.appendChild(price);

      if (p.description) {
        const desc = document.createElement('p');
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
          opt.textContent = v.label || v.id;
          variantSelect.appendChild(opt);
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
      title.textContent = p.name || it.productId;
      left.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'merch-cart-item-meta';
      const variantLabel = getVariantLabel(p, it.variantId);
      meta.textContent = [variantLabel, formatMoney(p.priceCents, currency)].filter(Boolean).join(' • ');
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
      remove.className = 'btn btn-secondary';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        const cart2 = loadCart();
        removeFromCart(cart2, it.key);
        saveCart(cart2);
        renderCart(cart2, catalog);
      });

      right.appendChild(qty);
      right.appendChild(remove);

      row.appendChild(left);
      row.appendChild(right);
      els.cartItems.appendChild(row);
    });

    const subtotalCents = computeSubtotal(cart, catalog);
    if (els.subtotal) els.subtotal.textContent = formatMoney(subtotalCents, currency);
  }

  async function createCheckout(catalog) {
    const cart = loadCart();
    if (!cart.items.length) {
      setError('Your cart is empty.');
      return;
    }

    const apiBase = (catalog.apiBase || '/api').replace(/\/+$/, '');
    const url = `${apiBase}/checkout`;

    els.checkout.disabled = true;
    setError('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currency: catalog.currency || 'USD',
          items: cart.items.map((it) => ({ productId: it.productId, variantId: it.variantId, qty: it.qty }))
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Checkout failed (${res.status})`);
      if (!data?.url) throw new Error('Checkout failed (missing redirect URL).');

      window.location.href = data.url;
    } catch (err) {
      setError(err?.message || 'Checkout failed.');
    } finally {
      els.checkout.disabled = false;
    }
  }

  async function loadCatalog() {
    const src = els.grid?.dataset?.merchSource || '/content/merch.json';
    const url = new URL(src, window.location.href);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load merch catalog (${res.status})`);
    return await res.json();
  }

  function hookUI(catalog) {
    if (els.checkout) els.checkout.addEventListener('click', () => createCheckout(catalog));
    if (els.clear) els.clear.addEventListener('click', () => {
      saveCart({ items: [] });
      renderCart(loadCart(), catalog);
    });
    if (els.openCart) els.openCart.addEventListener('click', () => { window.location.hash = '#cart'; });
    if (els.closeCart) els.closeCart.addEventListener('click', () => { window.location.hash = '#products'; });
  }

  document.addEventListener('DOMContentLoaded', async () => {
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


