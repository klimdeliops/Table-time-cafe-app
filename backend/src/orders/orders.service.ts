import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, OrderType, Prisma, ReservationStatus, TableStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TablesService } from '../tables/tables.service';
import { PrismaTx } from '../tables/tables.repository';
import { AuthUser } from '../auth/types/auth-user.type';
import { AddItemDto } from './dto/add-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order.dto';
import {
  ORDER_STATUS_TRANSITIONS,
  TERMINAL_STATUSES,
} from './enums/order-status.enum';
import { OrdersRepository } from './orders.repository';

@Injectable()
export class OrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly prisma: PrismaService,
    private readonly tablesService: TablesService,
  ) {}

  async createOrder(user: AuthUser, dto: CreateOrderDto) {
    this.assertTypeConstraints(dto);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          if (dto.type === OrderType.DINE_IN) {
            const table = await tx.table.findUnique({ where: { id: dto.tableId! } });

            if (!table) throw new NotFoundException('Table not found');

            const available: TableStatus[] = [TableStatus.FREE, TableStatus.RESERVED];
            if (!available.includes(table.status)) {
              throw new ConflictException(
                `Table is not available. Current status: ${table.status}`,
              );
            }

            const existingOrder = await tx.order.findFirst({
              where: {
                tableId: dto.tableId!,
                status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
              },
            });
            if (existingOrder) {
              throw new ConflictException('Table already has an active order');
            }

            if (dto.reservationId) {
              const now = new Date();
              const reservation = await tx.reservation.findUnique({
                where: { id: dto.reservationId },
              });

              if (!reservation) {
                throw new NotFoundException('Reservation not found');
              }
              if (reservation.userId !== user.id) {
                throw new ForbiddenException('Reservation does not belong to you');
              }
              if (reservation.tableId !== dto.tableId) {
                throw new ConflictException('Reservation is for a different table');
              }
              if (reservation.status !== ReservationStatus.CONFIRMED) {
                throw new ConflictException(
                  `Reservation must be CONFIRMED to create an order. Current status: ${reservation.status}`,
                );
              }
              if (reservation.startTime > now || reservation.endTime <= now) {
                throw new ConflictException('Reservation is not currently active');
              }
            }
          }

          const order = await this.repository.create(tx as unknown as PrismaTx, {
            userId:          user.id,
            type:            dto.type,
            tableId:         dto.tableId,
            scheduledAt:     dto.pickupTime ? new Date(dto.pickupTime) : undefined,
            deliveryAddress: dto.deliveryAddress,
            reservationId:   dto.reservationId,
            paymentMethod:   dto.paymentMethod,
          });

          if (dto.items && dto.items.length > 0) {
            for (const item of dto.items) {
              await this.resolveAndUpsertItem(tx as unknown as PrismaTx, order.id, item);
            }
            await this.repository.recalculateTotal(tx as unknown as PrismaTx, order.id);
          }

          if (dto.type === OrderType.DINE_IN && dto.tableId) {
            await this.tablesService.updateTableStatus(
              dto.tableId,
              TableStatus.OCCUPIED,
              tx as unknown as PrismaTx,
            );
          }

          return this.repository.findByIdInTx(tx as unknown as PrismaTx, order.id);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException('Table is being reserved, please try again');
      }
      throw error;
    }
  }

  async addItem(user: AuthUser, orderId: string, dto: AddItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');

      if (user.role !== 'ADMIN' && user.role !== 'WAITER' && order.userId !== user.id) {
        throw new ForbiddenException('Access denied');
      }

      if (order.status !== OrderStatus.CREATED) {
        throw new BadRequestException(
          'Items can only be added to orders with status CREATED (DRAFT)',
        );
      }

      await this.resolveAndUpsertItem(tx as unknown as PrismaTx, orderId, dto);
      await this.repository.recalculateTotal(tx as unknown as PrismaTx, orderId);
      return this.repository.findByIdInTx(tx as unknown as PrismaTx, orderId);
    });
  }

  async removeItem(user: AuthUser, orderId: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');

      if (user.role !== 'ADMIN' && user.role !== 'WAITER' && order.userId !== user.id) {
        throw new ForbiddenException('Access denied');
      }

      if (order.status !== OrderStatus.CREATED) {
        throw new BadRequestException(
          'Items can only be removed from orders with status CREATED (DRAFT)',
        );
      }

      const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });
      if (!item) throw new NotFoundException('Order item not found');

      await this.repository.deleteItem(tx as unknown as PrismaTx, itemId);
      await this.repository.recalculateTotal(tx as unknown as PrismaTx, orderId);
      return this.repository.findByIdInTx(tx as unknown as PrismaTx, orderId);
    });
  }

  async placeOrder(user: AuthUser, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.repository.findByIdInTx(tx as unknown as PrismaTx, orderId);
      if (!order) throw new NotFoundException('Order not found');

      if (user.role !== 'ADMIN' && user.role !== 'WAITER' && order.userId !== user.id) {
        throw new ForbiddenException('Access denied');
      }

      if (order.status !== OrderStatus.CREATED) {
        throw new BadRequestException(
          `Only CREATED (DRAFT) orders can be placed. Current status: ${order.status}`,
        );
      }

      if (!order.items || order.items.length === 0) {
        throw new BadRequestException('Cannot place an empty order. Add at least one item first.');
      }

      return this.repository.update(
        tx as unknown as PrismaTx,
        orderId,
        { status: OrderStatus.CONFIRMED },
      );
    });
  }

  async changeStatus(orderId: string, dto: UpdateOrderStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');

      this.assertFSMTransition(order.status, dto.status);

      const updated = await this.repository.update(
        tx as unknown as PrismaTx,
        orderId,
        { status: dto.status },
      );

      if (
        order.type === OrderType.DINE_IN &&
        order.tableId &&
        (dto.status === OrderStatus.COMPLETED || dto.status === OrderStatus.CANCELLED)
      ) {
        await this.tablesService.syncTableStatus(
          order.tableId,
          tx as unknown as PrismaTx,
        );
      }

      return updated;
    });
  }

  async cancelOrder(user: AuthUser, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');

      if (user.role !== 'ADMIN' && user.role !== 'WAITER' && order.userId !== user.id) {
        throw new ForbiddenException('You can only cancel your own orders');
      }

      if (TERMINAL_STATUSES.includes(order.status)) {
        throw new BadRequestException(
          `Cannot cancel an order with status: ${order.status}`,
        );
      }

      const updated = await this.repository.update(
        tx as unknown as PrismaTx,
        orderId,
        { status: OrderStatus.CANCELLED },
      );

      if (order.type === OrderType.DINE_IN && order.tableId) {
        await this.tablesService.syncTableStatus(
          order.tableId,
          tx as unknown as PrismaTx,
        );
      }

      return updated;
    });
  }

  async getActiveOrderByTable(tableId: string) {
    const table = await this.prisma.table.findUnique({ where: { id: tableId } });
    if (!table) throw new NotFoundException('Table not found');
    return this.repository.findActiveByTableId(tableId);
  }

  async getUserOrders(userId: string, query: QueryOrdersDto) {
    return this.repository.findByUserId(userId, query);
  }

  async getAllOrders(query: QueryOrdersDto) {
    return this.repository.findAll(query);
  }

  async getOrderById(orderId: string, user: AuthUser) {
    const order = await this.repository.findById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (
      user.role !== 'ADMIN' &&
      user.role !== 'WAITER' &&
      order.userId !== user.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    return order;
  }

  private async resolveAndUpsertItem(
    tx: PrismaTx,
    orderId: string,
    dto: AddItemDto,
  ): Promise<void> {
    const dish = await tx.dish.findUnique({ where: { id: dto.dishId } });

    if (!dish) throw new NotFoundException(`Dish ${dto.dishId} not found`);
    if (!dish.isAvailable) {
      throw new BadRequestException(`"${dish.name}" is currently unavailable`);
    }

    await this.repository.upsertItem(tx, orderId, dish.id, dto.quantity, dish.price);
  }

  private assertTypeConstraints(dto: CreateOrderDto): void {
    switch (dto.type) {
      case OrderType.DINE_IN:
        if (!dto.tableId) {
          throw new BadRequestException('DINE_IN orders require tableId');
        }
        if (dto.deliveryAddress) {
          throw new BadRequestException('DINE_IN orders cannot have a deliveryAddress');
        }
        break;

      case OrderType.DELIVERY:
        if (!dto.deliveryAddress?.trim()) {
          throw new BadRequestException('Delivery address is required');
        }
        if (dto.tableId) {
          throw new BadRequestException('DELIVERY orders cannot have a tableId');
        }
        if (dto.reservationId) {
          throw new BadRequestException('DELIVERY orders cannot have a reservationId');
        }
        break;

      case OrderType.TAKEAWAY:
        if (dto.tableId) {
          throw new BadRequestException('TAKEAWAY orders cannot have a tableId');
        }
        if (dto.deliveryAddress) {
          throw new BadRequestException('TAKEAWAY orders cannot have a deliveryAddress');
        }
        if (dto.reservationId) {
          throw new BadRequestException('TAKEAWAY orders cannot have a reservationId');
        }
        break;
    }
  }

  private assertFSMTransition(current: OrderStatus, next: OrderStatus): void {
    const allowed = ORDER_STATUS_TRANSITIONS[current];

    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Invalid status transition: ${current} → ${next}. ` +
        `Allowed transitions: [${allowed.join(', ') || 'none — terminal state'}]`,
      );
    }
  }
}
