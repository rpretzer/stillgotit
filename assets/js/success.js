/* ========================================
   Success Page - Show Order Details
   ======================================== */

(function () {
  'use strict';

  const API_BASE = 'https://sgic-merch-api.rpretzer.workers.dev/api';
  const REQUEST_TIMEOUT_MS = 15000; // 15 second timeout for API requests
  let productCatalog = null;

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

  /**
   * Fetch the product catalog from the API
   */
  async function fetchCatalog() {
    if (productCatalog) return productCatalog;
    try {
      const res = await fetchWithTimeout(`${API_BASE}/products`);
      if (!res.ok) throw new Error('Failed to load products');
      productCatalog = await res.json();
      return productCatalog;
    } catch (err) {
      console.error('Failed to fetch catalog:', err);
      return { products: [] };
    }
  }

  function getOrderId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('orderId');
  }

  async function loadOrderDetails(orderId) {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}`);
      if (!res.ok) throw new Error(`Failed to load order (${res.status})`);
      return await res.json();
    } catch (err) {
      console.error('Failed to load order:', err);
      return null;
    }
  }

  function formatMoney(cents, currency = 'USD') {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((Number(cents) || 0) / 100);
  }

  function formatOrderId(orderId) {
    // Show first 8 characters of UUID, uppercased
    return orderId ? orderId.slice(0, 8).toUpperCase() : 'N/A';
  }

  function getDisplayName(productName) {
    return (productName || '').replace(/\s*\/\s*(XS|S|M|L|XL|2XL|3XL|4XL|5XL)$/i, '');
  }

  function getStatusDisplay(status) {
    const statusMap = {
      'PENDING': { label: 'Pending', class: 'status--pending' },
      'PAID': { label: 'Paid', class: 'status--success' },
      'FULFILLMENT_SUBMITTED': { label: 'Processing', class: 'status--success' },
      'SHIPPED': { label: 'Shipped', class: 'status--success' },
      'DELIVERED': { label: 'Delivered', class: 'status--success' },
      'MANUAL_REVIEW': { label: 'Under Review', class: 'status--warning' },
      'CANCELLED': { label: 'Cancelled', class: 'status--error' }
    };
    return statusMap[status] || { label: status, class: '' };
  }

  function renderOrderDetails(order, catalog) {
    const detailsEl = document.getElementById('order-details');
    const orderIdEl = document.getElementById('order-id');

    // Update order ID
    if (orderIdEl) {
      orderIdEl.textContent = formatOrderId(order?.id);
    }

    if (!detailsEl) return;

    if (!order) {
      detailsEl.innerHTML = '<p class="success-error">Unable to load order details. Please check your email for confirmation.</p>';
      return;
    }

    const byId = new Map((catalog.products || []).map((p) => [p.id, p]));
    const statusInfo = getStatusDisplay(order.status);

    // Build items HTML
    const itemsHtml = (order.items || []).map(it => {
      const product = byId.get(it.productId);
      if (!product) return ''; // Skip if product not found in catalog

      const variant = product.variants?.find(v => v.id === it.variantId);
      const variantLabel = variant?.label;
      const productName = getDisplayName(product.name);

      return `
        <div class="success-item">
          <div class="success-item-info">
            <span class="success-item-name">${productName || 'Item'}</span>
            ${variantLabel ? `<span class="success-item-variant">${variantLabel}</span>` : ''}
          </div>
          <div class="success-item-qty">×${it.quantity}</div>
          <div class="success-item-price">${formatMoney(it.priceCents * it.quantity, order.currency)}</div>
        </div>
      `;
    }).join('');

    detailsEl.innerHTML = `
      <div class="success-status">
        <span class="success-status-label">Status:</span>
        <span class="success-status-badge ${statusInfo.class}">${statusInfo.label}</span>
      </div>

      <div class="success-items">
        <h4 class="success-items-title">Items Ordered</h4>
        ${itemsHtml}
      </div>

      <div class="success-total">
        <span>Order Total</span>
        <strong>${formatMoney(order.subtotalCents, order.currency)}</strong>
      </div>

      ${order.email ? `
        <div class="success-email">
          <span>Confirmation sent to:</span>
          <strong>${order.email}</strong>
        </div>
      ` : ''}
    `;
  }

  /**
   * Set up social sharing buttons
   */
  function setupSocialSharing() {
    const shareUrl = window.location.origin + '/merch/';
    const shareText = 'Just snagged some awesome merch from Still Got It Collective! Check it out:';

    const twitterBtn = document.getElementById('share-twitter');
    const facebookBtn = document.getElementById('share-facebook');
    const copyBtn = document.getElementById('share-copy');

    if (twitterBtn) {
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
      twitterBtn.href = twitterUrl;
    }

    if (facebookBtn) {
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      facebookBtn.href = facebookUrl;
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(shareUrl);
          copyBtn.classList.add('is-copied');
          setTimeout(() => {
            copyBtn.classList.remove('is-copied');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const orderId = getOrderId();
    const orderIdEl = document.getElementById('order-id');

    if (orderId) {
      // Show order ID immediately (from URL)
      if (orderIdEl) {
        orderIdEl.textContent = formatOrderId(orderId);
      }

      // Load full order details and catalog
      Promise.all([
        loadOrderDetails(orderId),
        fetchCatalog()
      ]).then(([order, catalog]) => {
        renderOrderDetails(order, catalog);
      });
    } else {
      // No order ID in URL
      if (orderIdEl) {
        orderIdEl.textContent = 'N/A';
      }
      const detailsEl = document.getElementById('order-details');
      if (detailsEl) {
        detailsEl.innerHTML = '<p class="success-error">No order ID found. Please check your email for order confirmation.</p>';
      }
    }

    // Set up social sharing
    setupSocialSharing();
  });
})();
