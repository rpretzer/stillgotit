import { prisma } from '../prisma.js';
import { printful } from '../printful/client.js';
import { addOrderEvent, statusMessage, OrderInclude } from '../orders/status.js';
import { OrderStatus } from '@prisma/client';

/**
 * Edge cases handled here:
 * - Stripe succeeds, Printful fails => MANUAL_REVIEW + retryable
 * - Duplicate webhooks => if printfulOrderId already set, do nothing
 * - Inventory/variant invalid => MANUAL_REVIEW
 * - Shipping address issues => MANUAL_REVIEW with Printful error details
 */
export async function submitOrderToPrintful(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: OrderInclude
  });
  if (!order) throw new Error('Order not found');

  if (order.printfulOrderId) return order; // idempotency guard

  // Only submit PAID orders
  if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.MANUAL_REVIEW) {
    throw new Error(`Order not eligible for fulfillment from status ${order.status}`);
  }

  const printfulItems: Array<{ sync_variant_id: number; quantity: number }> = [];
  for (const it of order.items) {
    const p = it.product;
    if (p.fulfillmentType === 'MANUAL') continue;
    if (!p.printfulVariantId) {
      await prisma.order.update({
        where: { id: order.id },
        data: { manualReviewReason: `Missing Printful mapping for product ${p.slug}` }
      });
      await addOrderEvent(order.id, OrderStatus.MANUAL_REVIEW, 'Missing Printful mapping; manual review required.');
      throw new Error('Missing Printful mapping');
    }
    printfulItems.push({ sync_variant_id: p.printfulVariantId, quantity: it.quantity });
  }

  try {
    const created = await printful.createOrder({
      external_id: order.id,
      recipient: {
        name: order.name,
        address1: order.shippingAddress1,
        address2: order.shippingAddress2 || undefined,
        city: order.shippingCity,
        state_code: order.shippingState,
        country_code: order.shippingCountry,
        zip: order.shippingPostalCode,
        email: order.email
      },
      items: printfulItems
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { printfulOrderId: created.id, printfulStatus: created.status, lastError: null, manualReviewReason: null }
    });
    await addOrderEvent(order.id, OrderStatus.FULFILLMENT_SUBMITTED, statusMessage(OrderStatus.FULFILLMENT_SUBMITTED));
    return await prisma.order.findUnique({ where: { id: order.id }, include: OrderInclude });
  } catch (err: any) {
    const msg = err?.message || 'Printful order creation failed';
    await prisma.order.update({
      where: { id: order.id },
      data: { lastError: msg, manualReviewReason: msg }
    });
    await addOrderEvent(order.id, OrderStatus.MANUAL_REVIEW, `Printful create failed: ${msg}`);
    return await prisma.order.findUnique({ where: { id: order.id }, include: OrderInclude });
  }
}

export async function syncPrintfulOrderStatus(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.printfulOrderId) return;

  const pf = await printful.getOrder(order.printfulOrderId);
  const status = pf?.result?.status || pf?.status || pf?.result?.order?.status;
  if (!status) return;

  await prisma.order.update({
    where: { id: orderId },
    data: { printfulStatus: String(status) }
  });

  // Map Printful statuses to our statuses (minimal)
  const s = String(status).toLowerCase();
  if (s.includes('shipped')) await addOrderEvent(orderId, OrderStatus.SHIPPED, 'Printful marked order as shipped.');
  else if (s.includes('delivered')) await addOrderEvent(orderId, OrderStatus.DELIVERED, 'Printful marked order as delivered.');
  else if (s.includes('failed') || s.includes('canceled')) await addOrderEvent(orderId, OrderStatus.FAILED, `Printful status: ${status}`);
  else await addOrderEvent(orderId, OrderStatus.FULFILLMENT_IN_PROGRESS, `Printful status: ${status}`);
}


