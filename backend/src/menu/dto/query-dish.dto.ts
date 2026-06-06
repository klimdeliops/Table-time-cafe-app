import { IsEnum, IsOptional } from 'class-validator';
import { DishCategory } from '@prisma/client';

export class QueryDishDto {
  @IsOptional()
  @IsEnum(DishCategory)
  category?: DishCategory;
}
