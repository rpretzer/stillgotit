/* ========================================
   Checkout Page - Stripe Payment Elements
   ======================================== */

(function () {
  'use strict';

  const CART_KEY = 'sgic_merch_cart_v1';
  const API_BASE = 'https://sgic-merch-api.rpretzer.workers.dev/api';
  const REQUEST_TIMEOUT_MS = 30000; // 30 second timeout for API requests

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

  // Get Stripe publishable key (from injected file or fallback)
  const STRIPE_PK = window.STRIPE_PUBLISHABLE_KEY || '';
  
  let stripe = null;
  if (STRIPE_PK) {
    stripe = Stripe(STRIPE_PK);
  } else {
    console.error('Stripe publishable key not found.');
    console.error('In production, this is set by GitHub Actions from NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY secret.');
    console.error('For local testing, set window.STRIPE_PUBLISHABLE_KEY in checkout.html or use a test key.');
  }
  let elements = null;
  let paymentElement = null;
  let clientSecret = null;
  let orderId = null;

  const els = {
    shippingForm: document.getElementById('shipping-form'),
    shippingFormEl: document.getElementById('shipping-form-el'),
    paymentForm: document.getElementById('payment-form'),
    paymentElement: document.getElementById('payment-element'),
    submitPayment: document.getElementById('submit-payment'),
    backToShipping: document.getElementById('back-to-shipping'),
    continueToPayment: document.getElementById('continue-to-payment'),
    error: document.getElementById('checkout-error'),
    loading: document.getElementById('loading'),
    progressSteps: document.querySelectorAll('.checkout-progress-step'),
    progressLine: document.querySelector('.checkout-progress-line'),
    // Order summary elements
    orderSummaryItems: document.getElementById('order-summary-items'),
    summarySubtotal: document.getElementById('summary-subtotal'),
    summaryTotal: document.getElementById('summary-total')
  };

  // Store catalog for order summary
  let productCatalog = null;

  /**
   * Update the checkout progress indicator
   * @param {number} currentStep - 1 for shipping, 2 for payment
   */
  function updateProgress(currentStep) {
    els.progressSteps.forEach((step) => {
      const stepNum = parseInt(step.dataset.step, 10);
      step.classList.remove('active', 'completed');

      if (stepNum < currentStep) {
        step.classList.add('completed');
      } else if (stepNum === currentStep) {
        step.classList.add('active');
      }
    });

    // Update line color if step 1 is completed
    if (els.progressLine) {
      if (currentStep > 1) {
        els.progressLine.style.background = 'var(--status-success)';
      } else {
        els.progressLine.style.background = '';
      }
    }
  }

  /**
   * Format cents as currency
   */
  function formatMoney(cents, currency = 'USD') {
    const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    return fmt.format((Number(cents) || 0) / 100);
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

  /**
   * Render the order summary sidebar
   */
  async function renderOrderSummary() {
    const cart = loadCart();
    if (!cart.items.length || !els.orderSummaryItems) return;

    const catalog = await fetchCatalog();
    const byId = new Map((catalog.products || []).map((p) => [p.id, p]));

    let subtotalCents = 0;
    els.orderSummaryItems.innerHTML = '';

    for (const item of cart.items) {
      const product = byId.get(item.productId);
      if (!product) continue;

      // Find variant info
      const variant = product.variants?.find(v => v.id === item.variantId);
      const variantLabel = variant?.label || '';
      const priceCents = Number(product.priceCents) || 0;
      const lineTotal = priceCents * item.qty;
      subtotalCents += lineTotal;

      // Create item element
      const itemEl = document.createElement('div');
      itemEl.className = 'order-summary-item';
      itemEl.innerHTML = `
        <img src="${product.image || ''}" alt="${product.name || 'Product'}" class="order-summary-item-image" loading="lazy">
        <div class="order-summary-item-details">
          <div class="order-summary-item-name">${product.name || 'Product'}</div>
          ${variantLabel ? `<div class="order-summary-item-variant">${variantLabel}</div>` : ''}
          <div class="order-summary-item-qty">Qty: ${item.qty}</div>
        </div>
        <div class="order-summary-item-price">${formatMoney(lineTotal)}</div>
      `;
      els.orderSummaryItems.appendChild(itemEl);
    }

    // Update totals
    if (els.summarySubtotal) els.summarySubtotal.textContent = formatMoney(subtotalCents);
    if (els.summaryTotal) els.summaryTotal.textContent = formatMoney(subtotalCents);
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

  function showError(msg) {
    if (!els.error) return;
    els.error.hidden = false;
    els.error.textContent = msg;
    els.error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (typeof window.showToast === 'function') {
      window.showToast({ title: 'Error', message: msg, variant: 'error', timeout: 5000 });
    }
  }

  function hideError() {
    if (els.error) els.error.hidden = true;
  }

  function setLoading(loading) {
    if (els.loading) els.loading.hidden = !loading;
    if (els.continueToPayment) els.continueToPayment.disabled = loading;
    if (els.submitPayment) els.submitPayment.disabled = loading;
  }

  /**
   * Creates a Stripe Payment Intent via the backend API.
   * @param {Object} shippingDetails - Shipping address information
   * @param {Object} contactDetails - Contact information (email, phone)
   * @returns {Promise<string|null>} Client secret for Stripe Payment Element, or null if failed
   */
  async function createPaymentIntent(shippingDetails, contactDetails) {
    const cart = loadCart();
    if (!cart.items.length) {
      showError('Your cart is empty.');
      return null;
    }

    setLoading(true);
    hideError();

    try {
      const res = await fetchWithTimeout(`${API_BASE}/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currency: 'USD',
          items: cart.items.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            qty: it.qty
          })),
          shippingDetails: {
            address1: shippingDetails.address1,
            address2: shippingDetails.address2 || '',
            city: shippingDetails.city,
            state: shippingDetails.state,
            postalCode: shippingDetails.postalCode,
            country: shippingDetails.country || 'US'
          },
          contactDetails: {
            email: contactDetails.email,
            name: contactDetails.name
          }
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Parse Stripe-specific error messages
        const errorMsg = data?.error?.message || data?.error || `Checkout failed (${res.status})`;
        throw new Error(errorMsg);
      }
      if (!data?.clientSecret || !data?.orderId) {
        throw new Error('Checkout failed (missing client secret or order ID).');
      }

      return { clientSecret: data.clientSecret, orderId: data.orderId };
    } catch (err) {
      showError(err?.message || 'Failed to create payment. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function initializePaymentElement(clientSecret) {
    if (!stripe || !elements) {
      showError('Stripe not initialized. Please refresh the page.');
      return;
    }

    paymentElement = elements.getElement('payment');
    if (!paymentElement) {
      paymentElement = elements.create('payment');
      paymentElement.mount(els.paymentElement);
    }

    // Listen for changes to enable/disable submit button
    paymentElement.on('ready', () => {
      if (els.submitPayment) els.submitPayment.disabled = false;
    });
  }

  async function handleShippingSubmit(e) {
    e.preventDefault();
    hideError();

    const formData = new FormData(e.target);
    const shippingDetails = {
      address1: formData.get('address1'),
      address2: formData.get('address2'),
      city: formData.get('city'),
      state: formData.get('state'),
      postalCode: formData.get('postalCode'),
      country: formData.get('country') || 'US'
    };

    const contactDetails = {
      email: formData.get('email'),
      name: formData.get('name')
    };

    // Validate required fields
    if (!contactDetails.email || !contactDetails.name || !shippingDetails.address1 ||
        !shippingDetails.city || !shippingDetails.state || !shippingDetails.postalCode) {
      showError('Please fill in all required fields.');
      return;
    }

    // Create PaymentIntent
    const result = await createPaymentIntent(shippingDetails, contactDetails);
    if (!result) return;

    clientSecret = result.clientSecret;
    orderId = result.orderId;
    
    if (typeof window.showToast === 'function') {
      window.showToast({ title: 'Order created', message: 'Please complete payment', variant: 'info', timeout: 3000 });
    }

    // Initialize Stripe Elements
    if (!stripe) {
      showError('Stripe not loaded. Please refresh the page.');
      return;
    }

    if (!elements) {
      elements = stripe.elements({ clientSecret });
    }

    // Show payment form and update progress
    els.shippingForm.hidden = true;
    els.paymentForm.hidden = false;
    updateProgress(2);
    await initializePaymentElement(clientSecret);
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret || !orderId) {
      showError('Payment not ready. Please try again.');
      return;
    }

    setLoading(true);
    hideError();

    try {
      // Required for the Payment Element with certain wallets:
      // validates form and completes any async work before confirmPayment.
      if (elements.submit) {
        const { error: submitError } = await elements.submit();
        if (submitError) {
          showError(submitError.message || 'Please check your payment details and try again.');
          setLoading(false);
          return;
        }
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/merch/success/?orderId=${orderId}`
        },
        redirect: 'if_required'
      });

      if (error) {
        showError(error.message || 'Payment failed. Please try again.');
        setLoading(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Clear cart
        localStorage.removeItem(CART_KEY);
        if (typeof window.showToast === 'function') {
          window.showToast({ title: 'Payment successful!', message: 'Redirecting to confirmation...', variant: 'success', timeout: 2000 });
        }
        // Redirect to success page
        setTimeout(() => {
        window.location.href = `/merch/success/?orderId=${orderId}`;
        }, 500);
      } else {
        showError('Payment status: ' + (paymentIntent?.status || 'unknown'));
        setLoading(false);
      }
    } catch (err) {
      showError(err?.message || 'Payment failed. Please try again.');
      setLoading(false);
    }
  }

  function handleBackToShipping() {
    els.paymentForm.hidden = true;
    els.shippingForm.hidden = false;
    updateProgress(1);
    if (paymentElement) {
      paymentElement.unmount();
      paymentElement = null;
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    const cart = loadCart();
    if (!cart.items.length) {
      window.location.href = '/merch/';
      return;
    }

    // Render order summary
    renderOrderSummary();

    if (!stripe) {
      showError('Stripe is not configured. Please contact support.');
      return;
    }

    if (els.shippingFormEl) {
      els.shippingFormEl.addEventListener('submit', handleShippingSubmit);
    }

    if (els.submitPayment) {
      els.submitPayment.addEventListener('click', handlePaymentSubmit);
    }

    if (els.backToShipping) {
      els.backToShipping.addEventListener('click', handleBackToShipping);
    }
  });
})();

