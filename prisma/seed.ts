import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import crypto from "node:crypto";
import "dotenv/config";

// Seedable Pseudo-Random Number Generator (LCG) for reproducible runs
class SeededRandom {
  private seed: number;

  constructor(seed: number = 12345) {
    this.seed = seed;
  }

  // Returns a number between 0 and 1
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  // Returns an integer between [min, max)
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  // Returns a random element from an array
  nextElement<T>(array: T[]): T {
    return array[this.nextInt(0, array.length)];
  }
}

const REGIONS = [
  "North America",
  "Europe",
  "Asia-Pacific",
  "Latin America",
  "Middle East & Africa"
];

const CATEGORIES = [
  { name: "Electronics", minPrice: 50, maxPrice: 1500 },
  { name: "Apparel", minPrice: 10, maxPrice: 150 },
  { name: "Home & Kitchen", minPrice: 15, maxPrice: 400 },
  { name: "Sports & Outdoors", minPrice: 10, maxPrice: 300 },
  { name: "Books & Media", minPrice: 5, maxPrice: 50 }
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }

  const mode = (process.env.SEED_MODE || "dev").toLowerCase();
  const batchSize = parseInt(process.env.SEED_BATCH_SIZE || "2500", 10);

  let numCustomers = 1000;
  let numProducts = 20;
  let numOrders = 10000;

  if (mode === "full") {
    numCustomers = 50000;
    numProducts = 500;
    numOrders = 5000000;
  }

  console.log(`--- Starting Prisma Database Seeding ---`);
  console.log(`Database URL: ${connectionString.replace(/:([^:@]+)@/, ":*****@")}`);
  console.log(`Seed Mode: ${mode.toUpperCase()}`);
  console.log(`Target: ${numCustomers} customers, ${numProducts} products, ${numOrders} orders`);
  console.log(`Batch size: ${batchSize} orders`);

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const rng = new SeededRandom(98765);

    // 1. Clear database
    console.log("Cleaning up existing database tables...");
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.customer.deleteMany();
    console.log("Cleanup finished.");

    // 2. Seed Products
    console.log(`Generating ${numProducts} products...`);
    const productsData: any[] = [];
    for (let i = 1; i <= numProducts; i++) {
      const category = rng.nextElement(CATEGORIES);
      const price = (rng.next() * (category.maxPrice - category.minPrice) + category.minPrice).toFixed(2);
      productsData.push({
        id: crypto.randomUUID(),
        name: `${category.name} Item ${i}`,
        category: category.name,
        price: price
      });
    }

    // Insert products in single batch (max 500 records)
    await prisma.product.createMany({ data: productsData });
    console.log(`Successfully seeded ${numProducts} products.`);

    // Retrieve product list to use for order items
    const products = await prisma.product.findMany({
      select: { id: true, price: true }
    });

    // 3. Seed Customers
    console.log(`Generating ${numCustomers} customers in batches...`);
    const customerBatchSize = 5000;
    const numCustomerBatches = Math.ceil(numCustomers / customerBatchSize);

    for (let cb = 0; cb < numCustomerBatches; cb++) {
      const customersBatchData: any[] = [];
      const currentBatchSize = Math.min(customerBatchSize, numCustomers - cb * customerBatchSize);

      for (let i = 1; i <= currentBatchSize; i++) {
        const id = crypto.randomUUID();
        const index = cb * customerBatchSize + i;
        customersBatchData.push({
          id,
          name: `Customer Name ${index}`,
          email: `customer_${index}_${crypto.randomBytes(3).toString("hex")}@example.com`,
          region: rng.nextElement(REGIONS)
        });
      }

      await prisma.customer.createMany({ data: customersBatchData });
    }
    console.log(`Successfully seeded ${numCustomers} customers.`);

    // Retrieve customers (id and region) to allocate to orders
    console.log("Loading customer registry for order assignment...");
    const customers = await prisma.customer.findMany({
      select: { id: true, region: true }
    });
    console.log("Customer registry loaded.");

    // 4. Seed Orders and OrderItems
    console.log(`Generating ${numOrders} orders and items in batches of ${batchSize}...`);
    const numOrderBatches = Math.ceil(numOrders / batchSize);
    const startSeedTime = Date.now();

    for (let ob = 0; ob < numOrderBatches; ob++) {
      const ordersBatch: any[] = [];
      const orderItemsBatch: any[] = [];
      const currentBatchSize = Math.min(batchSize, numOrders - ob * batchSize);

      for (let i = 0; i < currentBatchSize; i++) {
        const orderId = crypto.randomUUID();
        const customer = rng.nextElement(customers);

        // Date range: distribution over the last 120 days
        const daysAgo = rng.next() * 120;
        const orderedAt = new Date();
        orderedAt.setMilliseconds(orderedAt.getMilliseconds() - daysAgo * 24 * 60 * 60 * 1000);

        const status = rng.nextElement([
          "COMPLETED", "COMPLETED", "COMPLETED",
          "SHIPPED", "SHIPPED",
          "PENDING",
        ]);

        const numItems = rng.nextInt(1, 5);
        let orderTotal = 0;

        for (let j = 0; j < numItems; j++) {
          const product = rng.nextElement(products);
          const quantity = rng.nextInt(1, 6); 
          const unitPrice = parseFloat(product.price.toString());
          orderTotal += unitPrice * quantity;

          orderItemsBatch.push({
            id: crypto.randomUUID(),
            orderId,
            orderedAt,
            productId: product.id,
            quantity,
            unitPrice: product.price
          });
        }

        ordersBatch.push({
          id: orderId,
          customerId: customer.id,
          status,
          region: customer.region,
          totalAmount: orderTotal.toFixed(2),
          orderedAt,
          createdAt: orderedAt
        });
      }

      // Execute atomic transaction for the order chunk
      await prisma.$transaction([
        prisma.order.createMany({ data: ordersBatch }),
        prisma.orderItem.createMany({ data: orderItemsBatch })
      ]);

      // Print status updates
      if ((ob + 1) % 10 === 0 || ob + 1 === numOrderBatches) {
        const progress = Math.min(100, Math.round(((ob + 1) / numOrderBatches) * 100));
        const duration = ((Date.now() - startSeedTime) / 1000).toFixed(1);
        console.log(`Progress: ${progress}% | Chunk ${ob + 1}/${numOrderBatches} | Seeded ${(ob + 1) * batchSize} orders in ${duration}s`);
      }
    }

    const finalDuration = ((Date.now() - startSeedTime) / 1000).toFixed(1);
    console.log(`Seeding completed successfully in ${finalDuration} seconds!`);
  } catch (error) {
    console.error("Critical error during database seeding:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
