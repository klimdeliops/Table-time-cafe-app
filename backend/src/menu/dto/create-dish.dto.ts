import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import { DishCategory } from '@prisma/client';

export class CreateDishDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nameEn?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;

  @IsEnum(DishCategory)
  category!: DishCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;
}
