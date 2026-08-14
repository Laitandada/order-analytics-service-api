import { Injectable } from "@nestjs/common";
import { AnalyticsRepository } from "./analytics.repository.js";
import { CustomerRevenueDto } from "./dto/customer-revenue.dto.js";
import { TopProductsDto } from "./dto/top-products.dto.js";

@Injectable()
export class AnalyticsService {
  constructor(private analyticsRepo: AnalyticsRepository) {}

  async getCustomerRevenue(dto: CustomerRevenueDto): Promise<any[]> {
    return this.analyticsRepo.getCustomerRevenue(dto);
  }

  async getTopProducts(dto: TopProductsDto): Promise<any[]> {
    return this.analyticsRepo.getTopProducts(dto);
  }
}
