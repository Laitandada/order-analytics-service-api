import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { CustomerRevenueDto } from "./dto/customer-revenue.dto.js";
import { TopProductsDto } from "./dto/top-products.dto.js";

@Injectable()
export class AnalyticsRepository {
  constructor(private prisma: PrismaService) {}

  async getCustomerRevenue(dto: CustomerRevenueDto): Promise<any[]> {
    const days = dto.days ?? 90;
    const thresholdDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.prisma.$queryRaw<any[]>`
      SELECT o."customerId", c.name, c.email, SUM(o."totalAmount")::float as revenue
      FROM "Order" o
      JOIN "Customer" c ON o."customerId" = c.id
      WHERE o."orderedAt" >= ${thresholdDate} AND o.status != 'CANCELLED'
      GROUP BY o."customerId", c.name, c.email
      ORDER BY revenue DESC;
    `;
  }

  async getTopProducts(dto: TopProductsDto): Promise<any[]> {
    return [];
  }
}
