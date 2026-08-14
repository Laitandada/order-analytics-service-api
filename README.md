# Order Analytics Service API

A production-ready NestJS application designed for high-throughput order tracking, partitioning, read/write database split-routing, and analytics reporting.

---

## Table of Contents

1. [Project Setup & Installation](#1-project-setup--installation)
2. [Starting PostgreSQL](#2-starting-postgresql)
3. [Running Database Migrations](#3-running-database-migrations)
4. [Database Seeding (Dev & 5M Full Assessment)](#4-database-seeding-dev--5m-full-assessment)
5. [Starting the Application](#5-starting-the-application)
6. [Running the Tests](#6-running-the-tests)
7. [Running the Load Tests](#7-running-the-load-tests)
8. [API Endpoints & Swagger Documentation](#8-api-endpoints--swagger-documentation)
9. [Database Architecture & Read/Write Routing](#9-database-architecture--readwrite-routing)
10. [Performance Benchmarks](#10-performance-benchmarks)
11. [Indexing Strategy](#11-indexing-strategy)

---

## 1. Project Setup & Installation

### Prerequisites

- **Node.js**: v20 or higher
- **npm**: v10 or higher
- **PostgreSQL**: v15 or higher

### Installation

Clone the repository and install all dependencies:

```bash
$ npm install
```

Configure your environment variables by copying `.env.example` to `.env`:

```bash
$ cp .env.example .env
```

---

## 2. Starting PostgreSQL

The application expects a running PostgreSQL instance listening on port `5432`.

### Running PostgreSQL via macOS Homebrew

If installed locally via Homebrew, start the database service:

```bash
$ brew services start postgresql@15
```

Ensure your `.env` connection strings match your PostgreSQL credentials, for example:

```env
PRIMARY_DATABASE_URL="postgresql://postgres:password123@localhost:5432/nextjs-practice?schema=public&sslmode=disable"
READ_DATABASE_URL="postgresql://postgres:password123@localhost:5432/nextjs-practice?schema=public&sslmode=disable"
```

---

## 3. Running Database Migrations

Use Prisma CLI to apply schema migrations. This will initialize the tables, partitioning configurations, and optimized workload indexes:

```bash
# Generate the Prisma client types
$ npm run db:generate

# Apply migrations to the database instance
$ npm run db:migrate:deploy
```

---

## 4. Database Seeding (Dev & 5M Full Assessment)

We provide two seeding modes configured to match development and load-testing needs.

### Option A: Development Seed (10k Orders)

Designed for local development, integration, and E2E testing. Generates **10,000 orders**, **1,000 customers**, and **20 products** in under 2 seconds.

```bash
$ npm run db:seed:dev
```

### Option B: Full Assessment Seed (5 Million Orders)

Generates approximately **5,000,000 orders** and their corresponding **12.5M order items** across partitioned monthly tables.

```bash
$ npm run db:seed:full
```

#### Seeding Architecture & Safety Features

- **OOM Prevention**: Seeding is generated and written in streamed chunks of **2,500 orders** to keep JavaScript Heap memory under **150MB RSS**.
- **PostgreSQL Parameter Limit Safe**: Chunk size remains below PostgreSQL's `65,535` query parameter threshold (utilizing ~32k parameters per batch).
- **Speed**: Utilizes fast batch transactions inserting the data in **3 to 6 minutes** depending on disk/network write throughput.

---

## 5. Starting the Application

Build the application and start the HTTP server:

```bash
# Build the TypeScript compilation
$ npm run build

# Start the compiled server in Production mode (Highly Recommended for Benchmarks)
$ npm run start:prod

# Start the server in Development watch mode
$ npm run start:dev
```

The server will bind and listen on port `3000` (e.g. `http://localhost:3000`).

---

## 6. Running the Tests

Because the codebase is configured with ECMAScript Modules (`"type": "module"`), running Jest tests requires the Node VM modules flag enabled:

```bash
# Run unit tests
$ node --experimental-vm-modules node_modules/jest/bin/jest.js

# Run E2E tests
$ node --experimental-vm-modules node_modules/jest/bin/jest.js --config ./test/jest-e2e.json
```

---

## 7. Running the Load Tests

We simulate **200 concurrent Virtual Users (VUs)** executing requests against `GET /orders/:orderId` using the **k6** engine. The load test script is located at [`load-test/order-lookup.js`](/load-test/order-lookup.js).

### Prerequisites

Download or compile the `k6` binary into the project root directory.

### Run Load Tests

1. **Extract Valid IDs**: Pulls 2,000 random order IDs from the database to hit valid indexed keys instead of triggering 404s:
   ```bash
   $ npm run load-test:prep
   ```
2. **Execute Benchmark**: Runs k6 with 200 VUs for 30 seconds:
   ```bash
   $ npm run load-test:run
   ```
3. **Combined Command**:
   ```bash
   $ npm run load-test
   ```

---

## 8. API Endpoints & Swagger Documentation

Once the server is running, the **Swagger API Docs** are interactive at:
👉 **`http://localhost:3000/api/docs`**

### Summary of REST Endpoints

#### 1. Single Order Lookup

- **Method & Path**: `GET /orders/:orderId`
- **Query Parameters**:
  - `orderedAt` (Optional, ISO Date String): The partition pruning key.
- **Response**: Returns full details of the order, including the associated Customer object and array of nested OrderItems mapped to their Product definitions.

#### 2. Customer Order History (Keyset Paginated)

- **Method & Path**: `GET /customers/:customerId/orders`
- **Query Parameters**:
  - `limit` (Optional, default 20): Number of items per page.
  - `cursor_id` (Optional, UUID): Pagination keyset cursor ID.
  - `cursor_orderedAt` (Optional, ISO Date String): Pagination keyset cursor date.
- **Response**: Returns a keyset-paginated list of customer orders sorted by `orderedAt DESC, id DESC`.

#### 3. Top Customers Revenue Analytics

- **Method & Path**: `GET /analytics/customers/revenue`
- **Query Parameters**:
  - `days` (Optional, default 90): Analytics rolling window range.
- **Response**: Returns a ranked list of customers who generated the highest non-cancelled order revenue within the last N days.

#### 4. Top-Selling Products Analytics

- **Method & Path**: `GET /analytics/products/top`
- **Query Parameters**:
  - `region` (Optional): Filter statistics by sales region.
  - `month` (Optional, format `YYYY-MM`): Filter statistics by month.
- **Response**: Returns ranked top-selling products by revenue grouped by region and month, including rank index.

---

## 9. Database Architecture & Read/Write Routing

The application implements an **application-level Read/Write database split**:

- **Primary Connection** (`PRIMARY_DATABASE_URL` via `PrismaService`):
  - Handles all write operations.
  - Handles `/orders/:orderId` lookups to enforce strong **read-after-write consistency** (ensures a user doesn't hit a replica lag 404 immediately after creating an order).
- **Replica Connection** (`READ_DATABASE_URL` via `ReadPrismaService`):
  - Handles `/customers/:customerId/orders` paginated browsing.
  - Handles analytical queries (`/analytics/*`).

---

## 10. Performance Benchmarks

Detailed performance findings, index optimizations, and load testing latency percentiles are documented inside the repository:

- 📊 **[Top Products Analytics Index Optimizations](/performance/top-products-after.txt)**
- 📈 **[Order Lookup 200-VU Load Test Results](/load-test/results.txt)**

---

## 11. Indexing Strategy

The following indexes were added based on the primary workload queries:

- `Order.customerId`
- `Order.orderedAt`
- `OrderItem.orderId`
- `OrderItem.orderedAt`
- `OrderItem.productId`

#### Rejected Index

**`Order.status`**

**Reason:**  
`status` has only four possible values and therefore has low selectivity. Adding this index would increase write/storage overhead without materially improving the primary workload queries.

---

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
