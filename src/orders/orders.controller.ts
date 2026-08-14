import { Controller, Get, Param, Query, NotFoundException } from "@nestjs/common";
import { OrdersService } from "./orders.service.js";
import { OrderLookupDto } from "./dto/order-lookup.dto.js";

@Controller("orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get(":orderId")
  async findOne(
    @Param("orderId") orderId: string,
    @Query() dto: OrderLookupDto
  ): Promise<any> {
    const order = await this.ordersService.findOne(orderId, dto);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    return order;
  }
}
