import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma.service.js';

interface E2EOrderResponse {
  id: string;
  customerId: string;
  status: string;
  region: string;
  totalAmount: number;
  orderedAt: string;
  customer: {
    id: string;
    name: string;
    email: string;
    region: string;
  };
  items: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    product: {
      id: string;
      name: string;
      category: string;
      price: number;
    };
  }[];
}

interface E2EErrorResponse {
  message: string | string[];
}

describe('OrdersController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sampleOrderId: string;
  let sampleOrderDate: string;

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

    // Grab a real order from the database to run live integration checks
    const sampleOrder = await prisma.order.findFirst();
    if (sampleOrder) {
      sampleOrderId = sampleOrder.id;
      sampleOrderDate = sampleOrder.orderedAt.toISOString();
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /orders/:orderId', () => {
    it('should return 200 and mapped order details when order exists', async () => {
      if (!sampleOrderId) {
        console.warn('Skipping test: No sample order found in database');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/orders/${sampleOrderId}`)
        .expect(200);

      const body = res.body as E2EOrderResponse;
      expect(body).toHaveProperty('id', sampleOrderId);
      expect(body).toHaveProperty('customerId');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('region');
      expect(body).toHaveProperty('totalAmount');
      expect(body).toHaveProperty('orderedAt');
      expect(body).toHaveProperty('customer');
      expect(body.customer).toHaveProperty('name');
      expect(body).toHaveProperty('items');
      expect(Array.isArray(body.items)).toBe(true);
      if (body.items.length > 0) {
        expect(body.items[0]).toHaveProperty('productId');
        expect(body.items[0]).toHaveProperty('product');
        expect(body.items[0].product).toHaveProperty('name');
      }
    });

    it('should return 200 with partition pruning when orderedAt query param is supplied', async () => {
      if (!sampleOrderId || !sampleOrderDate) {
        console.warn('Skipping test: No sample order found in database');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/orders/${sampleOrderId}?orderedAt=${sampleOrderDate}`)
        .expect(200);

      const body = res.body as E2EOrderResponse;
      expect(body).toHaveProperty('id', sampleOrderId);
      expect(new Date(body.orderedAt).toISOString()).toBe(sampleOrderDate);
    });

    it('should return 400 when orderId is a malformed UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/not-a-valid-uuid')
        .expect(400);

      const body = res.body as E2EErrorResponse;
      expect(body).toHaveProperty('message');
      expect(body.message).toContain('Validation failed');
    });

    it('should return 404 when orderId is a valid UUID but does not exist', async () => {
      const nonExistentUuid = 'deadbeef-4000-4000-a000-000000000000';
      const res = await request(app.getHttpServer())
        .get(`/orders/${nonExistentUuid}`)
        .expect(404);

      const body = res.body as E2EErrorResponse;
      expect(body).toHaveProperty('message');
      expect(body.message).toContain(
        `Order with ID ${nonExistentUuid} not found`,
      );
    });
  });
});
