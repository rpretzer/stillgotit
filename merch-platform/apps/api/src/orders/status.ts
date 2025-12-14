import { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

export async function addOrderEvent(orderId: string, status: OrderStatus, message?: string) {
  await prisma.orderEvent.create({
    data: { orderId, status, message: message || null }
  });
  await prisma.order.update({
    where: { id: orderId },
    data: { status }
  });
}

export function statusMessage(status: OrderStatus) {
  switch (status) {
    case OrderStatus.PENDING:
      return 'Order created';
    case OrderStatus.PAYMENT_CREATED:
      return 'Payment initiated';
    case OrderStatus.PAID:
      return 'Payment received';
    case OrderStatus.FULFILLMENT_SUBMITTED:
      return 'Submitted to Printful';
    case OrderStatus.FULFILLMENT_IN_PROGRESS:
      return 'In production';
    case OrderStatus.SHIPPED:
      return 'Shipped';
    case OrderStatus.DELIVERED:
      return 'Delivered';
    case OrderStatus.MANUAL_REVIEW:
      return 'Needs manual review';
    case OrderStatus.FAILED:
      return 'Failed';
    case OrderStatus.CANCELED:
      return 'Canceled';
    case OrderStatus.REFUNDED:
      return 'Refunded';
    default:
      return String(status);
  }
}

export function isFinalStatus(status: OrderStatus) {
  return [OrderStatus.DELIVERED, OrderStatus.REFUNDED, OrderStatus.CANCELED].includes(status);
}

export function isRefundable(status: OrderStatus) {
  return [OrderStatus.PAID, OrderStatus.FULFILLMENT_SUBMITTED, OrderStatus.FULFILLMENT_IN_PROGRESS, OrderStatus.FAILED].includes(status);
}

export const OrderInclude = Prisma.validator<Prisma.OrderInclude>()({
  items: { include: { product: true } },
  events: { orderBy: { createdAt: 'asc' } }
});


