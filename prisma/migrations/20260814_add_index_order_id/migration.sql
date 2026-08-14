-- Create an index on Order.id to avoid partition-wide scans when querying by id
-- Run this manually in production as CONCURRENTLY to avoid locking:
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_id ON \"Order\" (id);"

CREATE INDEX IF NOT EXISTS idx_order_id ON "Order" (id);
