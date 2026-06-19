import { Injectable } from '@nestjs/common';
import { Prisma, Table, TableStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PrismaTx = Omit<
  PrismaService,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export const TABLE_SELECT = {
  id: true,
  restaurantId: true,
  number: true,
  capacity: true,
  x: true,
  y: true,
  status: true,
  statusExpiresAt: true,
  assignedWaiterId: true,
  createdAt: true,
  updatedAt: true,
  restaurant:      { select: { id: true, name: true } },
  assignedWaiter:  { select: { id: true, email: true, role: true } },
} as const;

export type TableWithRestaurant = Prisma.TableGetPayload<{
  select: typeof TABLE_SELECT;
}>;

@Injectable()
export class TablesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(where: Prisma.TableWhereInput): Promise<TableWithRestaurant[]> {
    return this.prisma.table.findMany({
      where,
      select: TABLE_SELECT,
      orderBy: [{ capacity: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(id: string): Promise<TableWithRestaurant | null> {
    return this.prisma.table.findUnique({ where: { id }, select: TABLE_SELECT });
  }

  async findRawById(id: string): Promise<Table | null> {
    return this.prisma.table.findUnique({ where: { id } });
  }

  async create(data: Prisma.TableUncheckedCreateInput): Promise<TableWithRestaurant> {
    return this.prisma.table.create({ data, select: TABLE_SELECT });
  }

  async update(
    id: string,
    data: Prisma.TableUpdateInput,
  ): Promise<TableWithRestaurant> {
    return this.prisma.table.update({ where: { id }, data, select: TABLE_SELECT });
  }

  async updateStatusInTx(
    tx: PrismaTx,
    id: string,
    status: TableStatus,
    statusExpiresAt?: Date | null,
  ): Promise<void> {
    await tx.table.update({
      where: { id },
      data: { status, ...(statusExpiresAt !== undefined ? { statusExpiresAt } : {}) },
    });
  }
}
