import { Module } from '@nestjs/common';
import { TablesModule } from '../tables/tables.module';
import { OrderAccessGuard } from './guards/order-access.guard';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

@Module({
  imports: [TablesModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrderAccessGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
