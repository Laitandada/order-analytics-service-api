-- CreateIndex
CREATE INDEX "Order_customerId_orderedAt_id_idx" ON "Order"("customerId", "orderedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Order_region_orderedAt_idx" ON "Order"("region", "orderedAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_orderedAt_idx" ON "OrderItem"("orderId", "orderedAt");
