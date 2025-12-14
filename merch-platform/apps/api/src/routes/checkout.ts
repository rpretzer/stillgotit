import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { stripe } from '../stripe.js';
import { addOrderEvent, statusMessage, OrderInclude } from '../orders/status.js';
import { OrderStatus } from '@prisma/client';

export const checkoutRouter = Router();

const CheckoutSchema = z.object({
  currency: z.string().default('USD'),
  email: z.string().email(),
  name: z.string().min(1),
  shipping: z.object({
    address1: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().default('US')
  }),
  items: z.array(z.object({
    productId: z.string().min(1),
    qty: z.number().int().min(1).max(20)
  })).min(1)
});

// Public: create PaymentIntent + Order
checkoutRouter.post('/', async (req, res) => {
  const parsed = CheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid checkout payload', issues: parsed.error.issues });
  }
  const { email, name, shipping, items, currency } = parsed.data;

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, active: true }
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  // Edge case: inventory/price changes / invalid variant
  for (const it of items) {
    if (!byId.has(it.productId)) return res.status(400).json({ error: `Invalid product: ${it.productId}` });
    const p = byId.get(it.productId)!;
    if (p.currency !== currency) return res.status(400).json({ error: `Currency mismatch for product ${p.id}` });
    if (p.fulfillmentType === 'PRINTFUL' && (!p.printfulProductId || !p.printfulVariantId || p.printfulVariantId === 0)) {
      return res.status(400).json({ error: `Product not mapped to Printful yet: ${p.slug}` });
    }
  }

  const subtotalCents = items.reduce((sum, it) => sum + (byId.get(it.productId)!.priceCents * it.qty), 0);

  const order = await prisma.order.create({
    data: {
      email,
      name,
      shippingAddress1: shipping.address1,
      shippingAddress2: shipping.address2 || null,
      shippingCity: shipping.city,
      shippingState: shipping.state,
      shippingPostalCode: shipping.postalCode,
      shippingCountry: shipping.country,
      currency,
      subtotalCents,
      status: OrderStatus.PENDING,
      items: {
        create: items.map((it) => ({
          productId: it.productId,
          quantity: it.qty,
          unitPriceCents: byId.get(it.productId)!.priceCents,
          currency
        }))
      },
      events: { create: { status: OrderStatus.PENDING, message: statusMessage(OrderStatus.PENDING) } }
    },
    include: OrderInclude
  });

  const pi = await stripe.paymentIntents.create({
    amount: subtotalCents,
    currency: currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    receipt_email: email,
    metadata: {
      orderId: order.id
    }
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripePaymentIntentId: pi.id, status: OrderStatus.PAYMENT_CREATED }
  });
  await addOrderEvent(order.id, OrderStatus.PAYMENT_CREATED, statusMessage(OrderStatus.PAYMENT_CREATED));

  return res.json({
    orderId: order.id,
    clientSecret: pi.client_secret
  });
});


