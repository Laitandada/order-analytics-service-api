import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service.js";
import { OrderLookupDto } from "./dto/order-lookup.dto.js";

@Injectable()
export class OrdersRepository {
  constructor(private prisma: PrismaService) {}

  async findOne(orderId: string, dto: OrderLookupDto): Promise<any | null> {
    return null;
  }
}
