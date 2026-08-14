import { Injectable } from '@nestjs/common';
import { ReadPrismaService } from '../read-prisma.service.js';
import { CustomerOrdersQueryDto } from './dto/customer-orders-query.dto.js';

@Injectable()
export class CustomersRepository {
  // Paginated order history is routed to the read replica.
  // Users browsing historical pages tolerate a few seconds of replication lag.
  constructor(private readPrisma: ReadPrismaService) {}

  async findCustomerOrders(
    customerId: string,
    dto: CustomerOrdersQueryDto,
  ): Promise<any[]> {
    const limit = dto.limit ?? 20;

    const cursorCondition =
      dto.cursorOrderedAt && dto.cursorOrderId
        ? {
            OR: [
              {
                orderedAt: {
                  lt: new Date(dto.cursorOrderedAt),
                },
              },
              {
                orderedAt: new Date(dto.cursorOrderedAt),
                id: {
                  lt: dto.cursorOrderId,
                },
              },
            ],
          }
        : {};

    return this.readPrisma.order.findMany({
      where: {
        customerId,
        ...cursorCondition,
      },
      orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}
