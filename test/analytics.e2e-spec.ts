import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma.service.js';

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tempCustomerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // 1. Create temporary customer
    const customer = await prisma.customer.create({
      data: {
        name: 'Analytics E2E Customer',
        email: 'analytics-e2e@test.com',
        region: 'North America',
      },
    });
    tempCustomerId = customer.id;

    // Relative to test date 2026-08-14:
    // Order 1: COMPLETED, Date 2026-06-01 (within 90 days), Amount 150.00
    await prisma.order.create({
      data: {
        id: 'e2e-order-1111-1111-1111-111111111111',
        customerId: tempCustomerId,
        status: 'COMPLETED',
        region: 'North America',
        totalAmount: 150.0,
        orderedAt: new Date('2026-06-01T12:00:00Z'),
      },
    });

    // Order 2: CANCELLED, Date 2026-06-01 (within 90 days), Amount 500.00
    await prisma.order.create({
      data: {
        id: 'e2e-order-2222-2222-2222-222222222222',
        customerId: tempCustomerId,
        status: 'CANCELLED',
        region: 'North America',
        totalAmount: 500.0,
        orderedAt: new Date('2026-06-01T12:00:00Z'),
      },
    });

    // Order 3: COMPLETED, Date 2026-01-01 (outside 90 days), Amount 1000.00
    await prisma.order.create({
      data: {
        id: 'e2e-order-3333-3333-3333-333333333333',
        customerId: tempCustomerId,
        status: 'COMPLETED',
        region: 'North America',
        totalAmount: 1000.0,
        orderedAt: new Date('2026-01-01T12:00:00Z'),
      },
    });
  });

  afterAll(async () => {
    // 2. Clean up temporary orders and customer
    if (tempCustomerId) {
      await prisma.order
        .deleteMany({
          where: { customerId: tempCustomerId },
        })
        .catch(() => {});

      await prisma.customer
        .delete({
          where: { id: tempCustomerId },
        })
        .catch(() => {});
    }

    await prisma.$disconnect();
    await app.close();
  });

  interface E2ECustomerRevenueResponse {
    customerId: string;
    name: string;
    email: string;
    revenue: number;
  }

  interface E2ETopProductRankResponse {
    region: string;
    month: string;
    productId: string;
    productName: string;
    productCategory: string;
    revenue: number;
    rank: number;
  }

  interface E2EErrorResponse {
    message: string | string[];
  }

  describe('GET /analytics/customers/revenue', () => {
    it('should aggregate revenue correctly, including only COMPLETED within 90 days', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/customers/revenue?days=90')
        .expect(200);

      const body = res.body as E2ECustomerRevenueResponse[];
      expect(Array.isArray(body)).toBe(true);

      const customerStats = body.find(
        (row) => row.customerId === tempCustomerId,
      );

      expect(customerStats).toBeDefined();
      if (customerStats) {
        expect(customerStats.name).toBe('Analytics E2E Customer');
        expect(customerStats.revenue).toBe(150.0);
      }
    });

    it('should return empty or exclude customer if query days = 10 (no orders in last 10 days)', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/customers/revenue?days=10')
        .expect(200);

      const body = res.body as E2ECustomerRevenueResponse[];
      expect(Array.isArray(body)).toBe(true);
      const customerStats = body.find(
        (row) => row.customerId === tempCustomerId,
      );
      expect(customerStats).toBeUndefined();
    });

    it('should reject query days greater than 365 with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/customers/revenue?days=366')
        .expect(400);

      const body = res.body as E2EErrorResponse;
      expect(body.message).toContain('days must not be greater than 365');
    });

    it('should reject malformed customerId filter with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/customers/revenue?customerId=not-a-uuid')
        .expect(400);

      const body = res.body as E2EErrorResponse;
      expect(body.message).toContain('customerId must be a UUID');
    });
  });

  describe('GET /analytics/products/top', () => {
    it('should return the top ranked products by region and month', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/products/top')
        .expect(200);

      const body = res.body as E2ETopProductRankResponse[];
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        const item = body[0];
        expect(item).toHaveProperty('region');
        expect(item).toHaveProperty('month');
        expect(item).toHaveProperty('productId');
        expect(item).toHaveProperty('productName');
        expect(item).toHaveProperty('productCategory');
        expect(item).toHaveProperty('revenue');
        expect(item).toHaveProperty('rank');
        expect(item.rank).toBeLessThanOrEqual(20);
      }
    });

    it('should accept month filtering in YYYY-MM format', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/products/top?month=2026-05')
        .expect(200);

      const body = res.body as E2ETopProductRankResponse[];
      expect(Array.isArray(body)).toBe(true);
      body.forEach((item) => {
        expect(item.month).toBe('2026-05');
      });
    });

    it('should reject invalid month format with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/products/top?month=2026/05')
        .expect(400);

      const body = res.body as E2EErrorResponse;
      expect(body.message).toContain('month must be in YYYY-MM format');
    });
  });
});
