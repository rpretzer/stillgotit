/* ========================================
   Cart Recovery Page
   ======================================== */

(function () {
  'use strict';

  const CART_KEY = 'sgic_merch_cart_v1';
  const API_BASE = 'https://sgic-merch-api.rpretzer.workers.dev/api';

  function getRecoveryToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
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

  async function recoverCart(token) {
    try {
      const res = await fetch(`${API_BASE}/carts/recover/${token}`);
      if (!res.ok) throw new Error('Cart not found');
      const cart = await res.json();
      
      // Mark cart as recovered
      await fetch(`${API_BASE}/carts/recover/${token}`, { method: 'POST' });
      
      return cart;
    } catch (err) {
      console.error('Failed to recover cart:', err);
      return null;
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const token = getRecoveryToken();
    const loadingEl = document.getElementById('recover-loading');
    const errorEl = document.getElementById('recover-error');
    const successEl = document.getElementById('recover-success');

    if (!token) {
      if (loadingEl) loadingEl.hidden = true;
      if (errorEl) errorEl.hidden = false;
      return;
    }

    const cart = await recoverCart(token);
    
    if (loadingEl) loadingEl.hidden = true;

    if (!cart || !cart.items || !cart.items.length) {
      if (errorEl) errorEl.hidden = false;
      return;
    }

    // Restore cart to localStorage
    saveCart({ items: cart.items });
    
    if (successEl) successEl.hidden = false;
  });
})();

