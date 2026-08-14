import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

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

    const adapter = new PrismaPg(pool, { disposeExternalPool: true });
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
