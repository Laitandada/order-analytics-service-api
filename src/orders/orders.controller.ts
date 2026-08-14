import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { OrderLookupDto } from './dto/order-lookup.dto.js';
import { OrderResponseDto } from './dto/order-response.dto.js';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get(':orderId')
  @ApiOperation({
    summary: 'Retrieve single order details with customer and items',
  })
  @ApiParam({ name: 'orderId', description: 'UUID v4 identifier of the order' })
  @ApiOkResponse({
    type: OrderResponseDto,
    description: 'Successfully retrieved order details',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({
    description: 'Invalid UUID parameter or query date formatting',
  })
  async findOne(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Query() dto: OrderLookupDto,
  ): Promise<OrderResponseDto> {
    const order = await this.ordersService.findOne(orderId, dto);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
    return order;
  }
}
