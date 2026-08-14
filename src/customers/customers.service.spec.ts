import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { CustomersService } from './customers.service.js';
import { CustomersRepository } from './customers.repository.js';

describe('CustomersService', () => {
  let service: CustomersService;

  const mockCustomersRepository = {
    findCustomerOrders: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: CustomersRepository,
          useValue: mockCustomersRepository,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findCustomerOrders', () => {
    const mockCustomer = {
      id: 'cust-1',
      name: 'Alice Smith',
      email: 'alice@example.com',
      region: 'Europe',
    };

    const mockProduct = {
      id: 'prod-1',
      name: 'Product X',
      category: 'Clothing',
      price: '19.99',
    };

    const mockItem = {
      id: 'item-1',
      productId: 'prod-1',
      quantity: 1,
      unitPrice: '19.99',
      product: mockProduct,
    };

    const createMockOrder = (index: number, dateStr: string) => ({
      id: `order-id-${index}`,
      customerId: 'cust-1',
      status: 'SHIPPED',
      region: 'Europe',
      totalAmount: '19.99',
      orderedAt: new Date(dateStr),
      createdAt: new Date(dateStr),
      customer: mockCustomer,
      items: [mockItem],
    });

    it('should return data and nextCursor on the first page when more orders exist', async () => {
      const mockOrders = [
        createMockOrder(1, '2026-05-15T12:00:00Z'),
        createMockOrder(2, '2026-05-14T12:00:00Z'),
        createMockOrder(3, '2026-05-13T12:00:00Z'),
      ];
      mockCustomersRepository.findCustomerOrders.mockResolvedValue(mockOrders);

      const result = await service.findCustomerOrders('cust-1', { limit: 2 });

      expect(mockCustomersRepository.findCustomerOrders).toHaveBeenCalledWith(
        'cust-1',
        { limit: 2 },
      );
      expect(result.data.length).toBe(2);
      expect(result.meta.nextCursor).toEqual({
        cursorOrderId: 'order-id-3',
        cursorOrderedAt: '2026-05-13T12:00:00.000Z',
      });
    });

    it('should return nextCursor: null when no more orders remain', async () => {
      const mockOrders = [
        createMockOrder(1, '2026-05-15T12:00:00Z'),
        createMockOrder(2, '2026-05-14T12:00:00Z'),
      ];
      mockCustomersRepository.findCustomerOrders.mockResolvedValue(mockOrders);

      const result = await service.findCustomerOrders('cust-1', { limit: 2 });

      expect(result.data.length).toBe(2);
      expect(result.meta.nextCursor).toBeNull();
    });

    it('should handle customer with no orders correctly', async () => {
      mockCustomersRepository.findCustomerOrders.mockResolvedValue([]);

      const result = await service.findCustomerOrders('cust-1', { limit: 5 });

      expect(result.data.length).toBe(0);
      expect(result.meta.nextCursor).toBeNull();
      expect(result.meta.limit).toBe(5);
    });
  });
});
