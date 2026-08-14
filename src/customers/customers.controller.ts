import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service.js';
import { CustomerOrdersQueryDto } from './dto/customer-orders-query.dto.js';
import { CustomerOrdersResponseDto } from './dto/customer-orders-response.dto.js';

@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get(':customerId/orders')
  @ApiOperation({
    summary: 'Get customer order history using keyset cursor pagination',
  })
  @ApiParam({
    name: 'customerId',
    description: 'UUID v4 identifier of the customer',
  })
  @ApiOkResponse({
    type: CustomerOrdersResponseDto,
    description: 'Successfully retrieved paginated order history list',
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID parameter or query cursor configurations',
  })
  async findCustomerOrders(
    @Param('customerId', new ParseUUIDPipe({ version: '4' }))
    customerId: string,
    @Query() dto: CustomerOrdersQueryDto,
  ): Promise<CustomerOrdersResponseDto> {
    return this.customersService.findCustomerOrders(customerId, dto);
  }
}
