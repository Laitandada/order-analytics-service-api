import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { OrdersService } from './orders.service.js';
import { OrdersRepository } from './orders.repository.js';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockOrdersRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrdersRepository,
          useValue: mockOrdersRepository,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return mapped OrderResponseDto when order exists', async () => {
      const mockOrder = {
        id: 'mock-order-id',
        customerId: 'mock-customer-id',
        status: 'COMPLETED',
        region: 'North America',
        totalAmount: '150.50',
        orderedAt: new Date('2026-05-15T10:00:00Z'),
        createdAt: new Date('2026-05-15T10:00:00Z'),
        customer: {
          id: 'mock-customer-id',
          name: 'Bob Jones',
          email: 'bob@example.com',
          region: 'North America',
        },
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 2,
            unitPrice: '75.25',
            product: {
              id: 'prod-1',
              name: 'Product A',
              category: 'Electronics',
              price: '75.25',
            },
          },
        ],
      };

      mockOrdersRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.findOne('mock-order-id', {});

      expect(mockOrdersRepository.findOne).toHaveBeenCalledWith(
        'mock-order-id',
        {},
      );
      expect(result).toEqual({
        id: 'mock-order-id',
        customerId: 'mock-customer-id',
        status: 'COMPLETED',
        region: 'North America',
        totalAmount: 150.5,
        orderedAt: mockOrder.orderedAt,
        createdAt: mockOrder.createdAt,
        customer: {
          id: 'mock-customer-id',
          name: 'Bob Jones',
          email: 'bob@example.com',
          region: 'North America',
        },
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            quantity: 2,
            unitPrice: 75.25,
            product: {
              id: 'prod-1',
              name: 'Product A',
              category: 'Electronics',
              price: 75.25,
            },
          },
        ],
      });
    });

    it('should return null when order does not exist', async () => {
      mockOrdersRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id', {});

      expect(mockOrdersRepository.findOne).toHaveBeenCalledWith(
        'non-existent-id',
        {},
      );
      expect(result).toBeNull();
    });
  });
});
