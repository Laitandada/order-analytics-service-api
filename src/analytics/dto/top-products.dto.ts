import { IsString, IsOptional, Matches } from "class-validator";

export class TopProductsDto {
  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: "month must be in YYYY-MM format" })
  month?: string; 
}
