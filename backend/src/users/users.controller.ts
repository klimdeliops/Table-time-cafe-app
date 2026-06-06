import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../auth/types/auth-user.type';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/users/me — authenticated user
  // Must be declared before :id to avoid route collision
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.getMe(user.id);
  }

  // POST /api/users — ADMIN only (staff creation)
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  // GET /api/users — ADMIN only
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  // GET /api/users/:id — ADMIN only
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  // PATCH /api/users/:id/role — ADMIN only
  @Patch(':id/role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthUser,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(currentUser, id, dto);
  }

  // DELETE /api/users/:id — ADMIN only
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.usersService.deleteUser(currentUser, id);
  }
}
