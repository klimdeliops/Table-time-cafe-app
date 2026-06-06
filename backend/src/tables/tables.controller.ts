import {
  Body,
  Controller,
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
import { AssignWaiterDto } from './dto/assign-waiter.dto';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { TablesService } from './tables.service';

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  // GET /tables?restaurantId=... — PUBLIC
  @Get()
  getAll(@Query('restaurantId') restaurantId?: string) {
    return this.tablesService.getAllTables(restaurantId);
  }

  // GET /tables/:id — PUBLIC
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tablesService.getTableById(id);
  }

  // POST /tables — ADMIN only
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateTableDto) {
    return this.tablesService.createTable(dto);
  }

  // PATCH /tables/:id — ADMIN (capacity, x, y — not status)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tablesService.updateTable(id, dto);
  }

  // PATCH /tables/:id/status — ADMIN (direct override; intended for CLEANING)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.tablesService.setStatus(id, dto.status);
  }

  // PATCH /tables/:id/assign — ADMIN only
  @Patch(':id/assign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  assignWaiter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignWaiterDto,
  ) {
    return this.tablesService.assignTableWaiter(id, dto.waiterId);
  }
}
