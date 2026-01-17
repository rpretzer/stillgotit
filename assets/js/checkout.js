/* ========================================
   Checkout Page - Stripe Payment Elements
   ======================================== */

(function () {
  'use strict';

  const CART_KEY = 'sgic_merch_cart_v1';
  const SHIPPING_FORM_STATE_KEY = 'sgic_merch_shipping_form';
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
  let currentShippingDetails = null;
  let currentContactDetails = null;

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
  // Store cart subtotal for payment button
  let cartSubtotalCents = 0;

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
   * Calculate and display estimated delivery date
   * Printful: 2-5 business days fulfillment + 3-7 business days US shipping
   */
  function updateEstimatedDelivery() {
    const deliveryDateEl = document.getElementById('delivery-date');
    if (!deliveryDateEl) return;

    const today = new Date();

    // Add business days (skip weekends)
    function addBusinessDays(date, days) {
      const result = new Date(date);
      let added = 0;
      while (added < days) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          added++;
        }
      }
      return result;
    }

    // Min: 2 fulfillment + 3 shipping = 5 business days
    // Max: 5 fulfillment + 7 shipping = 12 business days
    const minDate = addBusinessDays(today, 5);
    const maxDate = addBusinessDays(today, 12);

    const formatOptions = { month: 'short', day: 'numeric' };
    const minDateStr = minDate.toLocaleDateString('en-US', formatOptions);
    const maxDateStr = maxDate.toLocaleDateString('en-US', formatOptions);

    deliveryDateEl.textContent = `${minDateStr} - ${maxDateStr}`;
  }

  // =========================================
  // Inline Form Validation
  // =========================================

  const validators = {
    email: (value) => {
      if (!value.trim()) return 'Email is required';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return 'Please enter a valid email address';
      return null;
    },
    name: (value) => {
      if (!value.trim()) return 'Full name is required';
      if (value.trim().length < 2) return 'Name must be at least 2 characters';
      return null;
    },
    address1: (value) => {
      if (!value.trim()) return 'Address is required';
      if (value.trim().length < 5) return 'Please enter a valid street address';
      return null;
    },
    city: (value) => {
      if (!value.trim()) return 'City is required';
      return null;
    },
    state: (value) => {
      const country = document.getElementById('country')?.value || 'US';
      if ((country === 'US' || country === 'CA') && !value) {
        return country === 'US' ? 'Please select a state' : 'Please select a province';
      }
      return null;
    },
    postalCode: (value) => {
      if (!value.trim()) return 'ZIP/Postal code is required';
      const country = document.getElementById('country')?.value || 'US';
      if (country === 'US') {
        const usZipRegex = /^\d{5}(-\d{4})?$/;
        if (!usZipRegex.test(value.trim())) return 'Please enter a valid US ZIP code (12345 or 12345-6789)';
      } else if (country === 'CA') {
        const caPostalRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
        if (!caPostalRegex.test(value.trim())) return 'Please enter a valid Canadian postal code (A1A 1A1)';
      }
      return null;
    }
  };

  /**
   * Show field error
   */
  function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (field) {
      field.classList.remove('is-valid');
      field.classList.add('is-invalid');
    }
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('is-visible');
    }
  }

  /**
   * Clear field error and show valid state
   */
  function clearFieldError(fieldId, showValid = true) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (field) {
      field.classList.remove('is-invalid');
      if (showValid && field.value.trim()) {
        field.classList.add('is-valid');
      } else {
        field.classList.remove('is-valid');
      }
    }
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
    }
  }

  /**
   * Saves the current shipping form state to localStorage
   */
  function saveShippingFormState() {
    const formFields = ['email', 'name', 'address1', 'address2', 'city', 'state', 'postalCode', 'country'];
    const formData = {};
    for (const fieldId of formFields) {
      const field = document.getElementById(fieldId);
      if (field) {
        formData[fieldId] = field.value;
      }
    }
    localStorage.setItem(SHIPPING_FORM_STATE_KEY, JSON.stringify(formData));
  }

  /**
   * Loads and pre-fills the shipping form from localStorage
   */
  function loadShippingFormState() {
    try {
      const savedState = localStorage.getItem(SHIPPING_FORM_STATE_KEY);
      if (savedState) {
        const formData = JSON.parse(savedState);
        for (const fieldId in formData) {
          const field = document.getElementById(fieldId);
          if (field) {
            field.value = formData[fieldId];
            // Trigger change for country to update state/province dropdown
            if (fieldId === 'country') {
              handleCountryChange(field.value);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load shipping form state from localStorage', e);
      localStorage.removeItem(SHIPPING_FORM_STATE_KEY); // Clear potentially corrupt data
    }
  }

  /**
   * Validate a single field
   */
  function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return true;

    const validator = validators[fieldId];
    if (!validator) return true;

    const error = validator(field.value);
    if (error) {
      showFieldError(fieldId, error);
      return false;
    } else {
      clearFieldError(fieldId);
      return true;
    }
  }

  /**
   * Validate all shipping form fields
   */
  function validateShippingForm() {
    const fields = ['email', 'name', 'address1', 'city', 'state', 'postalCode'];
    let isValid = true;
    let firstInvalid = null;

    for (const fieldId of fields) {
      if (!validateField(fieldId)) {
        isValid = false;
        if (!firstInvalid) {
          firstInvalid = document.getElementById(fieldId);
        }
      }
    }

    if (firstInvalid) {
      firstInvalid.focus();
    }

    return isValid;
  }

  /**
   * Set up inline validation listeners
   */
  function setupInlineValidation() {
    const fieldsToValidate = ['email', 'name', 'address1', 'city', 'state', 'postalCode'];

    for (const fieldId of fieldsToValidate) {
      const field = document.getElementById(fieldId);
      if (!field) continue;

      // Validate on blur
      field.addEventListener('blur', () => {
        if (field.value.trim()) {
          validateField(fieldId);
        }
      });

      // Clear error on input (while typing) and save state
      field.addEventListener('input', () => {
        const errorEl = document.getElementById(`${fieldId}-error`);
        if (errorEl && errorEl.classList.contains('is-visible')) {
          // Re-validate if there's currently an error showing
          validateField(fieldId);
        }
        saveShippingFormState(); // Save state on every input
      });
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

  /**
   * Create skeleton loader HTML for order summary
   */
  function createSkeletonLoader(itemCount) {
    let html = '';
    for (let i = 0; i < itemCount; i++) {
      html += `
        <div class="skeleton-item">
          <div class="skeleton skeleton-image"></div>
          <div class="skeleton-content">
            <div class="skeleton skeleton-line skeleton-line--medium"></div>
            <div class="skeleton skeleton-line skeleton-line--short"></div>
          </div>
          <div class="skeleton skeleton-price"></div>
        </div>
      `;
    }
    return html;
  }

  /**
   * Render the order summary sidebar
   */
  async function renderOrderSummary() {
    const cart = loadCart();
    if (!cart.items.length || !els.orderSummaryItems) return;

    // Show skeleton loaders while loading
    els.orderSummaryItems.innerHTML = createSkeletonLoader(cart.items.length);

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

    // Store for payment button
    cartSubtotalCents = subtotalCents;
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
    if (loading) {
      els.continueToPayment?.classList.add('is-loading');
      els.submitPayment?.classList.add('is-loading');
    } else {
      els.continueToPayment?.classList.remove('is-loading');
      els.submitPayment?.classList.remove('is-loading');
    }
    if (els.continueToPayment) els.continueToPayment.disabled = loading;
    if (els.submitPayment) els.submitPayment.disabled = loading;
    if (els.loading) els.loading.hidden = true; // Hide the old generic loader
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
      const billingDetails = {
        name: currentContactDetails.name,
        email: currentContactDetails.email,
        address: {
          line1: currentShippingDetails.address1,
          line2: currentShippingDetails.address2,
          city: currentShippingDetails.city,
          state: currentShippingDetails.state,
          postal_code: currentShippingDetails.postalCode,
          country: currentShippingDetails.country,
        },
      };

      paymentElement = elements.create('payment', {
        defaultValues: {
          billingDetails: billingDetails,
        }
      });
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

    // Run inline validation
    if (!validateShippingForm()) {
      return;
    }

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

    currentShippingDetails = shippingDetails; // Store globally
    currentContactDetails = contactDetails;   // Store globally

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

    // Update payment button with total amount
    if (els.submitPayment && cartSubtotalCents > 0) {
      els.submitPayment.textContent = `Pay ${formatMoney(cartSubtotalCents)}`;
    }

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

  // Canadian provinces for dynamic state/province dropdown
  const CA_PROVINCES = [
    { value: '', label: 'Select province...' },
    { value: 'AB', label: 'Alberta' },
    { value: 'BC', label: 'British Columbia' },
    { value: 'MB', label: 'Manitoba' },
    { value: 'NB', label: 'New Brunswick' },
    { value: 'NL', label: 'Newfoundland and Labrador' },
    { value: 'NS', label: 'Nova Scotia' },
    { value: 'NT', label: 'Northwest Territories' },
    { value: 'NU', label: 'Nunavut' },
    { value: 'ON', label: 'Ontario' },
    { value: 'PE', label: 'Prince Edward Island' },
    { value: 'QC', label: 'Quebec' },
    { value: 'SK', label: 'Saskatchewan' },
    { value: 'YT', label: 'Yukon' }
  ];

  // Store original US states HTML for switching back
  let originalStateHTML = '';

  /**
   * Update the state/province field based on selected country
   */
  function handleCountryChange(countryCode) {
    const stateField = document.getElementById('state');
    const stateLabel = document.getElementById('state-label');
    const stateContainer = stateField?.parentElement;

    if (!stateField || !stateContainer) return;

    // Store original HTML on first call
    if (!originalStateHTML && stateField.tagName === 'SELECT') {
      originalStateHTML = stateField.outerHTML;
    }

    if (countryCode === 'US') {
      // Restore US states dropdown
      if (stateField.tagName !== 'SELECT' || !stateField.innerHTML.includes('Alabama')) {
        stateContainer.innerHTML = `
          <label for="state" id="state-label">State *</label>
          ${originalStateHTML}
        `;
      }
    } else if (countryCode === 'CA') {
      // Switch to Canadian provinces
      const options = CA_PROVINCES.map(p =>
        `<option value="${p.value}">${p.label}</option>`
      ).join('');
      stateContainer.innerHTML = `
        <label for="state" id="state-label">Province *</label>
        <select id="state" name="state" autocomplete="address-level1" required class="form-input form-select">
          ${options}
        </select>
      `;
    } else {
      // Switch to text input for other countries
      stateContainer.innerHTML = `
        <label for="state" id="state-label">State / Province / Region</label>
        <input type="text" id="state" name="state" autocomplete="address-level1" class="form-input" placeholder="Optional">
      `;
      // Remove required for other countries
      const newStateField = document.getElementById('state');
      if (newStateField) newStateField.removeAttribute('required');
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

    // Update estimated delivery
    updateEstimatedDelivery();

    // Set up inline form validation
    setupInlineValidation();

    // Load any previously saved shipping form state
    loadShippingFormState();

    // Set up country change handler
    const countrySelect = document.getElementById('country');
    if (countrySelect) {
      // Store original state HTML
      const stateField = document.getElementById('state');
      if (stateField) originalStateHTML = stateField.outerHTML;

      countrySelect.addEventListener('change', (e) => {
        handleCountryChange(e.target.value);
      });
    }

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

    // Set up promo code toggle
    const promoToggle = document.getElementById('promo-code-toggle');
    const promoSection = document.getElementById('promo-code-section');
    const promoForm = document.getElementById('promo-code-form');
    const promoInput = document.getElementById('promo-code-input');
    const promoApply = document.getElementById('promo-code-apply');
    const promoMessage = document.getElementById('promo-code-message');

    if (promoToggle && promoForm && promoSection) {
      promoToggle.addEventListener('click', () => {
        const isOpen = !promoForm.hidden;
        promoForm.hidden = isOpen;
        promoSection.classList.toggle('is-open', !isOpen);
        if (!isOpen && promoInput) {
          promoInput.focus();
        }
      });
    }

    if (promoApply && promoInput && promoMessage) {
      promoApply.addEventListener('click', () => {
        const code = promoInput.value.trim();
        if (!code) {
          promoMessage.textContent = 'Please enter a promo code';
          promoMessage.className = 'promo-code-message is-error';
          return;
        }
        // For now, show that promo codes are coming soon
        promoMessage.textContent = 'Promo codes coming soon! Stay tuned for exclusive discounts.';
        promoMessage.className = 'promo-code-message is-error';
      });

      promoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          promoApply.click();
        }
      });
    }
  });
})();

