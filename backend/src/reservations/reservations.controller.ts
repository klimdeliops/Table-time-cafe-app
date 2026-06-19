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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthUser } from '../auth/types/auth-user.type';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueryAvailableDto } from './dto/query-available.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // POST /api/reservations — create a reservation (authenticated users)
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReservationDto) {
    return this.reservationsService.createReservation(user, dto);
  }

  // GET /api/reservations/available — tables free for the requested slot (public)
  @Get('available')
  getAvailable(@Query() query: QueryAvailableDto) {
    return this.reservationsService.getAvailableTables(query);
  }

  // GET /api/reservations/me — current user's own reservations
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyReservations(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryReservationsDto,
  ) {
    return this.reservationsService.getUserReservations(user.id, query);
  }

  // GET /api/reservations/restaurant/:restaurantId — all reservations (WAITER, ADMIN)
  @Get('restaurant/:restaurantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.WAITER, Role.ADMIN)
  getByRestaurant(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query() query: QueryReservationsDto,
  ) {
    return this.reservationsService.getRestaurantReservations(restaurantId, query);
  }

  // PATCH /api/reservations/:id/cancel — cancel (owner or ADMIN)
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reservationsService.cancelReservation(id, user);
  }

  // PATCH /api/reservations/:id/confirm — WAITER, ADMIN
  @Patch(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.WAITER, Role.ADMIN)
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.confirmReservation(id);
  }

  // PATCH /api/reservations/:id/complete — WAITER, ADMIN
  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.WAITER, Role.ADMIN)
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.completeReservation(id);
  }
}
