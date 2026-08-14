-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_orderId_fkey";
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_customerId_fkey";

-- DropTable
DROP TABLE IF EXISTS "OrderItem" CASCADE;
DROP TABLE IF EXISTS "Order" CASCADE;

-- CreateTable (Partitioned Order Table)
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "region" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id", "orderedAt")
) PARTITION BY RANGE ("orderedAt");

-- Create Order Partitions
CREATE TABLE "Order_y2026_m04" PARTITION OF "Order"
    FOR VALUES FROM ('2026-04-01 00:00:00') TO ('2026-05-01 00:00:00');

CREATE TABLE "Order_y2026_m05" PARTITION OF "Order"
    FOR VALUES FROM ('2026-05-01 00:00:00') TO ('2026-06-01 00:00:00');

CREATE TABLE "Order_y2026_m06" PARTITION OF "Order"
    FOR VALUES FROM ('2026-06-01 00:00:00') TO ('2026-07-01 00:00:00');

CREATE TABLE "Order_y2026_m07" PARTITION OF "Order"
    FOR VALUES FROM ('2026-07-01 00:00:00') TO ('2026-08-01 00:00:00');

CREATE TABLE "Order_y2026_m08" PARTITION OF "Order"
    FOR VALUES FROM ('2026-08-01 00:00:00') TO ('2026-09-01 00:00:00');

CREATE TABLE "Order_y2026_m09" PARTITION OF "Order"
    FOR VALUES FROM ('2026-09-01 00:00:00') TO ('2026-10-01 00:00:00');

-- Default Partition
CREATE TABLE "Order_default" PARTITION OF "Order" DEFAULT;

-- CreateTable (OrderItem table with orderedAt)
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (Order -> Customer)
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (OrderItem -> Order using composite columns)
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_orderedAt_fkey" FOREIGN KEY ("orderId", "orderedAt") REFERENCES "Order"("id", "orderedAt") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (OrderItem -> Product)
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
