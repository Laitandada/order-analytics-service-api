import { IsOptional, IsString, IsInt, Min, Max, IsDateString } from "class-validator";
import { Type } from "class-transformer";

export class CustomerOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursorOrderId?: string;

  @IsOptional()
  @IsDateString()
  cursorOrderedAt?: string;
}
