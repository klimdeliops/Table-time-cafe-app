import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TablesService } from '../tables/tables.service';
import { PrismaTx } from '../tables/tables.repository';
import { AuthUser } from '../auth/types/auth-user.type';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueryAvailableDto } from './dto/query-available.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';

const RESERVATION_SELECT = {
  id: true,
  status: true,
  numberOfGuests: true,
  startTime: true,
  endTime: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true } },
  table: { select: { id: true, number: true, capacity: true, x: true, y: true } },
  restaurant: { select: { id: true, name: true, address: true } },
} as const;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tablesService: TablesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create — serializable transaction prevents double-booking
  // ---------------------------------------------------------------------------

  async createReservation(currentUser: AuthUser, dto: CreateReservationDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }
    if (startTime < new Date()) {
      throw new BadRequestException('Cannot create a reservation in the past');
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // 1. Validate table exists and belongs to the given restaurant
          const table = await tx.table.findUnique({ where: { id: dto.tableId } });

          if (!table) throw new NotFoundException('Table not found');

          if (table.restaurantId !== dto.restaurantId) {
            throw new BadRequestException('Table does not belong to this restaurant');
          }

          // 2. Capacity check
          if (table.capacity < dto.numberOfGuests) {
            throw new BadRequestException(
              `Table capacity (${table.capacity}) is less than requested guests (${dto.numberOfGuests})`,
            );
          }

          // 3. Overlap conflict check
          const conflict = await tx.reservation.findFirst({
            where: {
              tableId: dto.tableId,
              status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          });

          if (conflict) {
            throw new ConflictException(
              'Table is already reserved for the requested time slot',
            );
          }

          // 4. Create reservation
          return tx.reservation.create({
            data: {
              userId: currentUser.id,
              tableId: dto.tableId,
              restaurantId: dto.restaurantId,
              numberOfGuests: dto.numberOfGuests,
              startTime,
              endTime,
              status: ReservationStatus.PENDING,
            },
            select: RESERVATION_SELECT,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Reservation conflict due to concurrent request. Please try again.',
        );
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Read — user's own reservations
  // ---------------------------------------------------------------------------

  async getUserReservations(userId: string, query: QueryReservationsDto) {
    const { status, date, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ReservationWhereInput = { userId };

    if (status) where.status = status;

    if (date) {
      const day = new Date(date);
      const next = new Date(date);
      next.setUTCDate(next.getUTCDate() + 1);
      where.startTime = { gte: day, lt: next };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        select: RESERVATION_SELECT,
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // ---------------------------------------------------------------------------
  // Read — all reservations for a restaurant (WAITER / ADMIN)
  // ---------------------------------------------------------------------------

  async getRestaurantReservations(restaurantId: string, query: QueryReservationsDto) {
    const { status, date, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ReservationWhereInput = { restaurantId };

    if (status) where.status = status;

    if (date) {
      const day = new Date(date);
      const next = new Date(date);
      next.setUTCDate(next.getUTCDate() + 1);
      where.startTime = { gte: day, lt: next };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        select: RESERVATION_SELECT,
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // ---------------------------------------------------------------------------
  // Read — available tables for a time range (used by the interactive map)
  // ---------------------------------------------------------------------------

  async getAvailableTables(query: QueryAvailableDto) {
    const startTime = new Date(query.startTime);
    const endTime = new Date(query.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const conflicting = await this.prisma.reservation.findMany({
      where: {
        restaurantId: query.restaurantId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: { tableId: true },
    });

    const unavailableIds = conflicting.map((r) => r.tableId);

    return this.prisma.table.findMany({
      where: {
        restaurantId: query.restaurantId,
        id: { notIn: unavailableIds },
        ...(query.numberOfGuests ? { capacity: { gte: query.numberOfGuests } } : {}),
      },
      orderBy: { capacity: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Cancel — USER can cancel own, ADMIN can cancel any
  // ---------------------------------------------------------------------------

  async cancelReservation(id: string, currentUser: AuthUser) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const reservation = await tx.reservation.findUnique({ where: { id } });
          if (!reservation) throw new NotFoundException('Reservation not found');

          if (
            currentUser.role !== 'ADMIN' &&
            currentUser.role !== 'WAITER' &&
            reservation.userId !== currentUser.id
          ) {
            throw new ForbiddenException('You can only cancel your own reservations');
          }

          const cancellable: ReservationStatus[] = [
            ReservationStatus.PENDING,
            ReservationStatus.CONFIRMED,
          ];

          if (!cancellable.includes(reservation.status)) {
            throw new BadRequestException(
              `Cannot cancel a reservation with status: ${reservation.status}`,
            );
          }

          const updated = await tx.reservation.update({
            where: { id },
            data: { status: ReservationStatus.CANCELLED },
            select: RESERVATION_SELECT,
          });

          // Only sync if the table's RESERVED state was driven by this reservation
          if (reservation.status === ReservationStatus.CONFIRMED) {
            await this.tablesService.syncTableStatus(
              reservation.tableId,
              tx as unknown as PrismaTx,
            );
          }

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException('Concurrent request conflict. Please try again.');
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Confirm — WAITER / ADMIN only; PENDING → CONFIRMED
  // ---------------------------------------------------------------------------

  async confirmReservation(id: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const reservation = await tx.reservation.findUnique({ where: { id } });
          if (!reservation) throw new NotFoundException('Reservation not found');

          if (reservation.status !== ReservationStatus.PENDING) {
            throw new BadRequestException(
              `Only PENDING reservations can be confirmed. Current status: ${reservation.status}`,
            );
          }

          const updated = await tx.reservation.update({
            where: { id },
            data: { status: ReservationStatus.CONFIRMED },
            select: RESERVATION_SELECT,
          });

          // Derive correct status: OCCUPIED if table has an active order, else RESERVED.
          // syncTableStatus checks active orders first and never downgrades OCCUPIED.
          await this.tablesService.syncTableStatus(
            reservation.tableId,
            tx as unknown as PrismaTx,
          );

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException('Concurrent request conflict. Please try again.');
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Complete — WAITER / ADMIN only; CONFIRMED → COMPLETED
  // ---------------------------------------------------------------------------

  async completeReservation(id: string) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const reservation = await tx.reservation.findUnique({ where: { id } });
          if (!reservation) throw new NotFoundException('Reservation not found');

          if (reservation.status !== ReservationStatus.CONFIRMED) {
            throw new BadRequestException(
              `Only CONFIRMED reservations can be completed. Current status: ${reservation.status}`,
            );
          }

          const updated = await tx.reservation.update({
            where: { id },
            data: { status: ReservationStatus.COMPLETED },
            select: RESERVATION_SELECT,
          });

          await this.tablesService.syncTableStatus(
            reservation.tableId,
            tx as unknown as PrismaTx,
          );

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException('Concurrent request conflict. Please try again.');
      }
      throw error;
    }
  }

}
