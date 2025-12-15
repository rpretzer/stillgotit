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

  function renderOrderDetails(order) {
    const detailsEl = document.getElementById('order-details');
    if (!detailsEl || !order) return;

    const itemsHtml = (order.items || []).map(it => `
      <div style="display: flex; justify-content: space-between; padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-default);">
        <div>
          <strong>${it.productId}</strong>
          ${it.variantId ? `<span style="color: var(--text-secondary);"> • ${it.variantId}</span>` : ''}
          <div style="font-size: var(--text-sm); color: var(--text-secondary);">Qty: ${it.quantity}</div>
        </div>
        <div>${formatMoney(it.priceCents * it.quantity, order.currency)}</div>
      </div>
    `).join('');

    detailsEl.innerHTML = `
      <div style="background: var(--bg-secondary); padding: var(--spacing-md); border-radius: var(--radius-md); margin-top: var(--spacing-md);">
        <h3 style="margin-top: 0;">Order #${order.id.slice(0, 8)}</h3>
        <div style="margin-bottom: var(--spacing-md);">
          <strong>Status:</strong> ${order.status}
        </div>
        <div style="margin-bottom: var(--spacing-md);">
          <strong>Subtotal:</strong> ${formatMoney(order.subtotalCents, order.currency)}
        </div>
        ${itemsHtml}
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const orderId = getOrderId();
    if (orderId) {
      loadOrderDetails(orderId).then(order => {
        if (order) renderOrderDetails(order);
      });
    }
  });
})();

