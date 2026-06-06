import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class CreateTableDto {
  @IsUUID()
  restaurantId!: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  capacity!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  y!: number;
}
