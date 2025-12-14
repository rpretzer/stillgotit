import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { productsRouter } from './routes/products.js';
import { checkoutRouter } from './routes/checkout.js';
import { ordersRouter } from './routes/orders.js';
import { adminRouter } from './routes/admin.js';
import { stripeWebhookHandler } from './routes/stripeWebhook.js';

const app = express();

app.use(cors({
  origin: true,
  credentials: false
}));

// Stripe webhook needs raw body for signature verification
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// JSON for all other routes
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/products', productsRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`SGIC merch API listening on ${env.API_BASE_URL} (port ${port})`);
});


