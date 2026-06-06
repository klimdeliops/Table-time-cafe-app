import { IsDateString, IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateReservationDto {
  @IsUUID()
  tableId!: string;

  @IsUUID()
  restaurantId!: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  numberOfGuests!: number;
}
