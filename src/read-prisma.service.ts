import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

/**
 * Read-replica Prisma client.
 *
 * Connects to READ_DATABASE_URL, which in production should be a PostgreSQL
 * hot-standby replica. In local development it may point to the same instance
 * as PRIMARY_DATABASE_URL.
 *
 * ONLY use this service for read operations that tolerate eventual consistency:
 *   - Analytics aggregations (90-day revenue, top products)
 *   - Paginated customer order history
 *
 * Do NOT use this service for:
 *   - Any write operation (INSERT / UPDATE / DELETE)
 *   - Order lookups by ID immediately after creation (read-after-write risk)
 *
 * Replication lag: streaming replication is typically sub-second on LAN, but
 * can grow under high write load. Callers must never assume the replica is
 * fully up-to-date with the primary.
 */
@Injectable()
export class ReadPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  public readonly readPool: pg.Pool;

  constructor() {
    const connectionString =
      process.env.READ_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'READ_DATABASE_URL (or DATABASE_URL fallback) is not defined',
      );
    }

    const maxConnections = parseInt(process.env.DATABASE_POOL_SIZE || '20', 10);
    const idleTimeout = parseInt(
      process.env.DATABASE_IDLE_TIMEOUT_MS || '30000',
      10,
    );
    const connectionTimeout = parseInt(
      process.env.DATABASE_CONNECTION_TIMEOUT_MS || '2000',
      10,
    );

    const pool = new pg.Pool({
      connectionString,
      max: maxConnections,
      idleTimeoutMillis: idleTimeout,
      connectionTimeoutMillis: connectionTimeout,
    });

    const adapter = new PrismaPg(pool, { disposeExternalPool: true });
    super({ adapter });
    this.readPool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
