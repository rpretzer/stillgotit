/**
 * Cloudflare Worker: Stripe + Printful Merch Backend
 * 
 * Routes:
 * - POST /api/checkout - Create Stripe PaymentIntent and order
 * - POST /api/stripe/webhook - Handle Stripe webhooks
 * - GET /api/products - Serve product catalog (from D1 or static JSON)
 * - GET /api/orders/:id - Get order status
 * - POST /api/carts/abandoned - Save abandoned cart
 * - GET /api/carts/recover/:token - Get cart by recovery token
 * - POST /api/carts/recover/:token - Mark cart as recovered
 * - POST /api/sync/products - Sync Printful products (manual trigger)
 * 
 * Cron Triggers:
 * - Daily at 2 AM UTC: Sync Printful products
 */

type Env = {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PRINTFUL_TOKEN: string;
  SITE_BASE_URL: string;
  MERCH_CATALOG_URL: string;
  SYNC_SECRET_TOKEN?: string; // Optional secret for securing sync endpoint
};

type MerchCatalog = {
  currency?: string;
  products?: Array<{
    id: string;
    name?: string;
    description?: string;
    priceCents: number;
    image?: string;
    mockups?: string[];
    variants?: Array<{ id: string; label?: string; printfulVariantId?: number; priceCents?: number }>;
    fulfillment?: { type?: 'printful' | 'manual' | string; printfulVariantId?: number };
  }>;
};

type OrderRow = {
  id: string;
  email: string;
  name: string;
  shipping_address1: string;
  shipping_address2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_country: string;
  currency: string;
  subtotal_cents: number;
  status: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  printful_order_id: number | null;
  printful_status: string | null;
  last_error: string | null;
  manual_review_reason: string | null;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  price_cents: number;
  created_at: string;
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers || {})
    }
  });
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '*';
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  };
}

// Validation helpers

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  // Basic email validation - allows most valid emails without being overly strict
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Valid ISO 3166-1 alpha-2 country codes supported by Printful
 * (subset of commonly used countries for shipping)
 */
const VALID_COUNTRY_CODES = new Set([
  'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE',
  'NO', 'DK', 'FI', 'IE', 'PT', 'PL', 'CZ', 'GR', 'HU', 'RO', 'BG', 'SK', 'SI',
  'HR', 'EE', 'LV', 'LT', 'LU', 'MT', 'CY', 'NZ', 'JP', 'KR', 'SG', 'HK', 'MX',
  'BR', 'AR', 'CL', 'CO', 'IN', 'ZA', 'IL', 'AE', 'SA', 'TR', 'MY', 'TH', 'PH',
  'ID', 'VN', 'TW'
]);

/**
 * Normalize and validate country code
 */
function normalizeCountryCode(country: string): string | null {
  const normalized = String(country || '').toUpperCase().trim();

  // Handle common variations
  if (normalized === 'USA' || normalized === 'UNITED STATES') return 'US';
  if (normalized === 'UK' || normalized === 'UNITED KINGDOM') return 'GB';
  if (normalized === 'CAN' || normalized === 'CANADA') return 'CA';

  if (VALID_COUNTRY_CODES.has(normalized)) return normalized;
  return null;
}

/**
 * Validate US ZIP code format (5 digits or ZIP+4)
 */
function isValidUSZip(zip: string): boolean {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zip.trim());
}

/**
 * Validate Canadian postal code format (A1A 1A1)
 */
function isValidCAPostal(postal: string): boolean {
  const postalRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
  return postalRegex.test(postal.trim());
}

/**
 * Validate postal code based on country
 */
function isValidPostalCode(postalCode: string, countryCode: string): boolean {
  const normalized = postalCode.trim();
  if (!normalized) return false;

  switch (countryCode) {
    case 'US':
      return isValidUSZip(normalized);
    case 'CA':
      return isValidCAPostal(normalized);
    default:
      // For other countries, just check it's not empty and reasonable length
      return normalized.length >= 2 && normalized.length <= 20;
  }
}

/**
 * Validate US state code (2-letter abbreviation)
 */
const VALID_US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL',
  'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT',
  'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR',
  'VI', 'GU', 'AS', 'MP'
]);

function isValidUSState(state: string): boolean {
  return VALID_US_STATES.has(state.toUpperCase().trim());
}

async function fetchCatalog(env: Env): Promise<MerchCatalog> {
  // Try to get products from D1 first (synced from Printful)
  const dbProducts = await env.DB.prepare(`
    SELECT * FROM products 
    WHERE active = 1 
    ORDER BY printful_product_id, variant_label
  `).all<{
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    mockup_urls: string | null;
    currency: string;
    price_cents: number;
    fulfillment_type: string;
    printful_product_id: number | null;
    printful_variant_id: number | null;
    variant_label: string | null;
  }>();

  if (dbProducts.results && dbProducts.results.length > 0) {
    // Group variants by product
    const productMap = new Map<string, {
      id: string;
      name: string;
      description?: string;
      priceCents: number;
      image?: string;
      mockups?: string[];
      variants: Array<{ id: string; label?: string; printfulVariantId?: number; priceCents?: number }>;
      fulfillment: { type: string };
    }>();

    for (const p of dbProducts.results) {
      const productId = `pf-${p.printful_product_id}`;
      
      if (!productMap.has(productId)) {
        // Parse mockup_urls JSON array
        let mockups: string[] | undefined;
        if (p.mockup_urls) {
          try {
            mockups = JSON.parse(p.mockup_urls);
          } catch {
            mockups = undefined;
          }
        }

        productMap.set(productId, {
          id: productId,
          name: p.name,
          description: p.description || undefined,
          priceCents: p.price_cents,
          image: p.image_url || undefined,
          mockups: mockups && mockups.length > 0 ? mockups : undefined,
          variants: [],
          fulfillment: { type: p.fulfillment_type }
        });
      }

      const product = productMap.get(productId)!;
      if (p.variant_label && p.printful_variant_id) {
        product.variants.push({
          id: `${productId}-${p.printful_variant_id}`,
          label: p.variant_label,
          printfulVariantId: p.printful_variant_id,
          priceCents: p.price_cents
        });
      }
    }

    return {
      currency: 'USD',
      products: Array.from(productMap.values())
    };
  }

  // Fallback to static JSON catalog
  const res = await fetch(env.MERCH_CATALOG_URL, { cf: { cacheTtl: 60 } as any });
  if (!res.ok) throw new Error(`Catalog fetch failed (${res.status})`);
  return (await res.json()) as MerchCatalog;
}

function safeQty(n: unknown) {
  const q = Math.floor(Number(n) || 0);
  return Math.max(1, Math.min(20, q));
}

// Stripe API helpers
async function createPaymentIntent(
  env: Env,
  amountCents: number,
  currency: string,
  metadata: Record<string, string>
): Promise<{ clientSecret: string; id: string }> {
  const params = new URLSearchParams();
  params.set('amount', String(amountCents));
  params.set('currency', currency.toLowerCase());
  if (metadata.orderId) params.set('metadata[orderId]', metadata.orderId);
  // Restrict to card payments only (no Cash App, Klarna, Amazon Pay, etc.)
  params.append('payment_method_types[]', 'card');

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error (${res.status})`);
  return { clientSecret: data.client_secret, id: data.id };
}

async function verifyStripeWebhook(
  env: Env,
  body: string,
  signature: string
): Promise<any> {
  // Verify Stripe webhook signature using HMAC-SHA256
  const secret = env.STRIPE_WEBHOOK_SECRET;
  
  // Parse Stripe signature header (format: t=timestamp,v1=signature,v1=signature,...)
  const parts = signature.split(',').map(s => s.trim());
  let timestamp: string | null = null;
  const signatures: string[] = [];
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    else if (key?.startsWith('v')) signatures.push(value);
  }
  
  if (!timestamp || signatures.length === 0) {
    throw new Error('Invalid signature format');
  }
  
  // Create signed payload
  const signedPayload = `${timestamp}.${body}`;
  
  // Verify each signature (Stripe may send multiple for different versions)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  let isValid = false;
  for (const sig of signatures) {
    try {
      const sigBytes = hexToArrayBuffer(sig);
      const valid = await crypto.subtle.verify(
    'HMAC',
    cryptoKey,
        sigBytes,
    new TextEncoder().encode(signedPayload)
      );
      if (valid) {
        isValid = true;
        break;
      }
    } catch {
      // Continue to next signature
    }
  }

  if (!isValid) {
    throw new Error('Invalid webhook signature');
  }
  
  // Check timestamp (prevent replay attacks - allow 5 minute window)
  const eventTime = parseInt(timestamp, 10) * 1000;
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  if (Math.abs(now - eventTime) > fiveMinutes) {
    throw new Error('Webhook timestamp too old or too far in future');
  }

  return JSON.parse(body);
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

// Printful API helper
async function createPrintfulOrder(
  env: Env,
  orderId: string,
  recipient: {
    name: string;
    email: string;
    address1: string;
    address2?: string;
    city: string;
    state_code: string;
    country_code: string;
    zip: string;
  },
  items: Array<{ sync_variant_id: number; quantity: number }>
): Promise<{ id: number; status: string }> {
  const res = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      external_id: orderId,
      recipient,
      items
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.result?.error || data?.error?.message || `Printful error (${res.status})`;
    throw new Error(msg);
  }
  return data.result;
}

// D1 Database helpers
async function createOrder(env: Env, order: {
  id: string;
  email: string;
  name: string;
  shipping_address1: string;
  shipping_address2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_country: string;
  currency: string;
  subtotal_cents: number;
  stripe_payment_intent_id: string;
}): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO orders (
      id, email, name,
      shipping_address1, shipping_address2, shipping_city, shipping_state,
      shipping_postal_code, shipping_country,
      currency, subtotal_cents, status, stripe_payment_intent_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `).bind(
    order.id, order.email, order.name,
    order.shipping_address1, order.shipping_address2, order.shipping_city, order.shipping_state,
    order.shipping_postal_code, order.shipping_country,
    order.currency, order.subtotal_cents, order.stripe_payment_intent_id
  ).run();
}

async function createOrderItems(env: Env, orderId: string, items: Array<{
  product_id: string;
  variant_id: string | null;
  quantity: number;
  price_cents: number;
}>): Promise<void> {
  const stmt = env.DB.prepare(`
    INSERT INTO order_items (id, order_id, product_id, variant_id, quantity, price_cents)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const it of items) {
    await stmt.bind(crypto.randomUUID(), orderId, it.product_id, it.variant_id, it.quantity, it.price_cents).run();
  }
}

async function getOrder(env: Env, orderId: string): Promise<OrderRow | null> {
  const row = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first<OrderRow>();
  return row || null;
}

/**
 * Wait for an order to appear in the database with exponential backoff.
 * This handles the race condition where a webhook arrives before the checkout
 * API has finished creating the order in the database.
 * @param env - Environment bindings
 * @param orderId - Order ID to look up
 * @param maxAttempts - Maximum number of retry attempts (default: 5)
 * @param initialDelayMs - Initial delay in milliseconds (default: 100ms)
 * @returns The order if found, null if not found after all attempts
 */
async function waitForOrder(env: Env, orderId: string, maxAttempts = 5, initialDelayMs = 100): Promise<OrderRow | null> {
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const order = await getOrder(env, orderId);
    if (order) return order;

    // Don't wait after the last attempt
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 2000); // Exponential backoff, max 2 seconds
    }
  }

  return null;
}

async function getOrderItems(env: Env, orderId: string): Promise<OrderItemRow[]> {
  const { results } = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(orderId).all<OrderItemRow>();
  return results || [];
}

async function updateOrderStatus(
  env: Env,
  orderId: string,
  status: string,
  updates: {
    stripe_charge_id?: string;
    printful_order_id?: number;
    printful_status?: string;
    last_error?: string | null;
    manual_review_reason?: string | null;
  } = {}
): Promise<void> {
  const fields: string[] = ['status = ?'];
  const values: any[] = [status];

  if (updates.stripe_charge_id !== undefined) {
    fields.push('stripe_charge_id = ?');
    values.push(updates.stripe_charge_id);
  }
  if (updates.printful_order_id !== undefined) {
    fields.push('printful_order_id = ?');
    values.push(updates.printful_order_id);
  }
  if (updates.printful_status !== undefined) {
    fields.push('printful_status = ?');
    values.push(updates.printful_status);
  }
  if (updates.last_error !== undefined) {
    fields.push('last_error = ?');
    values.push(updates.last_error);
  }
  if (updates.manual_review_reason !== undefined) {
    fields.push('manual_review_reason = ?');
    values.push(updates.manual_review_reason);
  }

  values.push(orderId);
  await env.DB.prepare(`UPDATE orders SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...values).run();
}

async function addOrderEvent(env: Env, orderId: string, status: string, message: string): Promise<void> {
  await env.DB.prepare(`
    INSERT INTO order_events (id, order_id, status, message, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).bind(crypto.randomUUID(), orderId, status, message).run();
}

// Route handlers
async function handleCheckout(req: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(req);
  const body = await req.json().catch(() => null) as any;

  const currency = String(body?.currency || 'USD');
  const items = Array.isArray(body?.items) ? body.items : [];
  const shippingDetails = body?.shippingDetails || {};
  const contactDetails = body?.contactDetails || {};

  // Basic required field validation
  if (!items.length) return json({ error: 'Cart is empty.' }, { status: 400, headers: cors });
  if (!shippingDetails.address1 || !shippingDetails.city || !shippingDetails.state || !shippingDetails.postalCode) {
    return json({ error: 'Shipping address required.' }, { status: 400, headers: cors });
  }
  if (!contactDetails.email || !contactDetails.name) {
    return json({ error: 'Email and name required.' }, { status: 400, headers: cors });
  }

  // Email format validation
  const email = String(contactDetails.email).trim();
  if (!isValidEmail(email)) {
    return json({ error: 'Please enter a valid email address.' }, { status: 400, headers: cors });
  }

  // Name validation (basic sanity check)
  const name = String(contactDetails.name).trim();
  if (name.length < 2 || name.length > 100) {
    return json({ error: 'Please enter a valid name.' }, { status: 400, headers: cors });
  }

  // Country code normalization and validation
  const countryCode = normalizeCountryCode(shippingDetails.country || 'US');
  if (!countryCode) {
    return json({ error: 'Invalid or unsupported country. Please select a valid country.' }, { status: 400, headers: cors });
  }

  // State validation for US orders
  const state = String(shippingDetails.state).trim().toUpperCase();
  if (countryCode === 'US' && !isValidUSState(state)) {
    return json({ error: 'Please enter a valid US state abbreviation (e.g., CA, NY, TX).' }, { status: 400, headers: cors });
  }

  // Postal code validation
  const postalCode = String(shippingDetails.postalCode).trim();
  if (!isValidPostalCode(postalCode, countryCode)) {
    if (countryCode === 'US') {
      return json({ error: 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789).' }, { status: 400, headers: cors });
    } else if (countryCode === 'CA') {
      return json({ error: 'Please enter a valid Canadian postal code (e.g., A1A 1A1).' }, { status: 400, headers: cors });
    } else {
      return json({ error: 'Please enter a valid postal code.' }, { status: 400, headers: cors });
    }
  }

  // Address validation (basic sanity checks)
  const address1 = String(shippingDetails.address1).trim();
  if (address1.length < 3 || address1.length > 200) {
    return json({ error: 'Please enter a valid street address.' }, { status: 400, headers: cors });
  }

  const city = String(shippingDetails.city).trim();
  if (city.length < 2 || city.length > 100) {
    return json({ error: 'Please enter a valid city.' }, { status: 400, headers: cors });
  }

  const catalog = await fetchCatalog(env);
  const byId = new Map((catalog.products || []).map((p) => [p.id, p]));

  let subtotalCents = 0;
  const orderItems: Array<{ product_id: string; variant_id: string | null; quantity: number; price_cents: number }> = [];
  const printfulItems: Array<{ sync_variant_id: number; quantity: number }> = [];

  for (const it of items) {
    const productId = String(it?.productId || '');
    const variantId = it?.variantId ? String(it.variantId) : null;
    const qty = safeQty(it?.qty);

    const p = byId.get(productId);
    if (!p) return json({ error: `Unknown product: ${productId}` }, { status: 400, headers: cors });

    const priceCents = Number(p.priceCents) || 0;
    subtotalCents += priceCents * qty;

    orderItems.push({ product_id: productId, variant_id: variantId, quantity: qty, price_cents: priceCents });

    // Collect Printful items if applicable
    if (p.fulfillment?.type === 'printful' || (!p.fulfillment?.type && variantId)) {
      const variant = p.variants?.find(v => v.id === variantId);
      const printfulVariantId = variant?.printfulVariantId || p.fulfillment?.printfulVariantId;
      if (printfulVariantId) {
        printfulItems.push({ sync_variant_id: Number(printfulVariantId), quantity: qty });
      }
    }
  }

  const orderId = crypto.randomUUID();

  try {
    // Create Stripe PaymentIntent
    const { clientSecret, id: paymentIntentId } = await createPaymentIntent(
      env,
      subtotalCents,
      currency,
      { orderId }
    );

    // Create order in D1 (using validated/normalized values)
    await createOrder(env, {
      id: orderId,
      email,
      name,
      shipping_address1: address1,
      shipping_address2: String(shippingDetails.address2 || '').trim() || null,
      shipping_city: city,
      shipping_state: state,
      shipping_postal_code: postalCode,
      shipping_country: countryCode,
      currency,
      subtotal_cents: subtotalCents,
      stripe_payment_intent_id: paymentIntentId
    });

    await createOrderItems(env, orderId, orderItems);
    await addOrderEvent(env, orderId, 'PENDING', 'Order created, payment pending');

    return json({ clientSecret, orderId }, { status: 200, headers: cors });
  } catch (err: any) {
    return json({ error: err?.message || 'Checkout failed.' }, { status: 500, headers: cors });
  }
}

async function handleStripeWebhook(req: Request, env: Env): Promise<Response> {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing signature' }, { status: 400 });

  const body = await req.text();

  let event: any;
  try {
    // Verify webhook signature
    event = await verifyStripeWebhook(env, body, signature);
  } catch (err: any) {
    console.error('Webhook verification failed:', err);
    return json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const orderId = pi?.metadata?.orderId;
    if (!orderId) {
      console.warn('Webhook received payment_intent.succeeded without orderId in metadata');
      return json({ received: true }, { status: 200 });
    }

    // Wait for order to appear in database (handles race condition where webhook
    // arrives before checkout API finishes creating the order)
    const order = await waitForOrder(env, orderId);
    if (!order) {
      console.error(`Order ${orderId} not found after retries - webhook may have arrived before order creation completed`);
      // Return 200 to prevent Stripe from retrying - the order may never exist
      // (e.g., user abandoned checkout before database write completed)
      return json({ received: true, warning: 'Order not found' }, { status: 200 });
    }

    // Idempotency: skip if already processed (prevents duplicate Printful orders)
    if (order.printful_order_id) {
      console.log(`Order ${orderId} already fulfilled with Printful order ${order.printful_order_id}`);
      return json({ received: true }, { status: 200 });
    }

    // Additional idempotency check: skip if order is already past PENDING status
    // This prevents reprocessing if webhook is retried after partial processing
    if (order.status !== 'PENDING') {
      console.log(`Order ${orderId} already in status ${order.status}, skipping webhook processing`);
      return json({ received: true }, { status: 200 });
    }

    try {
      // Mark as PAID
      await updateOrderStatus(env, orderId, 'PAID', { stripe_charge_id: pi.charge || null });
      await addOrderEvent(env, orderId, 'PAID', 'Payment confirmed');

      // Get order items and create Printful order
      const items = await getOrderItems(env, orderId);
      const catalog = await fetchCatalog(env);
      const byId = new Map((catalog.products || []).map((p) => [p.id, p]));

      const printfulItems: Array<{ sync_variant_id: number; quantity: number }> = [];
      for (const it of items) {
        const p = byId.get(it.product_id);
        if (!p || p.fulfillment?.type === 'manual') continue;

        const variant = p.variants?.find(v => v.id === it.variant_id);
        const printfulVariantId = variant?.printfulVariantId || p.fulfillment?.printfulVariantId;
        if (printfulVariantId) {
          printfulItems.push({ sync_variant_id: Number(printfulVariantId), quantity: it.quantity });
        }
      }

      if (printfulItems.length > 0) {
        const pfOrder = await createPrintfulOrder(env, orderId, {
          name: order.name,
          email: order.email,
          address1: order.shipping_address1,
          address2: order.shipping_address2 || undefined,
          city: order.shipping_city,
          state_code: order.shipping_state,
          country_code: order.shipping_country,
          zip: order.shipping_postal_code
        }, printfulItems);

        await updateOrderStatus(env, orderId, 'FULFILLMENT_SUBMITTED', {
          printful_order_id: pfOrder.id,
          printful_status: pfOrder.status
        });
        await addOrderEvent(env, orderId, 'FULFILLMENT_SUBMITTED', `Printful order created: ${pfOrder.id}`);
      } else {
        await updateOrderStatus(env, orderId, 'PAID', {});
        await addOrderEvent(env, orderId, 'PAID', 'No Printful items; manual fulfillment required');
      }
    } catch (err: any) {
      await updateOrderStatus(env, orderId, 'MANUAL_REVIEW', {
        last_error: err?.message || 'Fulfillment failed',
        manual_review_reason: err?.message || 'Fulfillment failed'
      });
      await addOrderEvent(env, orderId, 'MANUAL_REVIEW', `Error: ${err?.message || 'Fulfillment failed'}`);
    }
  }

  return json({ received: true }, { status: 200 });
}

async function handleGetProducts(req: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(req);
  try {
    const catalog = await fetchCatalog(env);
    return json(catalog, { status: 200, headers: cors });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to load catalog' }, { status: 500, headers: cors });
  }
}

// Printful product sync functions
async function syncPrintfulProducts(env: Env): Promise<{ synced: number; updated: number; unchanged: number; errors: string[]; changes: string[] }> {
  const errors: string[] = [];
  const changes: string[] = [];
  let synced = 0;
  let updated = 0;
  let unchanged = 0;

  // Track all synced product IDs to identify discontinued products
  const syncedProductIds = new Set<string>();

  try {
    // Fetch store products from Printful
    const listRes = await fetch('https://api.printful.com/store/products', {
      headers: {
        'Authorization': `Bearer ${env.PRINTFUL_TOKEN}`
      }
    });

    if (!listRes.ok) {
      const error = await listRes.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to fetch Printful products: ${error.error?.message || error.error || listRes.statusText}`);
    }

    const listData = await listRes.json();
    const storeProducts = listData.result || [];

    // Fetch details for each product and sync variants
    for (const sp of storeProducts) {
      try {
        const detailsRes = await fetch(`https://api.printful.com/store/products/${sp.id}`, {
          headers: {
            'Authorization': `Bearer ${env.PRINTFUL_TOKEN}`
          }
        });

        if (!detailsRes.ok) {
          errors.push(`Failed to fetch details for product ${sp.id}`);
          continue;
        }

        const detailsData = await detailsRes.json();
        const details = detailsData.result;
        const syncProduct = details.sync_product || {};
        const syncVariants = details.sync_variants || [];

        // Collect all unique mockup image URLs from variant files
        // Printful provides multiple mockup views (front, back, etc.) in the files array
        const mockupUrls = new Set<string>();
        for (const variant of syncVariants) {
          const files = variant.files || [];
          for (const file of files) {
            // A 'default' type often represents the primary mockup for a given view (e.g., front).
            // Include 'mockup' and 'preview' types, and check both preview_url and url.
            if ((file.type === 'preview' || file.type === 'mockup' || file.type === 'default') && (file.preview_url || file.url)) {
              mockupUrls.add(file.preview_url || file.url);
            }
          }
        }
        const mockupUrlsJson = mockupUrls.size > 0 ? JSON.stringify(Array.from(mockupUrls)) : null;

        // Upsert each variant as a product row
        for (const variant of syncVariants) {
          const productId = `pf-${syncProduct.id}-${variant.id}`;
          const priceCents = Math.round(Number(variant.retail_price || '0') * 100);
          const variantLabel = variant.name || `Variant ${variant.id}`;
          const newName = variant.name || syncProduct.name || 'Unknown Product';
          const newDescription = syncProduct.description || null;
          const newImageUrl = syncProduct.thumbnail_url || sp.thumbnail_url || null;
          const newCurrency = variant.currency || 'USD';

          // Track this product ID as synced (exists in Printful)
          syncedProductIds.add(productId);

          try {
            // Check if product exists and compare values
            const existing = await env.DB.prepare(`
              SELECT id, name, description, image_url, mockup_urls, currency, price_cents,
                     active, printful_product_id, printful_variant_id, variant_label
              FROM products WHERE id = ?
            `).bind(productId).first<{
              id: string;
              name: string;
              description: string | null;
              image_url: string | null;
              mockup_urls: string | null;
              currency: string;
              price_cents: number;
              active: number;
              printful_product_id: number;
              printful_variant_id: number;
              variant_label: string;
            }>();

            let hasChanges = false;
            const changeList: string[] = [];

            if (existing) {
              // Check for differences
              if (existing.price_cents !== priceCents) {
                hasChanges = true;
                changeList.push(`price: $${existing.price_cents/100} -> $${priceCents/100}`);
              }
              if (existing.mockup_urls !== mockupUrlsJson) {
                hasChanges = true;
                const oldCount = existing.mockup_urls ? JSON.parse(existing.mockup_urls).length : 0;
                const newCount = mockupUrlsJson ? JSON.parse(mockupUrlsJson).length : 0;
                changeList.push(`mockups: ${oldCount} -> ${newCount} images`);
              }
              if (existing.name !== newName) {
                hasChanges = true;
                changeList.push(`name: "${existing.name}" -> "${newName}"`);
              }
              if (existing.image_url !== newImageUrl) {
                hasChanges = true;
                changeList.push(`image_url changed`);
              }
              if (existing.description !== newDescription) {
                hasChanges = true;
                changeList.push(`description changed`);
              }

              if (hasChanges) {
                changes.push(`${productId}: ${changeList.join(', ')}`);
                updated++;
              } else {
                unchanged++;
              }
            } else {
              // New product
              changes.push(`${productId}: NEW product (price: $${priceCents/100}, mockups: ${mockupUrlsJson ? JSON.parse(mockupUrlsJson).length : 0})`);
            }

            // Perform upsert
            await env.DB.prepare(`
              INSERT INTO products (
                id, name, description, image_url, mockup_urls, currency, price_cents,
                active, fulfillment_type, printful_product_id, printful_variant_id,
                variant_label, updated_at, last_synced_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                image_url = excluded.image_url,
                mockup_urls = excluded.mockup_urls,
                currency = excluded.currency,
                price_cents = excluded.price_cents,
                active = excluded.active,
                fulfillment_type = excluded.fulfillment_type,
                printful_product_id = excluded.printful_product_id,
                printful_variant_id = excluded.printful_variant_id,
                variant_label = excluded.variant_label,
                updated_at = datetime('now'),
                last_synced_at = datetime('now')
            `).bind(
              productId,
              newName,
              newDescription,
              newImageUrl,
              mockupUrlsJson,
              newCurrency,
              priceCents,
              1, // active
              'printful',
              syncProduct.id,
              variant.id,
              variantLabel
            ).run();

            synced++;
          } catch (err: any) {
            errors.push(`Failed to sync variant ${variant.id}: ${err?.message || 'Unknown error'}`);
          }
        }
      } catch (err: any) {
        errors.push(`Failed to process product ${sp.id}: ${err?.message || 'Unknown error'}`);
      }
    }

    // Mark products that no longer exist in Printful as inactive
    // Only do this if we successfully synced at least one product (to avoid marking all inactive on API failure)
    if (syncedProductIds.size > 0) {
      try {
        // Get all currently active Printful products from the database
        const activeProducts = await env.DB.prepare(`
          SELECT id FROM products WHERE active = 1 AND fulfillment_type = 'printful'
        `).all<{ id: string }>();

        const activeDbIds = activeProducts.results || [];
        let deactivated = 0;

        // Deactivate products that exist in DB but weren't in the Printful sync
        for (const row of activeDbIds) {
          if (!syncedProductIds.has(row.id)) {
            await env.DB.prepare(`
              UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ?
            `).bind(row.id).run();
            deactivated++;
            console.log(`Deactivated discontinued product: ${row.id}`);
          }
        }

        if (deactivated > 0) {
          console.log(`Deactivated ${deactivated} discontinued products`);
        }
      } catch (err: any) {
        errors.push(`Failed to deactivate discontinued products: ${err?.message || 'Unknown error'}`);
      }
    }

    return { synced, updated, unchanged, errors, changes };
  } catch (err: any) {
    errors.push(`Sync failed: ${err?.message || 'Unknown error'}`);
    return { synced, updated, unchanged, errors, changes };
  }
}

async function handleSyncProducts(req: Request, env: Env): Promise<Response> {
  // Optional: Add basic auth or API key check here
  // For now, allow unauthenticated (you should secure this in production)
  const authHeader = req.headers.get('Authorization');
  const expectedToken = env.SYNC_SECRET_TOKEN; // Add this as an optional secret
  
  // If SYNC_SECRET_TOKEN is set, require it
  if (env.SYNC_SECRET_TOKEN && authHeader !== `Bearer ${env.SYNC_SECRET_TOKEN}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncPrintfulProducts(env);
    return json({
      success: true,
      synced: result.synced,
      updated: result.updated,
      unchanged: result.unchanged,
      errors: result.errors,
      changes: result.changes,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (err: any) {
    return json({
      success: false,
      error: err?.message || 'Sync failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

async function handleGetOrder(req: Request, env: Env, orderId: string): Promise<Response> {
  const cors = corsHeaders(req);
  const order = await getOrder(env, orderId);
  if (!order) return json({ error: 'Order not found' }, { status: 404, headers: cors });

  const items = await getOrderItems(env, orderId);
  const { results: events } = await env.DB.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC').bind(orderId).all();

  return json({
    id: order.id,
    email: order.email,
    name: order.name,
    shipping: {
      address1: order.shipping_address1,
      address2: order.shipping_address2,
      city: order.shipping_city,
      state: order.shipping_state,
      postalCode: order.shipping_postal_code,
      country: order.shipping_country
    },
    currency: order.currency,
    subtotalCents: order.subtotal_cents,
    status: order.status,
    stripePaymentIntentId: order.stripe_payment_intent_id,
    printfulOrderId: order.printful_order_id,
    printfulStatus: order.printful_status,
    items: items.map(it => ({
      productId: it.product_id,
      variantId: it.variant_id,
      quantity: it.quantity,
      priceCents: it.price_cents
    })),
    events: events || [],
    createdAt: order.created_at,
    updatedAt: order.updated_at
  }, { status: 200, headers: cors });
}

async function saveAbandonedCart(env: Env, email: string | null, cartData: string, subtotalCents: number, currency: string): Promise<string> {
  // Rate limiting: if email provided, check for recent saves (max 1 per hour)
  if (email) {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const recent = await env.DB.prepare(`
      SELECT id FROM abandoned_carts 
      WHERE email = ? AND last_updated > ?
      LIMIT 1
    `).bind(email, oneHourAgo.toISOString()).first();
    
    if (recent) {
      // Update existing cart instead of creating new one
      const existing = await env.DB.prepare(`
        SELECT recovery_token FROM abandoned_carts 
        WHERE email = ? AND recovered_at IS NULL
        ORDER BY last_updated DESC LIMIT 1
      `).bind(email).first<{ recovery_token: string }>();
      
      if (existing?.recovery_token) {
        await env.DB.prepare(`
          UPDATE abandoned_carts 
          SET cart_data = ?, subtotal_cents = ?, last_updated = datetime('now')
          WHERE recovery_token = ?
        `).bind(cartData, subtotalCents, existing.recovery_token).run();
        return existing.recovery_token;
      }
    }
  }
  
  const id = crypto.randomUUID();
  const recoveryToken = crypto.randomUUID().replace(/-/g, '');
  
  await env.DB.prepare(`
    INSERT INTO abandoned_carts (id, email, cart_data, subtotal_cents, currency, recovery_token, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      cart_data = excluded.cart_data,
      subtotal_cents = excluded.subtotal_cents,
      last_updated = datetime('now')
  `).bind(id, email, cartData, subtotalCents, currency, recoveryToken).run();
  
  return recoveryToken;
}

async function getAbandonedCartByToken(env: Env, token: string): Promise<any> {
  // Check expiration (30 days)
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() - 30);
  const expirationStr = expirationDate.toISOString();
  
  const row = await env.DB.prepare(`
    SELECT * FROM abandoned_carts 
    WHERE recovery_token = ? 
    AND recovered_at IS NULL 
    AND created_at > ?
  `).bind(token, expirationStr).first();
  return row || null;
}

async function markCartRecovered(env: Env, token: string): Promise<void> {
  await env.DB.prepare('UPDATE abandoned_carts SET recovered_at = datetime(\'now\') WHERE recovery_token = ?').bind(token).run();
}

async function handleSaveAbandonedCart(req: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(req);
  const body = await req.json().catch(() => null) as any;
  
  const email = body?.email || null;
  const items = Array.isArray(body?.items) ? body.items : [];
  const currency = String(body?.currency || 'USD');
  
  if (!items.length) {
    return json({ error: 'Cart is empty' }, { status: 400, headers: cors });
  }
  
  // Calculate subtotal
  const catalog = await fetchCatalog(env);
  const byId = new Map((catalog.products || []).map((p) => [p.id, p]));
  let subtotalCents = 0;
  for (const it of items) {
    const p = byId.get(it.productId);
    if (p) subtotalCents += (Number(p.priceCents) || 0) * (Number(it.qty) || 0);
  }
  
  const cartData = JSON.stringify(items);
  const recoveryToken = await saveAbandonedCart(env, email, cartData, subtotalCents, currency);
  
  return json({ recoveryToken, id: recoveryToken }, { status: 200, headers: cors });
}

async function handleRecoverCart(req: Request, env: Env, token: string): Promise<Response> {
  const cors = corsHeaders(req);
  const cart = await getAbandonedCartByToken(env, token);
  
  if (!cart) {
    return json({ error: 'Cart not found, expired, or already recovered' }, { status: 404, headers: cors });
  }
  
  if (req.method === 'POST') {
    // Mark as recovered
    await markCartRecovered(env, token);
    return json({ recovered: true }, { status: 200, headers: cors });
  }
  
  // GET: return cart data
  const items = JSON.parse(cart.cart_data || '[]');
  return json({
    items,
    subtotalCents: cart.subtotal_cents,
    currency: cart.currency,
    email: cart.email
  }, { status: 200, headers: cors });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    // Routes
    if (req.method === 'POST' && path === '/api/checkout') {
      try {
        return await handleCheckout(req, env);
      } catch (err: any) {
        return json({ error: err?.message || 'Checkout failed.' }, { status: 500, headers: corsHeaders(req) });
      }
    }

    if (req.method === 'POST' && path === '/api/stripe/webhook') {
      try {
        return await handleStripeWebhook(req, env);
      } catch (err: any) {
        return json({ error: err?.message || 'Webhook failed.' }, { status: 500 });
      }
    }

    if (req.method === 'GET' && path === '/api/products') {
      return await handleGetProducts(req, env);
    }

    if (req.method === 'GET' && path.startsWith('/api/orders/')) {
      const orderId = path.split('/').pop();
      if (orderId) return await handleGetOrder(req, env, orderId);
    }

    if (req.method === 'POST' && path === '/api/carts/abandoned') {
      try {
        return await handleSaveAbandonedCart(req, env);
      } catch (err: any) {
        return json({ error: err?.message || 'Failed to save cart' }, { status: 500, headers: corsHeaders(req) });
      }
    }

    if ((req.method === 'GET' || req.method === 'POST') && path.startsWith('/api/carts/recover/')) {
      const token = path.split('/').pop();
      if (token) return await handleRecoverCart(req, env, token);
    }

    if (req.method === 'POST' && path === '/api/sync/products') {
      return await handleSyncProducts(req, env);
    }

    return json({ error: 'Not found' }, { status: 404 });
  },

  // Cron trigger handler (runs daily at 2 AM UTC)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      syncPrintfulProducts(env).then(result => {
        console.log(`[Cron] Product sync completed: ${result.synced} products synced, ${result.updated} updated, ${result.unchanged} unchanged, ${result.errors.length} errors`);
        if (result.changes.length > 0) {
          console.log('[Cron] Changes detected:', result.changes.slice(0, 10)); // Log first 10 changes
        }
        if (result.errors.length > 0) {
          console.error('[Cron] Sync errors:', result.errors);
        }
      }).catch(err => {
        console.error('[Cron] Sync failed:', err);
      })
    );
  }
};
