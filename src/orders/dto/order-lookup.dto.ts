import { IsOptional, IsDateString } from 'class-validator';

export class OrderLookupDto {
  @IsOptional()
  @IsDateString()
  orderedAt?: string;
}
