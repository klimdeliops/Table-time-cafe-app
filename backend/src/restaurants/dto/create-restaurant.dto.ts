import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
