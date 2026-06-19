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

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @IsOptional()
  @IsDateString()
  pickupTime?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddItemDto)
  items?: AddItemDto[];
}
