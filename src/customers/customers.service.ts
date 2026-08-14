import { Injectable } from '@nestjs/common';
import { CustomersRepository } from './customers.repository.js';
import { CustomerOrdersQueryDto } from './dto/customer-orders-query.dto.js';
import { CustomerOrdersResponseDto } from './dto/customer-orders-response.dto.js';
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
export class CustomersService {
  constructor(private customersRepo: CustomersRepository) {}

  async findCustomerOrders(
    customerId: string,
    dto: CustomerOrdersQueryDto,
  ): Promise<CustomerOrdersResponseDto> {
    const limit = dto.limit ?? 20;
    const rawOrders = await this.customersRepo.findCustomerOrders(
      customerId,
      dto,
    );
    const orders = rawOrders as OrderWithRelations[];

    let nextCursor: { cursorOrderId: string; cursorOrderedAt: string } | null =
      null;
    const hasNextPage = orders.length === limit + 1;

    if (hasNextPage) {
      const nextOrder = orders.pop();
      if (nextOrder) {
        nextCursor = {
          cursorOrderId: nextOrder.id,
          cursorOrderedAt: nextOrder.orderedAt.toISOString(),
        };
      }
    }

    const data = orders.map((order) => ({
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
    }));

    return {
      data,
      meta: {
        limit,
        nextCursor,
      },
    };
  }
}
