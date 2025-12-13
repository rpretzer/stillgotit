## Merch backend (Cloudflare Worker)

This Worker creates **Square hosted checkout** links for the `/merch` storefront.

### Endpoints

- `POST /api/checkout` (or `POST /checkout` if you route it that way)

Body:

```json
{
  "currency": "USD",
  "items": [
    { "productId": "tee-classic", "variantId": "tee-classic-m", "qty": 1 }
  ]
}
```

Response:

```json
{ "url": "https://checkout.square.site/..." }
```

### Config

In `wrangler.toml`:
- `SITE_BASE_URL`: used for the post-payment redirect (defaults to `https://www.stillgotitcollective.com`)
- `MERCH_CATALOG_URL`: worker fetches this to validate prices server-side
- `SQUARE_ENV`: `sandbox` or `prod`

Set Square secrets:

```bash
cd workers/merch-backend
npm install

wrangler secret put SQUARE_ACCESS_TOKEN
wrangler secret put SQUARE_LOCATION_ID
```

### Run locally

```bash
cd workers/merch-backend
npm run dev
```

### Deploy

```bash
cd workers/merch-backend
npm run deploy
```

Then add a Cloudflare **route** so your site can call it as `/api/*`, e.g.:
`www.stillgotitcollective.com/api/*`


