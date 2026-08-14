import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { OrderLookupDto } from './dto/order-lookup.dto.js';

@Injectable()
export class OrdersRepository {
  constructor(private prisma: PrismaService) {}

  async findOne(orderId: string, dto: OrderLookupDto): Promise<unknown> {
    const includeQuery = {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    };

    if (dto.orderedAt) {
      return this.prisma.order.findUnique({
        where: {
          id_orderedAt: {
            id: orderId,
            orderedAt: new Date(dto.orderedAt),
          },
        },
        include: includeQuery,
      });
    }

    return this.prisma.order.findFirst({
      where: { id: orderId },
      include: includeQuery,
    });
  }
}
