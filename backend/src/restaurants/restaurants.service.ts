import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { tables: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        tables: {
          select: { id: true, capacity: true, x: true, y: true, status: true },
          orderBy: { capacity: 'asc' },
        },
      },
    });

    if (!restaurant) throw new NotFoundException('Restaurant not found');

    return restaurant;
  }

  create(dto: CreateRestaurantDto) {
    return this.prisma.restaurant.create({ data: dto });
  }

  async update(id: string, dto: UpdateRestaurantDto) {
    await this.assertExists(id);
    return this.prisma.restaurant.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.assertExists(id);
    return this.prisma.restaurant.delete({ where: { id } });
  }

  private async assertExists(id: string): Promise<void> {
    const found = await this.prisma.restaurant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Restaurant not found');
  }
}
