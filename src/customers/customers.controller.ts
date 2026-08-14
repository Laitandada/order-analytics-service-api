import { Controller, Get, Param, Query } from "@nestjs/common";
import { CustomersService } from "./customers.service.js";
import { CustomerOrdersQueryDto } from "./dto/customer-orders-query.dto.js";

@Controller("customers")
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get(":customerId/orders")
  async findCustomerOrders(
    @Param("customerId") customerId: string,
    @Query() dto: CustomerOrdersQueryDto
  ): Promise<{ data: any[]; nextCursor: any | null }> {
    return this.customersService.findCustomerOrders(customerId, dto);
  }
}
