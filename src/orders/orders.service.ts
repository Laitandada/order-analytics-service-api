import { Injectable } from "@nestjs/common";
import { OrdersRepository } from "./orders.repository.js";
import { OrderLookupDto } from "./dto/order-lookup.dto.js";

import { OrderResponseDto } from "./dto/order-response.dto.js";

@Injectable()
export class OrdersService {
  constructor(private ordersRepo: OrdersRepository) {}

  async findOne(orderId: string, dto: OrderLookupDto): Promise<OrderResponseDto | null> {
    const order = await this.ordersRepo.findOne(orderId, dto);
    if (!order) {
      return null;
    }

    return {
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
      items: order.items.map((item: any) => ({
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
  }
}
