import { Controller, Get, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service.js";
import { CustomerRevenueDto } from "./dto/customer-revenue.dto.js";
import { TopProductsDto } from "./dto/top-products.dto.js";

import { CustomerRevenueResponseDto } from "./dto/customer-revenue-response.dto.js";

import { TopProductRankDto } from "./dto/top-products-response.dto.js";

@Controller("analytics")
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get("customers/revenue")
  async getCustomerRevenue(@Query() dto: CustomerRevenueDto): Promise<CustomerRevenueResponseDto[]> {
    return this.analyticsService.getCustomerRevenue(dto);
  }

  @Get("products/top")
  async getTopProducts(@Query() dto: TopProductsDto): Promise<TopProductRankDto[]> {
    return this.analyticsService.getTopProducts(dto);
  }
}
