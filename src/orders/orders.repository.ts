import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { OrderLookupDto } from './dto/order-lookup.dto.js';
import { perfStorage } from '../common/perf-storage.js';


@Injectable()
export class OrdersRepository {
  constructor(private db: DatabaseService) {}

  async findOne(orderId: string, dto: OrderLookupDto): Promise<unknown> {
    const requestStart = performance.now();
    const includeQuery = {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    };

    const dbStart = performance.now();

    let result: unknown;

    // Optionally use a single raw SQL query to fetch order + customer + items+products
    // in one round trip. Enable by setting USE_RAW_ORDER_QUERY=true in the environment.
    const useRaw = process.env.USE_RAW_ORDER_QUERY === 'true';

    if (useRaw && !dto.orderedAt) {
      // Build a single JSON-producing query that aggregates order items and products.
      const sql = `
        SELECT row_to_json(ord) AS order_json FROM (
          SELECT o.id, o."orderedAt", o."customerId", o.status, o.region, o."totalAmount", o."createdAt",
            row_to_json(c.*) AS customer,
            (
              SELECT coalesce(json_agg(json_build_object(
                'id', oi.id,
                'productId', oi."productId",
                'quantity', oi.quantity,
                'unitPrice', oi."unitPrice",
                'product', json_build_object('id', p.id, 'name', p.name, 'category', p.category, 'price', p.price)
              )), '[]') FROM "OrderItem" oi
              JOIN "Product" p ON p.id = oi."productId"
              WHERE oi."orderId" = o.id AND oi."orderedAt" = o."orderedAt"
            ) AS items
          FROM "Order" o
          JOIN "Customer" c ON c.id = o."customerId"
          WHERE o.id = $1
          LIMIT 1
        ) ord
      `;

      const raw = await (this.db.primary as any).$queryRawUnsafe(sql, orderId);
      // $queryRawUnsafe returns an array of rows; extract order_json
      result = raw && raw[0] ? raw[0].order_json : null;
    } else if (dto.orderedAt) {
      result = await this.db.primary.order.findUnique({
        where: {
          id_orderedAt: {
            id: orderId,
            orderedAt: new Date(dto.orderedAt),
          },
        },
        include: includeQuery,
      });
    } else {
      result = await this.db.primary.order.findFirst({
        where: { id: orderId },
        include: includeQuery,
      });
    }

    const dbDuration = performance.now() - dbStart;
    const store = perfStorage.getStore();
    if (store) {
      store.prismaQueryDuration = Math.max(0, dbDuration - store.connectionAcquireDuration);
    }
    console.log(`[OrdersRepository] DB query: ${dbDuration.toFixed(2)}ms  orderId=${orderId}`);

    const totalDuration = performance.now() - requestStart;
    console.log(`[OrdersRepository] Total request: ${totalDuration.toFixed(2)}ms  orderId=${orderId}`);

    return result;
  }
}
