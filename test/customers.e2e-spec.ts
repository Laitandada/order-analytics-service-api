import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma.service.js";

describe("CustomersController (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sampleCustomerId: string;
  let emptyCustomerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // 1. Fetch a customer who has orders
    const customerWithOrders = await prisma.customer.findFirst({
      where: {
        orders: {
          some: {}
        }
      }
    });
    if (customerWithOrders) {
      sampleCustomerId = customerWithOrders.id;
    }

    // 2. Create a temporary customer with no orders to test empty checks
    const emptyCustomer = await prisma.customer.create({
      data: {
        name: "Empty Customer Test",
        email: "empty-e2e@test.com",
        region: "North America"
      }
    });
    emptyCustomerId = emptyCustomer.id;
  });

  afterAll(async () => {
    // Cleanup temporary customer
    if (emptyCustomerId) {
      await prisma.customer.delete({
        where: { id: emptyCustomerId }
      }).catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe("GET /customers/:customerId/orders", () => {
    it("should return first page of orders and nextCursor metadata", async () => {
      if (!sampleCustomerId) {
        console.warn("Skipping test: No sample customer with orders found");
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/customers/${sampleCustomerId}/orders?limit=2`)
        .expect(200);

      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("meta");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta).toHaveProperty("limit", 2);
      expect(res.body.meta).toHaveProperty("nextCursor");
    });

    it("should fetch the second page successfully using the returned nextCursor", async () => {
      if (!sampleCustomerId) {
        console.warn("Skipping test: No sample customer with orders found");
        return;
      }

      // Fetch page 1
      const resPage1 = await request(app.getHttpServer())
        .get(`/customers/${sampleCustomerId}/orders?limit=1`)
        .expect(200);

      const nextCursor = resPage1.body.meta.nextCursor;
      if (!nextCursor) {
        // Customer has only 1 order, skipping next page test
        return;
      }

      // Fetch page 2
      const resPage2 = await request(app.getHttpServer())
        .get(
          `/customers/${sampleCustomerId}/orders?limit=1&cursorOrderId=${nextCursor.cursorOrderId}&cursorOrderedAt=${nextCursor.cursorOrderedAt}`
        )
        .expect(200);

      expect(resPage2.body).toHaveProperty("data");
      expect(Array.isArray(resPage2.body.data)).toBe(true);
      expect(resPage2.body.data.length).toBeLessThanOrEqual(1);

      // Verify that page 2 orders are older than the cursor order
      if (resPage1.body.data.length > 0 && resPage2.body.data.length > 0) {
        const order1 = resPage1.body.data[0];
        const order2 = resPage2.body.data[0];
        expect(new Date(order2.orderedAt).getTime()).toBeLessThanOrEqual(
          new Date(order1.orderedAt).getTime()
        );
      }
    });

    it("should return empty array and nextCursor null for customer with no orders", async () => {
      const res = await request(app.getHttpServer())
        .get(`/customers/${emptyCustomerId}/orders?limit=5`)
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.nextCursor).toBeNull();
      expect(res.body.meta.limit).toBe(5);
    });

    it("should reject page limit greater than 100 with 400 Bad Request", async () => {
      const res = await request(app.getHttpServer())
        .get(`/customers/${emptyCustomerId}/orders?limit=101`)
        .expect(400);

      expect(res.body.message).toContain("limit must not be greater than 100");
    });

    it("should reject malformed cursor date with 400 Bad Request", async () => {
      const res = await request(app.getHttpServer())
        .get(`/customers/${emptyCustomerId}/orders?limit=5&cursorOrderedAt=not-a-date`)
        .expect(400);

      expect(res.body.message).toContain("cursorOrderedAt must be a valid ISO 8601 date string");
    });
  });
});


