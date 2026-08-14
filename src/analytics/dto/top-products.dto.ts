import { IsString, IsNotEmpty } from "class-validator";

export class TopProductsDto {
  @IsNotEmpty()
  @IsString()
  region: string;

  @IsNotEmpty()
  @IsString()
  month: string; 
}
