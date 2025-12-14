import type { Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { stripe } from '../stripe.js';
import { OrderStatus } from '@prisma/client';
import { addOrderEvent, statusMessage, OrderInclude } from '../orders/status.js';
import { submitOrderToPrintful } from '../fulfillment/printfulFulfillment.js';

/**
 * Stripe webhook handler (merch only).
 * Verifies signature and processes:
 * - payment_intent.succeeded => mark PAID and submit to Printful (idempotent)
 */
export async function stripeWebhookHandler(req: Request, res: Response) {
  const sig = req.header('stripe-signature');
  if (!sig) return res.status(400).send('Missing Stripe signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return res.status(400).send(`Webhook signature verification failed: ${err?.message || 'unknown'}`);
  }

  // Idempotency for duplicate webhooks handled via order state checks
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as any;
    const orderId = pi?.metadata?.orderId as string | undefined;
    if (!orderId) return res.status(200).json({ received: true });

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: OrderInclude });
    if (!order) return res.status(200).json({ received: true });

    // Duplicate webhook guard
    if (order.printfulOrderId) return res.status(200).json({ received: true });

    // Mark as PAID if not already
    if (order.status !== OrderStatus.PAID) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          stripePaymentIntentId: pi.id
        }
      });
      await addOrderEvent(order.id, OrderStatus.PAID, statusMessage(OrderStatus.PAID));
    }

    // Fulfill via Printful
    await submitOrderToPrintful(order.id);
  }

  return res.json({ received: true });
}


