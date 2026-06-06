import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class AddItemDto {
  @IsUUID()
  dishId!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}
