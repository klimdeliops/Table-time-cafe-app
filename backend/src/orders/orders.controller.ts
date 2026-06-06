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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../auth/types/auth-user.type';
import { AddItemDto } from './dto/add-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order.dto';
import { OrderAccessGuard } from './guards/order-access.guard';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Static routes first to avoid collision with :id ─────────────────────

  // GET /api/orders/me — authenticated user's own orders
  @Get('me')
  getMyOrders(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.getUserOrders(user.id, query);
  }

  // GET /api/orders/table/:tableId — active order for a table (WAITER / ADMIN)
  @Get('table/:tableId')
  @UseGuards(RolesGuard)
  @Roles(Role.WAITER, Role.ADMIN)
  getActiveByTable(@Param('tableId', ParseUUIDPipe) tableId: string) {
    return this.ordersService.getActiveOrderByTable(tableId);
  }

  // GET /api/orders — all orders (WAITER / ADMIN)
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.WAITER, Role.ADMIN)
  getAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.getAllOrders(query);
  }

  // ── Parameterised routes ─────────────────────────────────────────────────

  // GET /api/orders/:id
  @Get(':id')
  @UseGuards(OrderAccessGuard)
  getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.getOrderById(id, user);
  }

  // ── Write operations ─────────────────────────────────────────────────────

  // POST /api/orders — create order draft
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user, dto);
  }

  // POST /api/orders/:id/items — add item to a CREATED order
  @Post(':id/items')
  @UseGuards(OrderAccessGuard)
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddItemDto,
  ) {
    return this.ordersService.addItem(user, id, dto);
  }

  // DELETE /api/orders/:id/items/:itemId — remove item from a CREATED order
  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrderAccessGuard)
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.removeItem(user, id, itemId);
  }

  // PATCH /api/orders/:id/place — submit order (CREATED → CONFIRMED)
  @Patch(':id/place')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrderAccessGuard)
  place(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.placeOrder(user, id);
  }

  // PATCH /api/orders/:id/status — FSM transition (WAITER / ADMIN)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.WAITER, Role.ADMIN)
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.changeStatus(id, dto);
  }

  // PATCH /api/orders/:id/cancel — cancel (owner or WAITER / ADMIN)
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrderAccessGuard)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.cancelOrder(user, id);
  }
}
