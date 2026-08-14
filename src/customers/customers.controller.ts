import { Controller, Get, Param, Query, ParseUUIDPipe } from "@nestjs/common";
import { CustomersService } from "./customers.service.js";
import { CustomerOrdersQueryDto } from "./dto/customer-orders-query.dto.js";
import { CustomerOrdersResponseDto } from "./dto/customer-orders-response.dto.js";

@Controller("customers")
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get(":customerId/orders")
  async findCustomerOrders(
    @Param("customerId", new ParseUUIDPipe({ version: "4" })) customerId: string,
    @Query() dto: CustomerOrdersQueryDto
  ): Promise<CustomerOrdersResponseDto> {
    return this.customersService.findCustomerOrders(customerId, dto);
  }
}
