type Env = {
  SITE_BASE_URL: string;
  MERCH_CATALOG_URL: string;
  SQUARE_ENV: 'sandbox' | 'prod' | string;
  SQUARE_ACCESS_TOKEN: string;
  SQUARE_LOCATION_ID: string;
};

type MerchCatalog = {
  currency?: string;
  products?: Array<{
    id: string;
    name?: string;
    description?: string;
    priceCents: number;
    variants?: Array<{ id: string; label?: string }>;
  }>;
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
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    // prevent cache poisoning across origins
    'vary': 'Origin'
  };
}

function squareBase(env: Env) {
  return env.SQUARE_ENV === 'prod' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
}

async function fetchCatalog(env: Env): Promise<MerchCatalog> {
  const res = await fetch(env.MERCH_CATALOG_URL, { cf: { cacheTtl: 60 } as any });
  if (!res.ok) throw new Error(`Catalog fetch failed (${res.status})`);
  return (await res.json()) as MerchCatalog;
}

function safeQty(n: unknown) {
  const q = Math.floor(Number(n) || 0);
  return Math.max(1, Math.min(20, q));
}

function normalizePath(url: URL) {
  // Allow both /api/checkout and /checkout depending on routing
  return url.pathname.replace(/\/+$/, '');
}

async function handleCheckout(req: Request, env: Env) {
  const cors = corsHeaders(req);
  const body = await req.json().catch(() => null) as any;
  const currency = String(body?.currency || 'USD');
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return json({ error: 'Cart is empty.' }, { status: 400, headers: cors });

  if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_LOCATION_ID) {
    return json({ error: 'Server not configured (Square credentials missing).' }, { status: 500, headers: cors });
  }

  const catalog = await fetchCatalog(env);
  const byId = new Map((catalog.products || []).map((p) => [p.id, p]));

  const lineItems: Array<any> = [];
  for (const it of items) {
    const productId = String(it?.productId || '');
    const variantId = it?.variantId ? String(it.variantId) : '';
    const qty = safeQty(it?.qty);

    const p = byId.get(productId);
    if (!p) return json({ error: `Unknown product: ${productId}` }, { status: 400, headers: cors });

    if (variantId) {
      const ok = (p.variants || []).some((v) => v.id === variantId);
      if (!ok) return json({ error: `Unknown variant for ${productId}: ${variantId}` }, { status: 400, headers: cors });
    }

    const variantLabel = variantId
      ? (p.variants || []).find((v) => v.id === variantId)?.label || variantId
      : '';

    const name = [p.name || productId, variantLabel].filter(Boolean).join(' — ');

    lineItems.push({
      name,
      quantity: String(qty),
      base_price_money: {
        amount: Number(p.priceCents) || 0,
        currency
      },
      note: variantId ? `variant:${variantId}` : undefined
    });
  }

  const checkoutRedirect = new URL('/merch/success/', env.SITE_BASE_URL).toString();

  const payload = {
    idempotency_key: crypto.randomUUID(),
    order: {
      location_id: env.SQUARE_LOCATION_ID,
      line_items: lineItems
    },
    checkout_options: {
      ask_for_shipping_address: true,
      redirect_url: checkoutRedirect
    }
  };

  const sqRes = await fetch(`${squareBase(env)}/v2/online-checkout/payment-links`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const sq = await sqRes.json().catch(() => ({} as any)) as any;
  if (!sqRes.ok) {
    const msg = sq?.errors?.[0]?.detail || sq?.errors?.[0]?.code || `Square error (${sqRes.status})`;
    return json({ error: msg, square: sq?.errors }, { status: 502, headers: cors });
  }

  const url = sq?.payment_link?.url || sq?.payment_link?.long_url;
  if (!url) return json({ error: 'Square checkout URL missing in response.' }, { status: 502, headers: cors });

  return json({ url }, { status: 200, headers: cors });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = normalizePath(url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    if (req.method === 'POST' && (path === '/api/checkout' || path === '/checkout')) {
      try {
        return await handleCheckout(req, env);
      } catch (err: any) {
        return json({ error: err?.message || 'Checkout failed.' }, { status: 500, headers: corsHeaders(req) });
      }
    }

    return json({ ok: true }, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
};


