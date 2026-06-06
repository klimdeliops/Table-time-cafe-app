import { IsOptional, IsUUID } from 'class-validator';

export class AssignWaiterDto {
  // Pass a waiter's UUID to assign, or null/omit to unassign
  @IsOptional()
  @IsUUID()
  waiterId?: string | null;
}
