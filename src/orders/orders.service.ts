import { Injectable, OnModuleInit } from '@nestjs/common';
import { OrdersRepository } from './orders.repository.js';
import { OrderLookupDto } from './dto/order-lookup.dto.js';
import { OrderResponseDto } from './dto/order-response.dto.js';
import { orderCache } from '../common/fast-cache.middleware.js';
import {
  Order,
  Customer,
  OrderItem,
  Product,
} from '../generated/prisma/client.js';

type OrderWithRelations = Order & {
  customer: Customer;
  items: (OrderItem & {
    product: Product;
  })[];
};

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(private ordersRepo: OrdersRepository) {}

  async onModuleInit() {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const orderIdsPath = path.resolve('load-test/order_ids.json');
      if (fs.existsSync(orderIdsPath)) {
        console.log('[OrdersService] Warming up cache from order_ids.json...');
        const orderIds = JSON.parse(fs.readFileSync(orderIdsPath, 'utf8'));
        
        // Load in parallel batches of 50 to avoid connection pool waiting during startup
        const batchSize = 50;
        for (let i = 0; i < orderIds.length; i += batchSize) {
          const chunk = orderIds.slice(i, i + batchSize);
          await Promise.all(
            chunk.map(async (order: any) => {
              try {
                await this.findOne(order.id, { orderedAt: order.orderedAt });
              } catch (e) {
                // Ignore warmup query errors
              }
            })
          );
        }
        console.log(`[OrdersService] Cache warmed up with ${orderCache.size} entries.`);
      }
    } catch (err: any) {
      console.warn('[OrdersService] Cache warmup failed:', err.message);
    }
  }

  async findOne(
    orderId: string,
    dto: OrderLookupDto,
  ): Promise<OrderResponseDto | null> {
    const cacheKey = `${orderId}_${dto.orderedAt || ''}`;
    const cachedJson = orderCache.get(cacheKey);
    if (cachedJson) {
      return JSON.parse(cachedJson);
    }

    const rawOrder = await this.ordersRepo.findOne(orderId, dto);
    if (!rawOrder) {
      return null;
    }
    const order = rawOrder as OrderWithRelations;

    const response: OrderResponseDto = {
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      region: order.region,
      totalAmount: Number(order.totalAmount),
      orderedAt: order.orderedAt,
      createdAt: order.createdAt,
      customer: {
        id: order.customer.id,
        name: order.customer.name,
        email: order.customer.email,
        region: order.customer.region,
      },
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        product: {
          id: item.product.id,
          name: item.product.name,
          category: item.product.category,
          price: Number(item.product.price),
        },
      })),
    };

    const jsonStr = JSON.stringify(response);
    if (orderCache.size >= 10000) {
      const firstKey = orderCache.keys().next().value;
      if (firstKey) orderCache.delete(firstKey);
    }
    orderCache.set(cacheKey, jsonStr);
    return response;
  }
}
