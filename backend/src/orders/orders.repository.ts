import { Injectable } from '@nestjs/common';
import { Prisma, OrderStatus, OrderType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../tables/tables.repository';
import { QueryOrdersDto } from './dto/query-orders.dto';

export const ORDER_SELECT = {
  id: true,
  type: true,
  status: true,
  paymentMethod: true,
  totalAmount: true,
  scheduledAt: true,
  tableId: true,
  reservationId: true,
  deliveryAddress: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  user:  { select: { id: true, email: true } },
  table: { select: { id: true, number: true, capacity: true } },
  items: {
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      dish: { select: { id: true, name: true, category: true, image: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export type OrderWithItems = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;

interface CreateOrderData {
  userId: string;
  type: OrderType;
  tableId?: string;
  scheduledAt?: Date;
  deliveryAddress?: string;
  reservationId?: string;
  paymentMethod?: PaymentMethod;
}

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OrderWithItems | null> {
    return this.prisma.order.findUnique({ where: { id }, select: ORDER_SELECT });
  }

  async findByIdInTx(tx: PrismaTx, id: string): Promise<OrderWithItems | null> {
    return tx.order.findUnique({ where: { id }, select: ORDER_SELECT });
  }

  async findRawById(id: string) {
    return this.prisma.order.findUnique({ where: { id } });
  }

  async findByUserId(
    userId: string,
    query: QueryOrdersDto,
  ): Promise<{ items: OrderWithItems[]; total: number; page: number; limit: number }> {
    const { status, type, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = { userId };
    if (status) where.status = status;
    if (type)   where.type   = type;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findAll(
    query: QueryOrdersDto,
  ): Promise<{ items: OrderWithItems[]; total: number; page: number; limit: number }> {
    const { status, type, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (type)   where.type   = type;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findActiveByTableId(tableId: string): Promise<OrderWithItems | null> {
    return this.prisma.order.findFirst({
      where: {
        tableId,
        status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
      },
      select: ORDER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tx: PrismaTx, data: CreateOrderData): Promise<OrderWithItems> {
    return tx.order.create({
      data: {
        userId:      data.userId,
        type:        data.type,
        status:      OrderStatus.CREATED,
        totalAmount: new Prisma.Decimal(0),
        ...(data.tableId         ? { tableId:         data.tableId         } : {}),
        ...(data.scheduledAt     ? { scheduledAt:     data.scheduledAt     } : {}),
        ...(data.deliveryAddress ? { deliveryAddress: data.deliveryAddress } : {}),
        ...(data.reservationId   ? { reservationId:   data.reservationId   } : {}),
        ...(data.paymentMethod   ? { paymentMethod:   data.paymentMethod   } : {}),
      },
      select: ORDER_SELECT,
    });
  }

  async update(
    tx: PrismaTx,
    id: string,
    data: Prisma.OrderUpdateInput,
  ): Promise<OrderWithItems> {
    return tx.order.update({ where: { id }, data, select: ORDER_SELECT });
  }

  async findItemByIdAndOrder(orderId: string, itemId: string) {
    return this.prisma.orderItem.findFirst({ where: { id: itemId, orderId } });
  }

  async upsertItem(
    tx: PrismaTx,
    orderId: string,
    dishId: string,
    quantity: number,
    unitPrice: Prisma.Decimal,
  ) {
    const existing = await tx.orderItem.findFirst({ where: { orderId, dishId } });

    if (existing) {
      return tx.orderItem.update({
        where: { id: existing.id },
        data:  { quantity: existing.quantity + quantity },
      });
    }

    return tx.orderItem.create({
      data: { orderId, dishId, quantity, unitPrice },
    });
  }

  async deleteItem(tx: PrismaTx, itemId: string): Promise<void> {
    await tx.orderItem.delete({ where: { id: itemId } });
  }

  async recalculateTotal(tx: PrismaTx, orderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({
      where:  { orderId },
      select: { unitPrice: true, quantity: true },
    });

    const total = items.reduce(
      (sum, item) =>
        sum.add(new Prisma.Decimal(item.unitPrice.toString()).mul(item.quantity)),
      new Prisma.Decimal(0),
    );

    await tx.order.update({ where: { id: orderId }, data: { totalAmount: total } });
  }
}
