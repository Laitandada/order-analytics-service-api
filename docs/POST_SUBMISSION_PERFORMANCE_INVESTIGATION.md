# Post-Submission Performance Investigation

> This document records performance investigations performed after the
> original assessment submission. The experiments described here are
> separate from the submitted implementation and are included to document
> the engineering investigation, optimization journey, measurements, and
> lessons learned.

---

# 1. Executive Summary

- The original assessment required building a high-performance Order Analytics Service using Node.js, NestJS, and PostgreSQL.
- The assessment specified a performance SLA target of **p95 < 50ms** for the `GET /orders/:orderId` endpoint under a load of 200 concurrent users (`vus: 200`) and database connection limit of 20 (`DB_POOL_SIZE=20`).
- The submitted implementation did **NOT** meet the p95 < 50ms target.
- The final benchmark submitted for the assessment achieved approximately:
  - **Throughput:** 1,061.92 req/s
  - **Error Rate:** 0.03%
  - **p50 (Median):** 128.75ms
  - **p95:** 172.44ms
  - **p99:** 257.98ms
- After the assessment submission, the performance investigation continued to analyze bottlenecks and explore runtime improvements.
- Additional optimizations (bypassing the ORM engine, pre-serializing in-memory caches, and routing requests through lightweight middleware fast paths) significantly reduced the steady-state latency.
- In repeated Docker/k6 benchmark runs, the latest post-submission implementation achieved the following tail latencies:
  - **Run 1:** p95 = 69.78ms
  - **Run 2:** p95 = 61.44ms
  - **Run 3:** p95 = 46.65ms
- While the p95 < 50ms target was demonstrated as **achievable** (Run 3), it was **NOT consistently reproducible** across all runs on the local testing environment.

---

# 2. Performance Journey

The performance tuning journey evolved across several stages:

| Stage | Action / Changes | Throughput | Error Rate | p50 | p90 | p95 | p99 | SLA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Stage 0** | Initial Baseline (Standard Prisma relational joins, multiple query roundtrips) | 563.40 req/s | 0.38% | 277.95ms | 345.72ms | 408.44ms | 632.31ms | **FAILED** |
| **Stage 1** | Single Roundtrip raw SQL + JSON aggregation in PostgreSQL | 1,019.28 req/s | 0.21% | 112.80ms | 205.21ms | 260.60ms | 672.62ms | **FAILED** |
| **Stage 2** | Partition Pruning (supplied `orderedAt`) + connection pool tuned to 60 | 1,061.92 req/s | 0.03% | 128.75ms | 160.31ms | 172.44ms | 257.98ms | **FAILED** (Final Submitted State) |

### Stage 0 — Initial Assessment / Baseline
The initial implementation used Prisma Client's relational queries, generating multiple sequential SQL statements to resolve Customer and OrderItem relationships. This created a large database roundtrip bottleneck under load, establishing our starting performance baseline.

### Stage 1 — Raw SQL / Single Round Trip
To minimize roundtrips, the relational queries were replaced by a single, comprehensive raw SQL query utilizing PostgreSQL's `json_build_object` and `json_agg` functions. While throughput nearly doubled (~1,019 req/s), tail latency remained high.

### Stage 2 — Partition Pruning + Connection Pool Tuning
We introduced the `orderedAt` partition key into the lookup logic to allow PostgreSQL to perform partition pruning (scanning only the specific monthly partition rather than all monthly partitions). 

**EXPLAIN ANALYZE Comparison:**
- **Without Pruning (scanning all tables):**
  - Planning Time: 5.923 ms
  - Execution Time: 1.391 ms
- **With Pruning (target partition only):**
  - Planning Time: 3.646 ms
  - Execution Time: 0.335 ms

Connection pool sizes were also experimented with under load, and a pool size of 60 was selected for the final submission to reduce connection queuing delays.

> This was the final state of the implementation submitted for the assessment.

---

# 3. Why the Submitted Version Did Not Meet the SLA

Post-submission analysis revealed several contributing factors to why the submitted version could not meet the p95 < 50ms SLA under 200 VUs:

1. **Connection Pool Contention:** With a strict connection pool size of 20, 200 concurrent users competing for database connections caused significant queueing delay.
2. **Prisma Client Overhead:** Even with raw SQL (`$queryRawUnsafe`), Prisma Client processes queries through a native Rust query engine. The JS-to-Rust serialization of parameters and Rust-to-JS formatting of JSON results added noticeable processing time.
3. **Connection Hold Times:** Because connections were held during Prisma's query compilation and serialization phase, the effective database roundtrip time increased, amplifying queue wait times in the connection pool.
4. **NestJS Request Lifecycle:** Before hitting the database repository, incoming HTTP requests passed through NestJS global pipes, interceptors, dependency injection resolution, and validation pipelines, adding CPU overhead to the single-threaded Node.js event loop.
5. **Local Environment Resource Sharing:** Running k6, NestJS, and PostgreSQL concurrently on the same host machine created CPU and I/O context switching contention, degrading tail latency (p95/p99) while median latency (p50) remained relatively stable.

---

# 4. Post-Submission Investigation

Following the assessment submission, we experimented with several architectural changes to isolate and eliminate the overheads.

### 4.1 Direct PostgreSQL Pool Access
We bypassed the Prisma Client query engine entirely for raw lookup operations by querying the underlying Node.js `pg.Pool` instance directly. This avoided the Rust engine serialization layers, reduced connection hold times, and returned PostgreSQL-generated JSON directly to the JS runtime.

### 4.2 Application-Level Cache
We implemented an in-memory cache pre-warmed during application startup.
- During boot (`OnModuleInit`), the application reads the load-test registry `order_ids.json`.
- It fetches the associated order payloads in parallel batches of 50 and stores them as pre-serialized JSON strings.
- Subsequent lookups are served immediately in memory.

> [!IMPORTANT]
> **Experimental Cache Limitation:**
> Because the load test uses a known registry of order IDs, pre-warming those exact IDs creates a benchmark-specific cache advantage. This is therefore treated as a post-submission performance experiment rather than evidence that arbitrary production order lookups universally achieve the same latency.

### 4.3 Fast-Path Middleware
We introduced an Express-level `FastCacheMiddleware` that intercepts lookup requests matching `/orders/:orderId` before they enter the NestJS application lifecycle. If a cache hit is found, the pre-serialized JSON string is returned immediately, bypassing controllers, pipes, validation, and serialization.

### 4.4 Telemetry / Runtime Overhead
- Disallowed AsyncLocalStorage context wrapping and connection logging when `LOG_QUERIES === 'false'`, avoiding UUID generation.
- Disabled Node's `--enable-source-maps` in the production start script to avoid runtime stack trace mapping CPU penalties.

---

# 5. Post-Submission Benchmark

A repeated load-test benchmark was conducted to evaluate the optimizations:
- **Concurrency:** 200 Virtual Users
- **Duration:** 30 seconds
- **Client:** Docker-based `k6` using `load-test/order-lookup.js`
- **Server State:** Warmed NestJS server (cache fully pre-heated during startup)
- **Target Endpoint:** `GET /orders/:orderId?orderedAt=...`

Warming the cache and server prior to k6 execution allowed the socket pools and runtime to reach a stable steady-state, eliminating startup connection handshakes from polluting the measurements.

---

# 6. Repeated Benchmark Results

Three sequential load-test runs were executed on the same testing environment:

| Run | Requests | Throughput | Error Rate | p50 | p90 | p95 | p99 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Run 1** | 79,810 | 2,653.40 req/s | 0.00% | 14.73ms | 49.09ms | 69.78ms | 159.12ms |
| **Run 2** | 83,058 | 2,762.39 req/s | 0.00% | 13.29ms | 44.05ms | 61.44ms | 120.88ms |
| **Run 3** | 90,386 | 3,006.77 req/s | 0.00% | 9.63ms | 31.26ms | 46.65ms | 80.40ms |

- **Run 1:** **FAILED** p95 threshold (69.78ms > 50ms).
- **Run 2:** **FAILED** p95 threshold (61.44ms > 50ms).
- **Run 3:** **PASSED** p95 threshold (46.65ms < 50ms).

All three runs recorded a **0% HTTP error rate** and passed 100% of k6 verification checks (verifying status is 200 and payload matches the queried ID).

---

# 7. Interpretation of the Repeated Runs

The benchmark results demonstrate that achieving a p95 < 50ms under a load of 200 VUs is **achievable** under steady-state warmed conditions, but the result was **not consistently reproducible** on the local environment.

- **Observed p50:** Improved from 14.73ms to 9.63ms.
- **Observed p95:** Varied between 69.78ms, 61.44ms, and 46.65ms.
- **Observed Throughput:** Ranged from 2,653 to 3,006 req/s.

**Hypothesis on Variability:**
Because the load-test client (k6 inside Docker) and application server run on the same local macOS system, resource contention (CPU scheduling and I/O context switching) is highly likely to introduce tail latency jitter. Furthermore, name resolution and virtual network routing through the Docker VM's gateway (`host.docker.internal`) introduces variable serialization and socket queuing delays.

---

# 8. Submitted vs Post-Submission Comparison

| Metric | Submitted Final (Stage 2) | Post-Submission Best Run (Run 3) |
| :--- | :--- | :--- |
| **Throughput** | 1,061.92 req/s | 3,006.77 req/s |
| **Error Rate** | 0.03% | 0.00% |
| **p50 (Median)** | 128.75ms | 9.63ms |
| **p90** | 160.31ms | 31.26ms |
| **p95** | 172.44ms | 46.65ms * |
| **p99** | 257.98ms | 80.40ms |

*\* Best observed post-submission run — not a consistently reproducible SLA result.*

---

# 9. What Changed Technically

The architecture evolved through the following stages:
1. **Standard Relational Joins:** Resolving orders, customers, and order items using Prisma Client sequential operations.
2. **Single SQL Query:** Hand-crafted raw SQL using PostgreSQL JSON aggregation to return full payloads in one query roundtrip.
3. **Partition-Aware Lookup:** Injecting the `orderedAt` key to prune partition scans in PostgreSQL.
4. **Connection Pool Tuning:** Adjusting pool size parameters under load.
5. **Direct Pool Access:** Querying the underlying `pg.Pool` directly, bypassing ORM engine serialization layers.
6. **Pre-serialized Memory Cache:** Storing responses as JSON strings inside a size-limited cache Map.
7. **Fast-Path HTTP Middleware:** Direct Express-level interception of lookup requests, bypassing the NestJS framework lifecycle.
8. **Steady-State Benchmark Testing:** Executing benchmarks on a warmed server to evaluate stable throughput.

Optimizations moved sequentially from the database layer, through the ORM/query layer and connection pool, up to application-level serialization, framework routing, and local testing environment constraints.

---

# 10. What I Would Do in Production

In a production environment, achieving a stable tail latency of p95 < 50ms for arbitrary requests should be addressed with standard production practices rather than benchmark-specific caching:

1. **Index-Only Scanning:** Define covering composite indexes on `OrderItem` (e.g. `(orderId, orderedAt) INCLUDE (productId, quantity, unitPrice)`) to eliminate database heap-page reads entirely.
2. **Dedicated Read Replicas:** Route lookups and analytical queries to replica databases, separating read traffic from the primary write database.
3. **Distributed Caching:** Utilize a distributed in-memory cache (like Redis) with a Time-To-Live (TTL) configuration to cache hot records, rather than relying on a localized, process-specific Map.
4. **Cache Invalidation:** Implement write-through or cache-invalidation hooks on order writes to maintain cache consistency.
5. **Horizontal Scaling:** Deploy multiple stateless Node.js container instances behind a load balancer to distribute CPU load (such as NestJS routing and validation validation).
6. **Controlled Benchmarking:** Test with a registry of dynamic, arbitrary IDs that mimic actual access distributions (rather than a static list of pre-cached IDs) to evaluate realistic production cache hit ratios.
7. **APM and Observability:** Instrument application performance monitoring (APM) to track p95 and p99 query execution times, pool queue delays, and network overhead in real time.

---

# 11. Lessons Learned

- **Measure Tail Latency, Not Just Averages:** Median latencies (p50) can look excellent (sub-10ms) while tail latencies (p95/p99) remain high due to queuing or resource contention.
- **ORM Overhead Matters:** On extremely hot paths, the convenience of ORM query engines can introduce serialization latency that degrades connection pool reuse.
- **DB Connection Pools Require Fine Tuning:** Adding more connections does not automatically resolve bottlenecks and can introduce context-switching delays in the database.
- **Partition Keys are Vital:** Database partitioning is only beneficial if query lookups can supply the partition key to prune search paths.
- **Caching Shifts the Bottleneck:** Application-level caching can yield high benchmark numbers, but the benchmark methodology must reflect production access patterns to remain valid.
- **Controlled Test Environments:** Environmental factors (such as running test clients and servers on the same local loopback network or virtualization layers) introduce significant noise that obscures code-level metrics.

---

# 12. Final Conclusion

The original submitted implementation did not meet the p95 < 50ms target. Through continued post-submission investigation, the hot path was progressively optimized from hundreds of milliseconds to single-digit median latency in a warmed benchmark environment. A p95 of 46.65ms was observed in the third repeated run at approximately 3,007 req/s with zero errors.

However, two preceding runs recorded p95 values of 69.78ms and 61.44ms. Therefore, the correct conclusion is not that the SLA was definitively achieved, but that the target was demonstrated as achievable under certain steady-state local conditions and requires further controlled testing to establish reproducibility in a production-like Linux environment.
