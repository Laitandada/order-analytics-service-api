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
    numOrders = parseInt(process.env.SEED_FULL_ORDERS_COUNT || "5000000", 10);
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

    // Retrieve product list to use for order items if in dev mode
    let products: any[] = [];
    if (mode !== "full") {
      products = await prisma.product.findMany({
        select: { id: true, price: true }
      });
    }

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

    // Retrieve customers (id and region) to allocate to orders if in dev mode
    let customers: any[] = [];
    if (mode !== "full") {
      console.log("Loading customer registry for order assignment...");
      customers = await prisma.customer.findMany({
        select: { id: true, region: true }
      });
      console.log("Customer registry loaded.");
    }

    // 4. Seed Orders and OrderItems
    if (mode === "full") {
      await seedFullDatasetWithPostgres(pool, numOrders, numCustomers, numProducts);
    } else {
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
        await prisma.$transaction(
          [
            prisma.order.createMany({ data: ordersBatch }),
            prisma.orderItem.createMany({ data: orderItemsBatch })
          ],
          {
            timeout: 30000,
          }
        );

        // Print status updates
        if ((ob + 1) % 10 === 0 || ob + 1 === numOrderBatches) {
          const progress = Math.min(100, Math.round(((ob + 1) / numOrderBatches) * 100));
          const duration = ((Date.now() - startSeedTime) / 1000).toFixed(1);
          const memory = process.memoryUsage();

          console.log(
            `Progress: ${progress}% | ` +
            `Chunk ${ob + 1}/${numOrderBatches} | ` +
            `Seeded ${Math.min((ob + 1) * batchSize, numOrders)} orders | ` +
            `${duration}s | ` +
            `Heap: ${Math.round(memory.heapUsed / 1024 / 1024)}MB / ` +
            `${Math.round(memory.heapTotal / 1024 / 1024)}MB | ` +
            `RSS: ${Math.round(memory.rss / 1024 / 1024)}MB`
          );
        }
      }

      const finalDuration = ((Date.now() - startSeedTime) / 1000).toFixed(1);
      console.log(`Seeding completed successfully in ${finalDuration} seconds!`);
    }

    // Run verification queries on the final database
    await runValidation(pool);
  } catch (error) {
    console.error("Critical error during database seeding:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function seedFullDatasetWithPostgres(
  pool: pg.Pool,
  numOrders: number,
  numCustomers: number,
  numProducts: number
) {
  const client = await pool.connect();
  try {
    const startSeedTime = Date.now();
    console.log(`\n--- Starting PostgreSQL-Native Bulk Seeding ---`);
    console.log(`Target: ${numOrders} orders`);

    // Create temporary tables for customer and product sequential mapping
    console.log("Creating temporary customer mapping table...");
    await client.query(`
      CREATE TEMP TABLE temp_customers AS
      SELECT id, region, ROW_NUMBER() OVER (ORDER BY id) as row_num
      FROM "Customer";
    `);
    await client.query(`CREATE INDEX temp_customers_row_num_idx ON temp_customers(row_num);`);

    console.log("Creating temporary product mapping table...");
    await client.query(`
      CREATE TEMP TABLE temp_products AS
      SELECT id, price, ROW_NUMBER() OVER (ORDER BY id) as row_num
      FROM "Product";
    `);
    await client.query(`CREATE INDEX temp_products_row_num_idx ON temp_products(row_num);`);

    const ordersPerBatch = 1000000;
    const numBatches = Math.ceil(numOrders / ordersPerBatch);
    const baseDate = new Date();

    for (let b = 0; b < numBatches; b++) {
      const batchStartTime = Date.now();
      const currentBatchOrders = Math.min(ordersPerBatch, numOrders - b * ordersPerBatch);

      console.log(`[Batch ${b + 1}/${numBatches}] Generating ${currentBatchOrders} orders...`);

      try {
        await client.query("BEGIN;");

        // 1. Drop existing temp tables for the batch if any
        await client.query(`
          DROP TABLE IF EXISTS temp_orders_base CASCADE;
          DROP TABLE IF EXISTS temp_order_items CASCADE;
          DROP TABLE IF EXISTS temp_order_totals CASCADE;
        `);

        // 2. Generate base orders
        await client.query(
          `
          CREATE TEMP TABLE temp_orders_base AS
          WITH orders_with_random_nums AS (
            SELECT
              gen_random_uuid()::text as id,
              (floor(random() * $3) + 1)::int as cust_row_num,
              random() as status_rand,
              CAST($1::timestamp - (random() * 120) * INTERVAL '1 day' AS timestamp(3)) as ordered_at
            FROM generate_series(1, $2) s(i)
          )
          SELECT
            o.id,
            c.id as customer_id,
            (CASE
               WHEN o.status_rand < 0.50 THEN 'COMPLETED'::"OrderStatus"
               WHEN o.status_rand < 0.8333 THEN 'SHIPPED'::"OrderStatus"
               ELSE 'PENDING'::"OrderStatus"
             END) as status,
            c.region,
            o.ordered_at
          FROM orders_with_random_nums o
          JOIN temp_customers c ON c.row_num = o.cust_row_num;
          `,
          [baseDate, currentBatchOrders, numCustomers]
        );
        await client.query(`CREATE INDEX temp_orders_base_id_idx ON temp_orders_base(id, ordered_at);`);

        // 3. Generate order items
        await client.query(
          `
          CREATE TEMP TABLE temp_order_items AS
          WITH orders_with_item_counts AS (
            SELECT
              id as order_id,
              ordered_at,
              (floor(random() * 4) + 1)::int as num_items
            FROM temp_orders_base
          ),
          items_base AS (
            SELECT
              o.order_id,
              o.ordered_at,
              (floor(random() * $1) + 1)::int as prod_row_num,
              (floor(random() * 5) + 1)::int as quantity
            FROM orders_with_item_counts o
            CROSS JOIN LATERAL generate_series(1, o.num_items) s(item_num)
          )
          SELECT
            gen_random_uuid()::text as id,
            i.order_id,
            i.ordered_at,
            p.id as product_id,
            i.quantity,
            p.price as unit_price
          FROM items_base i
          JOIN temp_products p ON p.row_num = i.prod_row_num;
          `,
          [numProducts]
        );
        await client.query(`CREATE INDEX temp_order_items_order_id_idx ON temp_order_items(order_id, ordered_at);`);

        // 4. Generate order totals
        await client.query(`
          CREATE TEMP TABLE temp_order_totals AS
          SELECT order_id, ordered_at, SUM(quantity * unit_price) as total_amount
          FROM temp_order_items
          GROUP BY order_id, ordered_at;
        `);
        await client.query(`CREATE INDEX temp_order_totals_id_idx ON temp_order_totals(order_id, ordered_at);`);

        // 5. Insert into "Order"
        await client.query(`
          INSERT INTO "Order" (id, "customerId", status, region, "totalAmount", "orderedAt", "createdAt")
          SELECT
            o.id,
            o.customer_id,
            o.status,
            o.region,
            t.total_amount,
            o.ordered_at,
            o.ordered_at
          FROM temp_orders_base o
          JOIN temp_order_totals t ON t.order_id = o.id AND t.ordered_at = o.ordered_at;
        `);

        // 6. Insert into "OrderItem"
        await client.query(`
          INSERT INTO "OrderItem" (id, "orderId", "orderedAt", "productId", quantity, "unitPrice")
          SELECT
            id,
            order_id,
            ordered_at,
            product_id,
            quantity,
            unit_price
          FROM temp_order_items;
        `);

        // 7. Cleanup batch temp tables
        await client.query(`
          DROP TABLE temp_orders_base CASCADE;
          DROP TABLE temp_order_items CASCADE;
          DROP TABLE temp_order_totals CASCADE;
        `);

        await client.query("COMMIT;");

        const progress = Math.min(100, Math.round(((b + 1) / numBatches) * 100));
        const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
        const totalDuration = ((Date.now() - startSeedTime) / 1000).toFixed(1);
        const memory = process.memoryUsage();

        console.log(
          `Progress: ${progress}% | ` +
          `Batch ${b + 1}/${numBatches} | ` +
          `Seeded ${Math.min((b + 1) * ordersPerBatch, numOrders)} orders | ` +
          `Batch: ${batchDuration}s, Total: ${totalDuration}s | ` +
          `Heap: ${Math.round(memory.heapUsed / 1024 / 1024)}MB / ` +
          `${Math.round(memory.heapTotal / 1024 / 1024)}MB | ` +
          `RSS: ${Math.round(memory.rss / 1024 / 1024)}MB`
        );
      } catch (err) {
        await client.query("ROLLBACK;");
        console.error(`Error in Batch ${b + 1}:`, err);
        throw err;
      }
    }

    // Cleanup top-level temp tables
    await client.query(`
      DROP TABLE IF EXISTS temp_customers CASCADE;
      DROP TABLE IF EXISTS temp_products CASCADE;
    `);

    const finalDuration = ((Date.now() - startSeedTime) / 1000).toFixed(1);
    console.log(`Bulk seeding completed successfully in ${finalDuration}s.`);
  } finally {
    client.release();
  }
}

async function runValidation(pool: pg.Pool) {
  console.log(`\n--- Running Database Validation Queries ---`);
  
  const queries = [
    {
      name: "Customer count",
      sql: 'SELECT COUNT(*) FROM "Customer"',
    },
    {
      name: "Product count",
      sql: 'SELECT COUNT(*) FROM "Product"',
    },
    {
      name: "Order count",
      sql: 'SELECT COUNT(*) FROM "Order"',
    },
    {
      name: "OrderItem count",
      sql: 'SELECT COUNT(*) FROM "OrderItem"',
    },
    {
      name: "Orders with missing customers",
      sql: 'SELECT COUNT(*) FROM "Order" WHERE "customerId" NOT IN (SELECT id FROM "Customer")',
    },
    {
      name: "OrderItems with missing orders",
      sql: 'SELECT COUNT(*) FROM "OrderItem" oi LEFT JOIN "Order" o ON oi."orderId" = o.id AND oi."orderedAt" = o."orderedAt" WHERE o.id IS NULL',
    },
    {
      name: "OrderItems with missing products",
      sql: 'SELECT COUNT(*) FROM "OrderItem" WHERE "productId" NOT IN (SELECT id FROM "Product")',
    },
    {
      name: "Orders whose totalAmount does not equal sum of items",
      sql: `
        SELECT COUNT(*) FROM (
          SELECT o.id, o."orderedAt", o."totalAmount", SUM(oi.quantity * oi."unitPrice") as calculated
          FROM "Order" o
          JOIN "OrderItem" oi ON o.id = oi."orderId" AND o."orderedAt" = oi."orderedAt"
          GROUP BY o.id, o."orderedAt", o."totalAmount"
        ) sub
        WHERE ABS("totalAmount" - calculated) > 0.01
      `,
    },
    {
      name: "Status distribution",
      sql: 'SELECT status, COUNT(*), ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as pct FROM "Order" GROUP BY status',
    },
    {
      name: "Region distribution",
      sql: 'SELECT region, COUNT(*), ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as pct FROM "Order" GROUP BY region',
    },
    {
      name: "Date distribution",
      sql: 'SELECT MIN("orderedAt"), MAX("orderedAt") FROM "Order"',
    },
  ];

  for (const q of queries) {
    try {
      const res = await pool.query(q.sql);
      console.log(`\n📊 [${q.name}]`);
      if (res.rows.length === 1 && Object.keys(res.rows[0]).length === 1) {
        const val = Object.values(res.rows[0])[0];
        console.log(`   Count: ${val}`);
      } else {
        console.table(res.rows);
      }
    } catch (err) {
      console.error(`Failed to run validation query "${q.name}":`, err);
    }
  }
}

main();
