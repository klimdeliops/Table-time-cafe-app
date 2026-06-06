import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDishDto } from './dto/create-dish.dto';
import { QueryDishDto } from './dto/query-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: QueryDishDto) {
    return this.prisma.dish.findMany({
      where: {
        isAvailable: true,
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  findAllAdmin() {
    return this.prisma.dish.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(id: string) {
    const dish = await this.prisma.dish.findUnique({ where: { id } });

    if (!dish || !dish.isAvailable) throw new NotFoundException('Dish not found');

    return dish;
  }

  async create(dto: CreateDishDto) {
    try {
      return await this.prisma.dish.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`A dish named "${dto.name}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateDishDto) {
    await this.assertExists(id);

    try {
      return await this.prisma.dish.update({ where: { id }, data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`A dish named "${dto.name}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    return this.prisma.dish.update({
      where: { id },
      data: { isAvailable: false },
    });
  }

  private async assertExists(id: string): Promise<void> {
    const dish = await this.prisma.dish.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!dish) throw new NotFoundException('Dish not found');
  }
}
