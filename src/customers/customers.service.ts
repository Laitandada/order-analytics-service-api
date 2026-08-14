import { Injectable } from "@nestjs/common";
import { CustomersRepository } from "./customers.repository.js";
import { CustomerOrdersQueryDto } from "./dto/customer-orders-query.dto.js";

@Injectable()
export class CustomersService {
  constructor(private customersRepo: CustomersRepository) {}

  async findCustomerOrders(
    customerId: string,
    dto: CustomerOrdersQueryDto
  ): Promise<{ data: any[]; nextCursor: any | null }> {
    return this.customersRepo.findCustomerOrders(customerId, dto);
  }
}
