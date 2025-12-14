import { Router } from 'express';
import { requireBasicAuth } from '../auth/basicAuth.js';
import { prisma } from '../prisma.js';
import { printful } from '../printful/client.js';
import { submitOrderToPrintful, syncPrintfulOrderStatus } from '../fulfillment/printfulFulfillment.js';
import { addOrderEvent } from '../orders/status.js';
import { OrderStatus, FulfillmentType } from '@prisma/client';

export const adminRouter = Router();
adminRouter.use(requireBasicAuth);

adminRouter.get('/orders', async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { items: { include: { product: true } }, events: { orderBy: { createdAt: 'asc' } } }
  });
  res.json({ orders });
});

/**
 * Sync strategy (manual trigger first):
 * - Pull 5–10 Printful store products + variants
 * - Upsert into Product table, one Product row per Printful variant
 */
adminRouter.post('/sync-products', async (req, res) => {
  const limit = Number(req.query.limit || 10);
  const storeProducts = await printful.listStoreProducts(limit, 0);

  const upserts: any[] = [];
  for (const sp of storeProducts) {
    const details = await printful.getStoreProduct(sp.id);
    for (const v of details.sync_variants) {
      const slug = `pf-${v.id}`;
      upserts.push(prisma.product.upsert({
        where: { slug },
        update: {
          name: v.name,
          imageUrl: details.sync_product.thumbnail_url || sp.thumbnail_url || null,
          currency: v.currency || 'USD',
          priceCents: Math.round(Number(v.retail_price || '0') * 100),
          active: true,
          fulfillmentType: FulfillmentType.PRINTFUL,
          printfulProductId: details.sync_product.id,
          printfulVariantId: v.id
        },
        create: {
          slug,
          name: v.name,
          description: `Printful sync variant ${v.id}`,
          imageUrl: details.sync_product.thumbnail_url || sp.thumbnail_url || null,
          currency: v.currency || 'USD',
          priceCents: Math.round(Number(v.retail_price || '0') * 100),
          active: true,
          fulfillmentType: FulfillmentType.PRINTFUL,
          printfulProductId: details.sync_product.id,
          printfulVariantId: v.id
        }
      }));
    }
  }

  await prisma.$transaction(upserts);
  res.json({ ok: true, syncedProducts: upserts.length });
});

// Retry fulfillment (edge case 1)
adminRouter.post('/orders/:id/retry-fulfillment', async (req, res) => {
  const orderId = req.params.id;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (!order.stripePaymentIntentId) return res.status(409).json({ error: 'Order has no Stripe payment intent' });

  if (order.status !== OrderStatus.MANUAL_REVIEW && order.status !== OrderStatus.PAID) {
    return res.status(409).json({ error: `Order not retryable from status ${order.status}` });
  }

  const updated = await submitOrderToPrintful(orderId);
  res.json({ ok: true, order: updated });
});

// Manual poll (cron later)
adminRouter.post('/orders/:id/poll', async (req, res) => {
  await syncPrintfulOrderStatus(req.params.id);
  res.json({ ok: true });
});

// List products (admin)
adminRouter.get('/products', async (_req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ products });
});

// Mark order manual review explicitly
adminRouter.post('/orders/:id/manual-review', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  await prisma.order.update({
    where: { id: order.id },
    data: { manualReviewReason: String(req.body?.reason || 'Manual review requested') }
  });
  await addOrderEvent(order.id, OrderStatus.MANUAL_REVIEW, 'Set to manual review by admin.');
  res.json({ ok: true });
});


