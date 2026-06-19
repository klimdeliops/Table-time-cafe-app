import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { OrderStatus, ReservationStatus, Role, TableStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { PrismaTx, TablesRepository } from './tables.repository';

const CLEANING_MS  = 10 * 60 * 1000;  // 10 minutes
const OCCUPIED_MS  =  2 * 60 * 60 * 1000;  // 2 hours default

@Injectable()
export class TablesService implements OnModuleInit {
  private readonly logger = new Logger(TablesService.name);

  // In-memory timers keyed by tableId
  private readonly cleaningTimers = new Map<string, NodeJS.Timeout>();
  private readonly occupiedTimers = new Map<string, NodeJS.Timeout>();
  private readonly reservedTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly repository: TablesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const now = new Date();

    const cleaning = await this.prisma.table.findMany({
      where: { status: TableStatus.CLEANING, cleaningStartedAt: { not: null } },
      select: { id: true, cleaningStartedAt: true },
    });
    for (const t of cleaning) {
      const elapsed   = now.getTime() - t.cleaningStartedAt!.getTime();
      const remaining = CLEANING_MS - elapsed;
      if (remaining <= 0) {
        await this.finishCleaning(t.id);
      } else {
        this.scheduleCleaning(t.id, remaining);
        this.logger.log(`[CLEANING] Table ${t.id}: ${Math.round(remaining / 1000)}s left`);
      }
    }

    const occupied = await this.prisma.table.findMany({
      where: { status: TableStatus.OCCUPIED, statusExpiresAt: { not: null } },
      select: { id: true, statusExpiresAt: true },
    });
    for (const t of occupied) {
      const remaining = t.statusExpiresAt!.getTime() - now.getTime();
      if (remaining <= 0) {
        await this.syncTableStatus(t.id);
      } else {
        this.scheduleOccupied(t.id, remaining);
        this.logger.log(`[OCCUPIED] Table ${t.id}: ${Math.round(remaining / 1000)}s left`);
      }
    }

    const reserved = await this.prisma.table.findMany({
      where: { status: TableStatus.RESERVED, statusExpiresAt: { not: null } },
      select: { id: true, statusExpiresAt: true },
    });
    for (const t of reserved) {
      const remaining = t.statusExpiresAt!.getTime() - now.getTime();
      if (remaining <= 0) {
        await this.syncTableStatus(t.id);
      } else {
        this.scheduleReserved(t.id, remaining);
        this.logger.log(`[RESERVED] Table ${t.id}: transitions in ${Math.round(remaining / 1000)}s`);
      }
    }
  }

  async createTable(dto: CreateTableDto) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: dto.restaurantId },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    return this.repository.create({
      restaurantId: dto.restaurantId,
      capacity: dto.capacity,
      x: dto.x,
      y: dto.y,
    });
  }

  async getAllTables(restaurantId?: string) {
    return this.repository.findAll(restaurantId ? { restaurantId } : {});
  }

  async getTableById(id: string) {
    const table = await this.repository.findById(id);
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  async updateTable(id: string, dto: UpdateTableDto) {
    await this.assertExists(id);
    return this.repository.update(id, dto);
  }

  // Admin direct-override
  async setStatus(id: string, status: TableStatus) {
    await this.assertExists(id);
    this.cancelAllTimers(id);

    const now = new Date();

    if (status === TableStatus.CLEANING) {
      const expiresAt = new Date(now.getTime() + CLEANING_MS);
      await this.repository.update(id, {
        status,
        cleaningStartedAt: now,
        statusExpiresAt:   expiresAt,
      });
      this.scheduleCleaning(id, CLEANING_MS);
      this.logger.log(`[CLEANING] Table ${id}: auto-free in 10 min`);

    } else if (status === TableStatus.OCCUPIED) {
      const expiresAt = new Date(now.getTime() + OCCUPIED_MS);
      await this.repository.update(id, {
        status,
        cleaningStartedAt: null,
        statusExpiresAt:   expiresAt,
      });
      this.scheduleOccupied(id, OCCUPIED_MS);
      this.logger.log(`[OCCUPIED] Table ${id}: auto-free in 2h`);

    } else {
      await this.repository.update(id, {
        status,
        cleaningStartedAt: null,
        statusExpiresAt:   null,
      });
    }

    return this.repository.findById(id);
  }

  async assignTableWaiter(tableId: string, waiterId: string | null | undefined) {
    await this.assertExists(tableId);

    if (waiterId) {
      const waiter = await this.prisma.user.findUnique({
        where: { id: waiterId },
        select: { id: true, role: true },
      });
      if (!waiter) throw new NotFoundException('Waiter not found');
      if (waiter.role !== Role.WAITER) {
        throw new BadRequestException('User is not a WAITER');
      }
    }

    return this.repository.update(tableId, {
      assignedWaiter: waiterId
        ? { connect: { id: waiterId } }
        : { disconnect: true },
    });
  }

  async updateTableStatus(
    tableId: string,
    status: TableStatus,
    tx?: PrismaTx,
  ): Promise<void> {
    this.cancelAllTimers(tableId);

    const expiresAt = status === TableStatus.OCCUPIED
      ? new Date(Date.now() + OCCUPIED_MS)
      : status === TableStatus.CLEANING
        ? new Date(Date.now() + CLEANING_MS)
        : null;

    if (tx) {
      await this.repository.updateStatusInTx(tx, tableId, status, expiresAt);
    } else {
      await this.repository.update(tableId, { status, statusExpiresAt: expiresAt });
    }

    if (status === TableStatus.OCCUPIED) this.scheduleOccupied(tableId, OCCUPIED_MS);
    if (status === TableStatus.CLEANING)  this.scheduleCleaning(tableId, CLEANING_MS);
  }

  async syncTableStatus(tableId: string, tx?: PrismaTx): Promise<void> {
    const db = (tx ?? this.prisma) as PrismaTx;

    const current = await db.table.findUnique({
      where: { id: tableId },
      select: { status: true },
    });
    if (current?.status === TableStatus.CLEANING) return;

    const now = new Date();

    const activeOrder = await db.order.findFirst({
      where: {
        tableId,
        status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
      },
    });
    if (activeOrder) {
      const expiresAt = new Date(now.getTime() + OCCUPIED_MS);
      this.cancelAllTimers(tableId);
      await this.repository.updateStatusInTx(db, tableId, TableStatus.OCCUPIED, expiresAt);
      this.scheduleOccupied(tableId, OCCUPIED_MS);
      return;
    }

    const nearFuture = new Date(now.getTime() + 5 * 60 * 1000);

    // CONFIRMED reservation active now → OCCUPIED (clients arrived)
    const confirmedNow = await db.reservation.findFirst({
      where: {
        tableId,
        status: ReservationStatus.CONFIRMED,
        startTime: { lte: nearFuture },
        endTime:   { gt:  now },
      },
    });
    if (confirmedNow) {
      const delay = confirmedNow.endTime.getTime() - now.getTime();
      this.cancelAllTimers(tableId);
      await this.repository.updateStatusInTx(db, tableId, TableStatus.OCCUPIED, confirmedNow.endTime);
      this.scheduleOccupied(tableId, delay);
      return;
    }

    // PENDING reservation active now → RESERVED (booked but not yet confirmed)
    const pendingNow = await db.reservation.findFirst({
      where: {
        tableId,
        status: ReservationStatus.PENDING,
        startTime: { lte: nearFuture },
        endTime:   { gt:  now },
      },
    });
    if (pendingNow) {
      const delay = pendingNow.endTime.getTime() - now.getTime();
      this.cancelAllTimers(tableId);
      await this.repository.updateStatusInTx(db, tableId, TableStatus.RESERVED, pendingNow.endTime);
      this.scheduleReserved(tableId, delay);
      return;
    }

    // Any upcoming reservation (PENDING or CONFIRMED) → RESERVED
    const upcoming = await db.reservation.findFirst({
      where: {
        tableId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        startTime: { gt: nearFuture },
      },
      orderBy: { startTime: 'asc' },
    });
    if (upcoming) {
      const delay = upcoming.startTime.getTime() - now.getTime();
      this.cancelAllTimers(tableId);
      await this.repository.updateStatusInTx(db, tableId, TableStatus.RESERVED, upcoming.startTime);
      this.scheduleReserved(tableId, delay);
      return;
    }

    this.cancelAllTimers(tableId);
    await this.repository.updateStatusInTx(db, tableId, TableStatus.FREE, null);
  }

  private scheduleCleaning(tableId: string, delayMs: number): void {
    this.cleaningTimers.set(
      tableId,
      setTimeout(() => this.finishCleaning(tableId), delayMs),
    );
  }

  private scheduleOccupied(tableId: string, delayMs: number): void {
    this.occupiedTimers.set(
      tableId,
      setTimeout(() => this.finishOccupied(tableId), delayMs),
    );
  }

  private scheduleReserved(tableId: string, delayMs: number): void {
    this.reservedTimers.set(
      tableId,
      setTimeout(() => this.finishReserved(tableId), delayMs),
    );
  }

  private cancelAllTimers(tableId: string): void {
    for (const map of [this.cleaningTimers, this.occupiedTimers, this.reservedTimers]) {
      const t = map.get(tableId);
      if (t !== undefined) { clearTimeout(t); map.delete(tableId); }
    }
  }

  private async finishCleaning(tableId: string): Promise<void> {
    this.cleaningTimers.delete(tableId);
    try {
      await this.repository.update(tableId, {
        status: TableStatus.FREE,
        cleaningStartedAt: null,
        statusExpiresAt:   null,
      });
      this.logger.log(`[CLEANING] Table ${tableId}: done → FREE`);
    } catch (err) {
      this.logger.error(`[CLEANING] Table ${tableId}: auto-free failed`, err);
    }
  }

  private async finishOccupied(tableId: string): Promise<void> {
    this.occupiedTimers.delete(tableId);
    try {
      await this.syncTableStatus(tableId);
      this.logger.log(`[OCCUPIED] Table ${tableId}: timer expired → re-synced`);
    } catch (err) {
      this.logger.error(`[OCCUPIED] Table ${tableId}: sync failed`, err);
    }
  }

  private async finishReserved(tableId: string): Promise<void> {
    this.reservedTimers.delete(tableId);
    try {
      await this.syncTableStatus(tableId);
      this.logger.log(`[RESERVED] Table ${tableId}: startTime reached → re-synced`);
    } catch (err) {
      this.logger.error(`[RESERVED] Table ${tableId}: sync failed`, err);
    }
  }

  private async assertExists(id: string): Promise<void> {
    const table = await this.repository.findRawById(id);
    if (!table) throw new NotFoundException('Table not found');
  }
}
