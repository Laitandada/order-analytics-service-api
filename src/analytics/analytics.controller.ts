import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service.js';
import { CustomerRevenueDto } from './dto/customer-revenue.dto.js';
import { TopProductsDto } from './dto/top-products.dto.js';

import { CustomerRevenueResponseDto } from './dto/customer-revenue-response.dto.js';

import { TopProductRankDto } from './dto/top-products-response.dto.js';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('customers/revenue')
  @ApiOperation({
    summary: 'Get customer total revenue over a rolling day window',
  })
  @ApiOkResponse({
    type: [CustomerRevenueResponseDto],
    description: 'Successfully retrieved customer revenue report',
  })
  @ApiBadRequestResponse({
    description: 'Invalid days query range or UUID filters',
  })
  async getCustomerRevenue(
    @Query() dto: CustomerRevenueDto,
  ): Promise<CustomerRevenueResponseDto[]> {
    return this.analyticsService.getCustomerRevenue(dto);
  }

  @Get('products/top')
  @ApiOperation({
    summary:
      'Get top 20 products ranked by monthly sales revenue across regions',
  })
  @ApiOkResponse({
    type: [TopProductRankDto],
    description: 'Successfully retrieved top ranked products report',
  })
  @ApiBadRequestResponse({
    description: 'Invalid month format YYYY-MM or filtering parameters',
  })
  async getTopProducts(
    @Query() dto: TopProductsDto,
  ): Promise<TopProductRankDto[]> {
    return this.analyticsService.getTopProducts(dto);
  }
}
