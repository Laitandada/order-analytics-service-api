import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CustomerOrdersQueryDto } from './dto/customer-orders-query.dto.js';

@Injectable()
export class CustomersRepository {
  constructor(private db: DatabaseService) {}

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

    return this.db.replica.order.findMany({
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
