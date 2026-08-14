import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { perfStorage } from './common/perf-storage.js';


@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL as string;
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

    const originalConnect = pool.connect.bind(pool);
    pool.connect = (async function (...args: any[]) {
      const store = perfStorage.getStore();
      if (store) {
        const start = performance.now();
        const client = await originalConnect(...args);
        store.connectionAcquireDuration += performance.now() - start;
        return client;
      }
      return originalConnect(...args);
    } as any);

    const adapter = new PrismaPg(pool, { disposeExternalPool: true });
    // Enable Prisma-level query logging to capture generated SQL for analysis.
    // Cast to any to avoid strict generated-client typings.
    super({ adapter, log: ['query'] } as any);
    // Temporary runtime query logging for performance investigation.
    // Remove or disable this in production after analysis.
    try {
      // Cast to any to avoid strict generated-client typings at build time
      const anyThis: any = this;
      anyThis.$on('query', (e: any) => {
        try {
          const poolStats = this.pool
            ? `pool(total=${this.pool.totalCount},idle=${this.pool.idleCount},waiting=${this.pool.waitingCount})`
            : 'pool(n/a)';
          console.log(`[Prisma] query: ${e.query} params: ${JSON.stringify(e.params ?? e.parameters ?? e.bindings ?? null)} ${poolStats}`);
        } catch (err) {
          console.log(`[Prisma] query: ${e.query} params: (unserializable)`);
        }
      });
      anyThis.$on('error', (e: any) => {
        console.error(`[Prisma] error: ${e.message}`);
      });
    } catch (err) {
      // ignore if $on isn't available at construction time
    }
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
