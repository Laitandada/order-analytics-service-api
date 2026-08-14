import { Injectable } from '@nestjs/common';
import { ReadPrismaService } from '../read-prisma.service.js';
import { CustomerRevenueDto } from './dto/customer-revenue.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { TopProductsDto } from './dto/top-products.dto.js';

@Injectable()
export class AnalyticsRepository {
  // Analytics queries are routed to the read replica.
  // These aggregations tolerate slight replication lag (seconds).
  constructor(private readPrisma: ReadPrismaService) {}

  async getCustomerRevenue(dto: CustomerRevenueDto): Promise<any[]> {
    const days = dto.days ?? 90;
    const thresholdDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.readPrisma.$queryRaw<any[]>`
      SELECT o."customerId", c.name, c.email, SUM(o."totalAmount")::float as revenue
      FROM "Order" o
      JOIN "Customer" c ON o."customerId" = c.id
      WHERE o."orderedAt" >= ${thresholdDate} AND o.status != 'CANCELLED'
      GROUP BY o."customerId", c.name, c.email
      ORDER BY revenue DESC;
    `;
  }

  async getTopProducts(dto: TopProductsDto): Promise<any[]> {
    const conditions: Prisma.Sql[] = [];

    conditions.push(Prisma.sql`o.status != 'CANCELLED'`);

    if (dto.region) {
      conditions.push(Prisma.sql`o.region = ${dto.region}`);
    }

    if (dto.month) {
      const [year, monthStr] = dto.month.split('-').map(Number);
      const startDate = new Date(Date.UTC(year, monthStr - 1, 1));
      const endDate = new Date(Date.UTC(year, monthStr, 1));

      conditions.push(Prisma.sql`o."orderedAt" >= ${startDate}`);
      conditions.push(Prisma.sql`o."orderedAt" < ${endDate}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    return this.readPrisma.$queryRaw<any[]>`
      WITH product_sales AS (
        SELECT 
          o.region,
          TO_CHAR(o."orderedAt", 'YYYY-MM') as month,
          oi."productId",
          p.name as "productName",
          p.category as "productCategory",
          SUM((oi.quantity)::numeric * oi."unitPrice")::float as revenue
        FROM "OrderItem" oi
        JOIN "Order" o ON oi."orderId" = o.id AND oi."orderedAt" = o."orderedAt"
        JOIN "Product" p ON oi."productId" = p.id
        ${whereClause}
        GROUP BY o.region, TO_CHAR(o."orderedAt", 'YYYY-MM'), oi."productId", p.name, p.category
      ),
      ranked_sales AS (
        SELECT 
          region,
          month,
          "productId",
          "productName",
          "productCategory",
          revenue,
          DENSE_RANK() OVER (
            PARTITION BY region, month
            ORDER BY revenue DESC
          )::integer as rank
        FROM product_sales
      )
      SELECT * 
      FROM ranked_sales
      WHERE rank <= 20
      ORDER BY region, month, rank;
    `;
  }
}
