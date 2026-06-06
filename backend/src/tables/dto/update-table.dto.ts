import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateTableDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  capacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  x?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  y?: number;
}
