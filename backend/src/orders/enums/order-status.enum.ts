import { OrderStatus } from '@prisma/client';

export { OrderStatus };

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
