import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { ReadPrismaService } from '../read-prisma.service.js';

/**
 * DatabaseService is the single routing façade for all database access.
 *
 * It exposes two named clients:
 *   - `primary`  → PrismaService   (PRIMARY_DATABASE_URL)
 *   - `replica`  → ReadPrismaService (READ_DATABASE_URL)
 */
@Injectable()
export class DatabaseService {
  constructor(
    /** Primary PostgreSQL connection — accepts all writes and consistency-critical reads. */
    public readonly primary: PrismaService,
    /** Read-replica connection — eventual consistency; analytics and historical reads only. */
    public readonly replica: ReadPrismaService,
  ) {}
}
