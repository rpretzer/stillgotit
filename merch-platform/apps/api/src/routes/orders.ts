import { Router } from 'express';
import { prisma } from '../prisma.js';
import { stripe } from '../stripe.js';
import { addOrderEvent, OrderInclude } from '../orders/status.js';
import { OrderStatus } from '@prisma/client';

export const ordersRouter = Router();

ordersRouter.get('/:id', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: OrderInclude
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  return res.json({ order });
});

// Public cancel endpoint: used if customer cancels before Printful submission.
// Edge case: "Customer cancels pre-Printful" -> refund if paid; otherwise cancel order.
ordersRouter.post('/:id/cancel', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: OrderInclude });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.printfulOrderId) {
    return res.status(409).json({ error: 'Order already submitted to Printful; requires manual review.' });
  }

  if (order.status === OrderStatus.CANCELED) return res.json({ ok: true, order });

  // If the PaymentIntent succeeded, refund it; otherwise just cancel.
  if (order.stripePaymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    if (pi.status === 'succeeded') {
      await stripe.refunds.create({ payment_intent: pi.id });
      await addOrderEvent(order.id, OrderStatus.REFUNDED, 'Refund initiated (customer canceled).');
      return res.json({ ok: true });
    }
  }

  await addOrderEvent(order.id, OrderStatus.CANCELED, 'Canceled by customer before fulfillment.');
  return res.json({ ok: true });
});


