import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository.js';
import { CustomerRevenueDto } from './dto/customer-revenue.dto.js';
import { TopProductsDto } from './dto/top-products.dto.js';

import { CustomerRevenueResponseDto } from './dto/customer-revenue-response.dto.js';

import { TopProductRankDto } from './dto/top-products-response.dto.js';

interface RawCustomerRevenueRow {
  customerId: string;
  name: string;
  email: string;
  revenue: number | string;
}

interface RawTopProductRow {
  region: string;
  month: string;
  productId: string;
  productName: string;
  productCategory: string;
  revenue: number | string;
  rank: number | string;
}

@Injectable()
export class AnalyticsService {
  constructor(private analyticsRepo: AnalyticsRepository) {}

  async getCustomerRevenue(
    dto: CustomerRevenueDto,
  ): Promise<CustomerRevenueResponseDto[]> {
    const rawData = await this.analyticsRepo.getCustomerRevenue(dto);
    const data = rawData as RawCustomerRevenueRow[];
    return data.map((row) => ({
      customerId: row.customerId,
      name: row.name,
      email: row.email,
      revenue: Number(row.revenue),
    }));
  }

  async getTopProducts(dto: TopProductsDto): Promise<TopProductRankDto[]> {
    const rawData = await this.analyticsRepo.getTopProducts(dto);
    const data = rawData as RawTopProductRow[];
    return data.map((row) => ({
      region: row.region,
      month: row.month,
      productId: row.productId,
      productName: row.productName,
      productCategory: row.productCategory,
      revenue: Number(row.revenue),
      rank: Number(row.rank),
    }));
  }
}
