import { OrderResponseDto } from '../../orders/dto/order-response.dto.js';

export class PaginationCursorDto {
  cursorOrderId: string;
  cursorOrderedAt: string;
}

export class PaginationMetaDto {
  limit: number;
  nextCursor: PaginationCursorDto | null;
}

export class CustomerOrdersResponseDto {
  data: OrderResponseDto[];
  meta: PaginationMetaDto;
}
