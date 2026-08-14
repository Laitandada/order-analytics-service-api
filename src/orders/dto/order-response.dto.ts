export class CustomerResponseDto {
  id: string;
  name: string;
  email: string;
  region: string;
}

export class ProductResponseDto {
  id: string;
  name: string;
  category: string;
  price: number;
}

export class OrderItemResponseDto {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product: ProductResponseDto;
}

export class OrderResponseDto {
  id: string;
  customerId: string;
  status: string;
  region: string;
  totalAmount: number;
  orderedAt: Date;
  createdAt: Date;
  customer: CustomerResponseDto;
  items: OrderItemResponseDto[];
}
