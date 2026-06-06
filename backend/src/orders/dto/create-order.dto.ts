import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { OrderType } from '../enums/order-type.enum';
import { AddItemDto } from './add-item.dto';

export class CreateOrderDto {
  @IsEnum(OrderType)
  type!: OrderType;

  // DINE_IN: required. TAKEAWAY / DELIVERY: must be absent.
  @IsOptional()
  @IsUUID()
  tableId?: string;

  // DINE_IN optional: link to an existing reservation for this table.
  // NOTE: Storing reservationId requires adding `reservationId String?` to
  // the Order model in schema.prisma. Validated here; currently not persisted.
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  // DELIVERY: required street / full address.
  // NOTE: Storing deliveryAddress requires adding `deliveryAddress String?` to
  // the Order model in schema.prisma. Validated here; currently not persisted.
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  // TAKEAWAY: desired pickup time (stored as Order.scheduledAt).
  @IsOptional()
  @IsDateString()
  pickupTime?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  // Optional items to add immediately on creation (convenience, not required).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddItemDto)
  items?: AddItemDto[];
}
