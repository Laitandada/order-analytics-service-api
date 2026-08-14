import { Injectable } from "@nestjs/common";
import { AnalyticsRepository } from "./analytics.repository.js";
import { CustomerRevenueDto } from "./dto/customer-revenue.dto.js";
import { TopProductsDto } from "./dto/top-products.dto.js";

import { CustomerRevenueResponseDto } from "./dto/customer-revenue-response.dto.js";

@Injectable()
export class AnalyticsService {
  constructor(private analyticsRepo: AnalyticsRepository) {}

  async getCustomerRevenue(dto: CustomerRevenueDto): Promise<CustomerRevenueResponseDto[]> {
    const rawData = await this.analyticsRepo.getCustomerRevenue(dto);
    return rawData.map((row: any) => ({
      customerId: row.customerId,
      name: row.name,
      email: row.email,
      revenue: Number(row.revenue),
    }));
  }

  async getTopProducts(dto: TopProductsDto): Promise<any[]> {
    return this.analyticsRepo.getTopProducts(dto);
  }
}
