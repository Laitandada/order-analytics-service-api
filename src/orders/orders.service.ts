import { Injectable } from "@nestjs/common";
import { OrdersRepository } from "./orders.repository.js";
import { OrderLookupDto } from "./dto/order-lookup.dto.js";

@Injectable()
export class OrdersService {
  constructor(private ordersRepo: OrdersRepository) {}

  async findOne(orderId: string, dto: OrderLookupDto): Promise<any | null> {
    return this.ordersRepo.findOne(orderId, dto);
  }
}
