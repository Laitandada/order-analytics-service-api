import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { CustomerOrdersQueryDto } from "./dto/customer-orders-query.dto.js";

@Injectable()
export class CustomersRepository {
  constructor(private prisma: PrismaService) {}

  async findCustomerOrders(
    customerId: string,
    dto: CustomerOrdersQueryDto
  ): Promise<{ data: any[]; nextCursor: any | null }> {
    return {
      data: [],
      nextCursor: null
    };
  }
}
