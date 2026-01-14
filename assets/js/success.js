/* ========================================
   Success Page - Show Order Details
   ======================================== */

(function () {
  'use strict';

  const API_BASE = 'https://sgic-merch-api.rpretzer.workers.dev/api';

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

  function renderOrderDetails(order) {
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

    const statusInfo = getStatusDisplay(order.status);

    // Build items HTML
    const itemsHtml = (order.items || []).map(it => `
      <div class="success-item">
        <div class="success-item-info">
          <span class="success-item-name">${it.productId || 'Item'}</span>
          ${it.variantId ? `<span class="success-item-variant">${it.variantId}</span>` : ''}
        </div>
        <div class="success-item-qty">×${it.quantity}</div>
        <div class="success-item-price">${formatMoney(it.priceCents * it.quantity, order.currency)}</div>
      </div>
    `).join('');

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

  document.addEventListener('DOMContentLoaded', () => {
    const orderId = getOrderId();
    const orderIdEl = document.getElementById('order-id');

    if (orderId) {
      // Show order ID immediately (from URL)
      if (orderIdEl) {
        orderIdEl.textContent = formatOrderId(orderId);
      }

      // Load full order details
      loadOrderDetails(orderId).then(order => {
        renderOrderDetails(order);
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
  });
})();
