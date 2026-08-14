import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { CustomerRevenueDto } from "./dto/customer-revenue.dto.js";
import { TopProductsDto } from "./dto/top-products.dto.js";

@Injectable()
export class AnalyticsRepository {
  constructor(private prisma: PrismaService) {}

  async getCustomerRevenue(dto: CustomerRevenueDto): Promise<any[]> {
    return [];
  }

  async getTopProducts(dto: TopProductsDto): Promise<any[]> {
    return [];
  }
}
