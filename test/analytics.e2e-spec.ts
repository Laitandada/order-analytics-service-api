import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types.js";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma.service.js";

describe("AnalyticsController (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tempCustomerId: string;

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

    // 1. Create temporary customer
    const customer = await prisma.customer.create({
      data: {
        name: "Analytics E2E Customer",
        email: "analytics-e2e@test.com",
        region: "North America"
      }
    });
    tempCustomerId = customer.id;

    // Relative to test date 2026-08-14:
    // Order 1: COMPLETED, Date 2026-06-01 (within 90 days), Amount 150.00
    await prisma.order.create({
      data: {
        id: "e2e-order-1111-1111-1111-111111111111",
        customerId: tempCustomerId,
        status: "COMPLETED",
        region: "North America",
        totalAmount: 150.00,
        orderedAt: new Date("2026-06-01T12:00:00Z")
      }
    });

    // Order 2: CANCELLED, Date 2026-06-01 (within 90 days), Amount 500.00
    await prisma.order.create({
      data: {
        id: "e2e-order-2222-2222-2222-222222222222",
        customerId: tempCustomerId,
        status: "CANCELLED",
        region: "North America",
        totalAmount: 500.00,
        orderedAt: new Date("2026-06-01T12:00:00Z")
      }
    });

    // Order 3: COMPLETED, Date 2026-01-01 (outside 90 days), Amount 1000.00
    await prisma.order.create({
      data: {
        id: "e2e-order-3333-3333-3333-333333333333",
        customerId: tempCustomerId,
        status: "COMPLETED",
        region: "North America",
        totalAmount: 1000.00,
        orderedAt: new Date("2026-01-01T12:00:00Z")
      }
    });
  });

  afterAll(async () => {
    // 2. Clean up temporary orders and customer
    if (tempCustomerId) {
      await prisma.order.deleteMany({
        where: { customerId: tempCustomerId }
      }).catch(() => {});

      await prisma.customer.delete({
        where: { id: tempCustomerId }
      }).catch(() => {});
    }

    await prisma.$disconnect();
    await app.close();
  });

  describe("GET /analytics/customers/revenue", () => {
    it("should aggregate revenue correctly, including only COMPLETED within 90 days", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/customers/revenue?days=90")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);

      // Locate our test customer row in the returned stats
      const customerStats = res.body.find((row: any) => row.customerId === tempCustomerId);

      expect(customerStats).toBeDefined();
      expect(customerStats.name).toBe("Analytics E2E Customer");
      // Revenue should be exactly 150.00 (excludes the 500.00 CANCELLED and 1000.00 out-of-range orders)
      expect(customerStats.revenue).toBe(150.00);
    });

    it("should return empty or exclude customer if query days = 10 (no orders in last 10 days)", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/customers/revenue?days=10")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const customerStats = res.body.find((row: any) => row.customerId === tempCustomerId);
      // Since order 1 was on June 1 (more than 10 days ago relative to Aug 14), it shouldn't show up!
      expect(customerStats).toBeUndefined();
    });
  });
});
