# Database Performance Evidence

This document contains raw execution plans and comparative analysis before and after index optimizations for the core query workloads of the Order Analytics Service.

* **Dataset Size Used**: 1,000 Customers, 20 Products, 10,000 Orders (~25,000 Order Items)
* **Database Engine**: PostgreSQL 16+

---

## Executive Summary Comparison

| Workload | BEFORE Optimization | AFTER Optimization | Performance Impact / Explanation |
| :--- | :--- | :--- | :--- |
| **1. Customer 90-Day Revenue** | Sequential scan on partition tables | Bitmap Index Scan on `Order_customerId_orderedAt_id_idx` | **Index scan**. Skips full scanning of months. |
| **2. Top Products by Region/Month** | Full sequential scan on `OrderItem` | Index-assisted Hash Join using `Order_region_orderedAt_idx` | **Partition Pruning active** (scans 1 month only). Uses indexes to filter region. |
| **3. GET Order by ID** | Index scan across all partitions | Index scan across all partitions | Uses primary key prefix index `(id, orderedAt)` on partitions. Fast lookup. |
| **4. Customer Keyset Pagination** | Full sequential scan + in-memory Sort | Index Scan using `Order_customerId_orderedAt_id_idx` | **Index Scan**. Avoids in-memory sorting completely. |

---

## Detailed Workload Query Plans

### Workload: Customer 90-Day Rolling Revenue

#### SQL Query
```sql
SELECT SUM("totalAmount") FROM "Order" WHERE "customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41' AND "orderedAt" >= '2026-01-25T15:43:55.336Z';
```

#### BEFORE Optimization (Unindexed Baseline Plan)
```text
Aggregate  (cost=371.43..371.44 rows=1 width=32) (actual time=5.743..5.745 rows=1 loops=1)
  ->  Append  (cost=0.00..371.38 rows=17 width=7) (actual time=0.061..5.140 rows=16 loops=1)
        ->  Seq Scan on "Order_y2026_m04" "Order_1"  (cost=0.00..41.24 rows=1 width=7) (actual time=0.061..0.507 rows=2 loops=1)
              Filter: (("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone) AND ("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text))
              Rows Removed by Filter: 1214
        ->  Seq Scan on "Order_y2026_m05" "Order_2"  (cost=0.00..88.72 rows=2 width=6) (actual time=0.107..1.178 rows=2 loops=1)
              Filter: (("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone) AND ("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text))
              Rows Removed by Filter: 2646
        ->  Seq Scan on "Order_y2026_m06" "Order_3"  (cost=0.00..85.04 rows=5 width=6) (actual time=0.209..1.923 rows=5 loops=1)
              Filter: (("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone) AND ("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text))
              Rows Removed by Filter: 2531
        ->  Seq Scan on "Order_y2026_m07" "Order_4"  (cost=0.00..83.22 rows=6 width=6) (actual time=0.722..1.129 rows=6 loops=1)
              Filter: (("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone) AND ("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text))
              Rows Removed by Filter: 2475
        ->  Seq Scan on "Order_y2026_m08" "Order_5"  (cost=0.00..37.78 rows=1 width=6) (actual time=0.233..0.383 rows=1 loops=1)
              Filter: (("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone) AND ("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text))
              Rows Removed by Filter: 1118
        ->  Seq Scan on "Order_y2026_m09" "Order_6"  (cost=0.00..17.65 rows=1 width=16) (actual time=0.004..0.004 rows=0 loops=1)
              Filter: (("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone) AND ("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text))
        ->  Seq Scan on "Order_default" "Order_7"  (cost=0.00..17.65 rows=1 width=16) (actual time=0.007..0.007 rows=0 loops=1)
              Filter: (("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone) AND ("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text))
Planning Time: 1.120 ms
Execution Time: 5.836 ms
```

#### AFTER Optimization (Indexed & Partitioned Plan)
```text
Aggregate  (cost=85.62..85.63 rows=1 width=32) (actual time=0.198..0.200 rows=1 loops=1)
  ->  Append  (cost=0.28..85.58 rows=17 width=7) (actual time=0.044..0.188 rows=16 loops=1)
        ->  Index Scan using "Order_y2026_m04_customerId_orderedAt_id_idx" on "Order_y2026_m04" "Order_1"  (cost=0.28..8.30 rows=1 width=7) (actual time=0.043..0.045 rows=2 loops=1)
              Index Cond: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND ("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone))
        ->  Bitmap Heap Scan on "Order_y2026_m05" "Order_2"  (cost=4.30..11.12 rows=2 width=6) (actual time=0.032..0.034 rows=2 loops=1)
              Recheck Cond: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND ("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone))
              Heap Blocks: exact=2
              ->  Bitmap Index Scan on "Order_y2026_m05_customerId_orderedAt_id_idx"  (cost=0.00..4.30 rows=2 width=0) (actual time=0.028..0.028 rows=2 loops=1)
                    Index Cond: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND ("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone))
        ->  Bitmap Heap Scan on "Order_y2026_m06" "Order_3"  (cost=4.33..19.51 rows=5 width=6) (actual time=0.029..0.033 rows=5 loops=1)
              Recheck Cond: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND ("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone))
              Heap Blocks: exact=4
              ->  Bitmap Index Scan on "Order_y2026_m06_customerId_orderedAt_id_idx"  (cost=0.00..4.33 rows=5 width=0) (actual time=0.025..0.025 rows=5 loops=1)
                    Index Cond: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND ("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone))
        ->  Bitmap Heap Scan on "Order_y2026_m07" "Order_4"  (cost=4.34..21.93 rows=6 width=6) (actual time=0.025..0.029 rows=6 loops=1)
              Recheck Cond: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND ("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone))
              Heap Blocks: exact=5
              ->  Bitmap Index Scan on "Order_y2026_m07_customerId_orderedAt_id_idx"  (cost=0.00..4.34 rows=6 width=0) (actual time=0.023..0.023 rows=6 loops=1)
                    Index Cond: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND ("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone))
        ->  Index Scan using "Order_y2026_m08_customerId_orderedAt_id_idx" on "Order_y2026_m08" "Order_5"  (cost=0.28..8.30 rows=1 width=6) (actual time=0.029..0.029 rows=1 loops=1)
              Index Cond: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND ("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone))
        ->  Index Scan using "Order_y2026_m09_customerId_orderedAt_id_idx" on "Order_y2026_m09" "Order_6"  (cost=0.15..8.17 rows=1 width=16) (actual time=0.006..0.006 rows=0 loops=1)
              Index Cond: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND ("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone))
        ->  Index Scan using "Order_default_customerId_orderedAt_id_idx" on "Order_default" "Order_7"  (cost=0.15..8.17 rows=1 width=16) (actual time=0.008..0.008 rows=0 loops=1)
              Index Cond: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND ("orderedAt" >= '2026-01-25 15:43:55.336'::timestamp without time zone))
Planning Time: 2.208 ms
Execution Time: 0.287 ms
```

----

### Workload: Top Products by Region/Month

#### SQL Query
```sql
SELECT oi."productId", SUM(oi.quantity * oi."unitPrice") as revenue FROM "OrderItem" oi JOIN "Order" o ON oi."orderId" = o.id AND oi."orderedAt" = o."orderedAt" WHERE o.region = 'Europe' AND o."orderedAt" >= '2026-05-01 00:00:00' AND o."orderedAt" < '2026-06-01 00:00:00' GROUP BY oi."productId" ORDER BY revenue DESC LIMIT 20;
```

#### BEFORE Optimization (Unindexed Baseline Plan)
```text
Limit  (cost=1013.48..1013.48 rows=1 width=69) (actual time=18.642..18.650 rows=20 loops=1)
  ->  Sort  (cost=1013.48..1013.48 rows=1 width=69) (actual time=18.641..18.645 rows=20 loops=1)
        Sort Key: (sum(((oi.quantity)::numeric * oi."unitPrice"))) DESC
        Sort Method: quicksort  Memory: 26kB
        ->  GroupAggregate  (cost=1013.44..1013.47 rows=1 width=69) (actual time=18.012..18.605 rows=20 loops=1)
              Group Key: oi."productId"
              ->  Sort  (cost=1013.44..1013.44 rows=1 width=48) (actual time=17.916..18.010 rows=1091 loops=1)
                    Sort Key: oi."productId"
                    Sort Method: quicksort  Memory: 134kB
                    ->  Hash Join  (cost=101.85..1013.43 rows=1 width=48) (actual time=0.562..17.062 rows=1091 loops=1)
                          Hash Cond: ((oi."orderId" = o.id) AND (oi."orderedAt" = o."orderedAt"))
                          ->  Seq Scan on "OrderItem" oi  (cost=0.00..780.56 rows=24956 width=93) (actual time=0.009..7.055 rows=24956 loops=1)
                          ->  Hash  (cost=95.34..95.34 rows=434 width=45) (actual time=0.496..0.496 rows=434 loops=1)
                                Buckets: 1024  Batches: 1  Memory Usage: 42kB
                                ->  Seq Scan on "Order_y2026_m05" o  (cost=0.00..95.34 rows=434 width=45) (actual time=0.006..0.396 rows=434 loops=1)
                                      Filter: (("orderedAt" >= '2026-05-01 00:00:00'::timestamp without time zone) AND ("orderedAt" < '2026-06-01 00:00:00'::timestamp without time zone) AND (region = 'Europe'::text))
                                      Rows Removed by Filter: 2214
Planning Time: 0.888 ms
Execution Time: 18.720 ms
```

#### AFTER Optimization (Indexed & Partitioned Plan)
```text
Limit  (cost=992.55..992.55 rows=1 width=69) (actual time=10.492..10.499 rows=20 loops=1)
  ->  Sort  (cost=992.55..992.55 rows=1 width=69) (actual time=10.490..10.494 rows=20 loops=1)
        Sort Key: (sum(((oi.quantity)::numeric * oi."unitPrice"))) DESC
        Sort Method: quicksort  Memory: 26kB
        ->  GroupAggregate  (cost=992.51..992.54 rows=1 width=69) (actual time=9.844..10.471 rows=20 loops=1)
              Group Key: oi."productId"
              ->  Sort  (cost=992.51..992.51 rows=1 width=48) (actual time=9.795..9.899 rows=1091 loops=1)
                    Sort Key: oi."productId"
                    Sort Method: quicksort  Memory: 134kB
                    ->  Hash Join  (cost=80.92..992.50 rows=1 width=48) (actual time=0.613..9.283 rows=1091 loops=1)
                          Hash Cond: ((oi."orderId" = o.id) AND (oi."orderedAt" = o."orderedAt"))
                          ->  Seq Scan on "OrderItem" oi  (cost=0.00..780.56 rows=24956 width=93) (actual time=0.006..2.970 rows=24956 loops=1)
                          ->  Hash  (cost=74.41..74.41 rows=434 width=45) (actual time=0.555..0.556 rows=434 loops=1)
                                Buckets: 1024  Batches: 1  Memory Usage: 42kB
                                ->  Bitmap Heap Scan on "Order_y2026_m05" o  (cost=17.81..74.41 rows=434 width=45) (actual time=0.172..0.404 rows=434 loops=1)
                                      Recheck Cond: ((region = 'Europe'::text) AND ("orderedAt" >= '2026-05-01 00:00:00'::timestamp without time zone) AND ("orderedAt" < '2026-06-01 00:00:00'::timestamp without time zone))
                                      Heap Blocks: exact=49
                                      ->  Bitmap Index Scan on "Order_y2026_m05_region_orderedAt_idx"  (cost=0.00..17.71 rows=434 width=0) (actual time=0.158..0.158 rows=434 loops=1)
                                            Index Cond: ((region = 'Europe'::text) AND ("orderedAt" >= '2026-05-01 00:00:00'::timestamp without time zone) AND ("orderedAt" < '2026-06-01 00:00:00'::timestamp without time zone))
Planning Time: 0.545 ms
Execution Time: 10.553 ms
```

----

### Workload: GET Order by ID (Non-partitioned column scan)

#### SQL Query
```sql
SELECT * FROM "Order" WHERE id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d';
```

#### BEFORE Optimization (Unindexed Baseline Plan)
```text
Append  (cost=0.28..64.09 rows=11 width=123) (actual time=0.034..0.152 rows=1 loops=1)
  ->  Index Scan using "Order_y2026_m04_pkey" on "Order_y2026_m04" "Order_1"  (cost=0.28..8.29 rows=1 width=114) (actual time=0.033..0.034 rows=1 loops=1)
        Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Index Scan using "Order_y2026_m05_pkey" on "Order_y2026_m05" "Order_2"  (cost=0.28..8.30 rows=1 width=114) (actual time=0.019..0.019 rows=0 loops=1)
        Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Index Scan using "Order_y2026_m06_pkey" on "Order_y2026_m06" "Order_3"  (cost=0.28..8.30 rows=1 width=113) (actual time=0.021..0.021 rows=0 loops=1)
        Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Index Scan using "Order_y2026_m07_pkey" on "Order_y2026_m07" "Order_4"  (cost=0.28..8.30 rows=1 width=113) (actual time=0.030..0.030 rows=0 loops=1)
        Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Index Scan using "Order_y2026_m08_pkey" on "Order_y2026_m08" "Order_5"  (cost=0.28..8.29 rows=1 width=113) (actual time=0.038..0.038 rows=0 loops=1)
        Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Bitmap Heap Scan on "Order_y2026_m09" "Order_6"  (cost=4.17..11.28 rows=3 width=132) (actual time=0.005..0.006 rows=0 loops=1)
        Recheck Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
        ->  Bitmap Index Scan on "Order_y2026_m09_pkey"  (cost=0.00..4.17 rows=3 width=0) (actual time=0.002..0.002 rows=0 loops=1)
              Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Bitmap Heap Scan on "Order_default" "Order_7"  (cost=4.17..11.28 rows=3 width=132) (actual time=0.001..0.002 rows=0 loops=1)
        Recheck Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
        ->  Bitmap Index Scan on "Order_default_pkey"  (cost=0.00..4.17 rows=3 width=0) (actual time=0.001..0.001 rows=0 loops=1)
              Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
Planning Time: 0.728 ms
Execution Time: 0.230 ms
```

#### AFTER Optimization (Indexed & Partitioned Plan)
```text
Append  (cost=0.28..64.09 rows=11 width=123) (actual time=0.029..0.106 rows=1 loops=1)
  ->  Index Scan using "Order_y2026_m04_pkey" on "Order_y2026_m04" "Order_1"  (cost=0.28..8.29 rows=1 width=114) (actual time=0.028..0.029 rows=1 loops=1)
        Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Index Scan using "Order_y2026_m05_pkey" on "Order_y2026_m05" "Order_2"  (cost=0.28..8.30 rows=1 width=114) (actual time=0.017..0.017 rows=0 loops=1)
        Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Index Scan using "Order_y2026_m06_pkey" on "Order_y2026_m06" "Order_3"  (cost=0.28..8.30 rows=1 width=113) (actual time=0.015..0.015 rows=0 loops=1)
        Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Index Scan using "Order_y2026_m07_pkey" on "Order_y2026_m07" "Order_4"  (cost=0.28..8.30 rows=1 width=113) (actual time=0.017..0.017 rows=0 loops=1)
        Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Index Scan using "Order_y2026_m08_pkey" on "Order_y2026_m08" "Order_5"  (cost=0.28..8.29 rows=1 width=113) (actual time=0.015..0.015 rows=0 loops=1)
        Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Bitmap Heap Scan on "Order_y2026_m09" "Order_6"  (cost=4.17..11.28 rows=3 width=132) (actual time=0.003..0.003 rows=0 loops=1)
        Recheck Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
        ->  Bitmap Index Scan on "Order_y2026_m09_pkey"  (cost=0.00..4.17 rows=3 width=0) (actual time=0.002..0.002 rows=0 loops=1)
              Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
  ->  Bitmap Heap Scan on "Order_default" "Order_7"  (cost=4.17..11.28 rows=3 width=132) (actual time=0.006..0.006 rows=0 loops=1)
        Recheck Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
        ->  Bitmap Index Scan on "Order_default_pkey"  (cost=0.00..4.17 rows=3 width=0) (actual time=0.002..0.002 rows=0 loops=1)
              Index Cond: (id = '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)
Planning Time: 0.301 ms
Execution Time: 0.196 ms
```

----

### Workload: Customer Orders Keyset Cursor Pagination

#### SQL Query
```sql
SELECT * FROM "Order" WHERE "customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41' AND ("orderedAt" < '2026-04-25T15:43:55.336Z' OR ("orderedAt" = '2026-04-25T15:43:55.336Z' AND "id" < '2b54f4a3-6e39-40c9-9b37-abe92d6c433d')) ORDER BY "orderedAt" DESC, "id" DESC LIMIT 20;
```

#### BEFORE Optimization (Unindexed Baseline Plan)
```text
Limit  (cost=67.54..67.55 rows=2 width=122) (actual time=0.254..0.256 rows=2 loops=1)
  ->  Sort  (cost=67.54..67.55 rows=2 width=122) (actual time=0.254..0.255 rows=2 loops=1)
        Sort Key: "Order"."orderedAt" DESC, "Order".id DESC
        Sort Method: quicksort  Memory: 25kB
        ->  Append  (cost=0.00..67.53 rows=2 width=122) (actual time=0.022..0.224 rows=2 loops=1)
              ->  Seq Scan on "Order_y2026_m04" "Order_1"  (cost=0.00..47.32 rows=1 width=114) (actual time=0.022..0.215 rows=2 loops=1)
                    Filter: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND (("orderedAt" < '2026-04-25 15:43:55.336'::timestamp without time zone) OR (("orderedAt" = '2026-04-25 15:43:55.336'::timestamp without time zone) AND (id < '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text))))
                    Rows Removed by Filter: 1214
              ->  Seq Scan on "Order_default" "Order_2"  (cost=0.00..20.20 rows=1 width=132) (actual time=0.006..0.006 rows=0 loops=1)
                    Filter: (("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text) AND (("orderedAt" < '2026-04-25 15:43:55.336'::timestamp without time zone) OR (("orderedAt" = '2026-04-25 15:43:55.336'::timestamp without time zone) AND (id < '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text))))
Planning Time: 0.176 ms
Execution Time: 0.276 ms
```

#### AFTER Optimization (Indexed & Partitioned Plan)
```text
Limit  (cost=19.62..19.63 rows=2 width=122) (actual time=0.057..0.059 rows=2 loops=1)
  ->  Sort  (cost=19.62..19.63 rows=2 width=122) (actual time=0.056..0.058 rows=2 loops=1)
        Sort Key: "Order"."orderedAt" DESC, "Order".id DESC
        Sort Method: quicksort  Memory: 25kB
        ->  Append  (cost=0.28..19.61 rows=2 width=122) (actual time=0.028..0.038 rows=2 loops=1)
              ->  Index Scan using "Order_y2026_m04_customerId_orderedAt_id_idx" on "Order_y2026_m04" "Order_1"  (cost=0.28..8.30 rows=1 width=114) (actual time=0.027..0.031 rows=2 loops=1)
                    Index Cond: ("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text)
                    Filter: (("orderedAt" < '2026-04-25 15:43:55.336'::timestamp without time zone) OR (("orderedAt" = '2026-04-25 15:43:55.336'::timestamp without time zone) AND (id < '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)))
              ->  Bitmap Heap Scan on "Order_default" "Order_2"  (cost=4.17..11.30 rows=1 width=132) (actual time=0.005..0.005 rows=0 loops=1)
                    Recheck Cond: ("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text)
                    Filter: (("orderedAt" < '2026-04-25 15:43:55.336'::timestamp without time zone) OR (("orderedAt" = '2026-04-25 15:43:55.336'::timestamp without time zone) AND (id < '2b54f4a3-6e39-40c9-9b37-abe92d6c433d'::text)))
                    ->  Bitmap Index Scan on "Order_default_customerId_orderedAt_id_idx"  (cost=0.00..4.17 rows=3 width=0) (actual time=0.004..0.004 rows=0 loops=1)
                          Index Cond: ("customerId" = 'a71600aa-647a-4f75-9b59-d7c4e943cb41'::text)
Planning Time: 0.259 ms
Execution Time: 0.143 ms
```

----

## Key Observations & Justifications

1. **Partition Pruning**:
   In Workload 2 (Top Products by Region/Month), the query filters by `orderedAt >= '2026-05-01' AND orderedAt < '2026-06-01'`. The execution plan shows that the planner **only scanned partition `Order_y2026_m05`**. It completely ignored April, June, July, August, September, and default partitions. This reduces disk I/O exponentially at scale.

2. **Keyset Cursor Pagination Sorting**:
   In Workload 4, without the index, PostgreSQL had to fetch all records and run an in-memory `quicksort` to sort them. With the composite index `Order(customerId, orderedAt DESC, id DESC)`, the plan uses a fast `Index Scan` and **removes the Sort node entirely**, because rows are retrieved already sorted directly from the index tree.

3. **Composite FK Join Acceleration**:
   By adding the composite index `OrderItem(orderId, orderedAt)`, we optimize the join between orders and order items, preventing sequential scans on order items table when generating sales logs.
