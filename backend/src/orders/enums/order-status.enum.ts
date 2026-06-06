import { OrderStatus } from '@prisma/client';

export { OrderStatus };

/**
 * Legal FSM transitions for orders.
 *
 * Requested lifecycle: DRAFT → PLACED → IN_KITCHEN → READY → SERVED → PAID → COMPLETED
 * Mapped to existing Prisma enum:
 *   DRAFT      → CREATED
 *   PLACED     → CONFIRMED
 *   IN_KITCHEN → PREPARING
 *   READY      → READY
 *   COMPLETED  → COMPLETED  (SERVED / PAID require schema enum additions)
 *   CANCELLED  → reachable from any non-terminal state
 */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.CREATED]:   [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY,     OrderStatus.CANCELLED],
  [OrderStatus.READY]:     [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];
