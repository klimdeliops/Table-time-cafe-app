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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateDishDto } from './dto/create-dish.dto';
import { QueryDishDto } from './dto/query-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { MenuService } from './menu.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // GET /api/menu?category=... — PUBLIC
  @Get()
  findAll(@Query() query: QueryDishDto) {
    return this.menuService.findAll(query);
  }

  // GET /api/menu/admin/all — ADMIN only, includes unavailable dishes
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAllAdmin() {
    return this.menuService.findAllAdmin();
  }

  // GET /api/menu/:id — PUBLIC
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuService.findById(id);
  }

  // POST /api/menu — ADMIN only
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateDishDto) {
    return this.menuService.create(dto);
  }

  // PATCH /api/menu/:id — ADMIN only
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDishDto,
  ) {
    return this.menuService.update(id, dto);
  }

  // DELETE /api/menu/:id — ADMIN only (soft delete: sets isAvailable = false)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.menuService.remove(id);
  }
}
