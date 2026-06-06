import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findAll() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async createUser(dto: CreateUserDto) {
    if (dto.role === Role.ADMIN) {
      throw new ForbiddenException('Cannot create users with ADMIN role');
    }

    const passwordHash = await argon2.hash(dto.password);

    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          password: passwordHash,
          role: dto.role ?? Role.USER,
        },
        select: USER_SELECT,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  async deleteUser(currentUser: AuthUser, targetId: string) {
    if (currentUser.id === targetId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true },
    });

    if (!target) throw new NotFoundException('User not found');

    if (target.role === Role.ADMIN) {
      throw new ForbiddenException('Cannot delete an ADMIN user');
    }

    await this.prisma.user.delete({ where: { id: targetId } });
  }

  async updateRole(currentUser: AuthUser, targetId: string, dto: UpdateUserRoleDto) {
    if (currentUser.id === targetId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true },
    });

    if (!target) throw new NotFoundException('User not found');

    if (target.role === Role.ADMIN) {
      throw new ForbiddenException('Cannot modify the role of an ADMIN user');
    }

    return this.prisma.user.update({
      where: { id: targetId },
      data: { role: dto.role },
      select: USER_SELECT,
    });
  }
}
