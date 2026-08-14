/**
 * database.service.spec.ts
 *
 * Verifies the routing abstraction: DatabaseService exposes both .primary
 * and .replica, and each repository delegates to the correct client.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { DatabaseService } from './database.service.js';
import { PrismaService } from '../prisma.service.js';
import { ReadPrismaService } from '../read-prisma.service.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { CustomersRepository } from '../customers/customers.repository.js';
import { AnalyticsRepository } from '../analytics/analytics.repository.js';

// ─── Shared mock factories ───────────────────────────────────────────────────

const buildPrimaryMock = () => ({
  order: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
});

const buildReplicaMock = () => ({
  order: {
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
});

// ─── DatabaseService: exposes both clients ───────────────────────────────────

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  const primaryMock = buildPrimaryMock();
  const replicaMock = buildReplicaMock();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        { provide: PrismaService, useValue: primaryMock },
        { provide: ReadPrismaService, useValue: replicaMock },
      ],
    }).compile();

    dbService = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(dbService).toBeDefined();
  });

  it('should expose the primary client', () => {
    expect(dbService.primary).toBe(primaryMock);
  });

  it('should expose the replica client', () => {
    expect(dbService.replica).toBe(replicaMock);
  });

  it('primary and replica should be different client instances', () => {
    expect(dbService.primary).not.toBe(dbService.replica);
  });
});

// ─── OrdersRepository routing ─────────────────────────────────────────────────

describe('OrdersRepository routing', () => {
  let repo: OrdersRepository;
  const primaryMock = buildPrimaryMock();
  const replicaMock = buildReplicaMock();
  const dbMock = { primary: primaryMock, replica: replicaMock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersRepository,
        { provide: DatabaseService, useValue: dbMock },
      ],
    }).compile();

    repo = module.get<OrdersRepository>(OrdersRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('should route findOne (no orderedAt) to db.primary via findFirst', async () => {
    (
      primaryMock.order.findFirst as ReturnType<typeof jest.fn>
    ).mockResolvedValue({ id: 'o1' });

    await repo.findOne('o1', {});

    expect(primaryMock.order.findFirst).toHaveBeenCalledTimes(1);
    // Replica must NOT be touched
    expect(replicaMock.order.findMany).not.toHaveBeenCalled();
  });

  it('should route findOne (with orderedAt) to db.primary via findUnique', async () => {
    (
      primaryMock.order.findUnique as ReturnType<typeof jest.fn>
    ).mockResolvedValue({ id: 'o1' });

    await repo.findOne('o1', { orderedAt: '2026-05-15T10:00:00Z' });

    expect(primaryMock.order.findUnique).toHaveBeenCalledTimes(1);
    expect(replicaMock.order.findMany).not.toHaveBeenCalled();
  });
});

// ─── CustomersRepository routing ─────────────────────────────────────────────

describe('CustomersRepository routing', () => {
  let repo: CustomersRepository;
  const primaryMock = buildPrimaryMock();
  const replicaMock = buildReplicaMock();
  const dbMock = { primary: primaryMock, replica: replicaMock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersRepository,
        { provide: DatabaseService, useValue: dbMock },
      ],
    }).compile();

    repo = module.get<CustomersRepository>(CustomersRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('should route findCustomerOrders to db.replica', async () => {
    (
      replicaMock.order.findMany as ReturnType<typeof jest.fn>
    ).mockResolvedValue([]);

    await repo.findCustomerOrders('cust-1', { limit: 5 });

    expect(replicaMock.order.findMany).toHaveBeenCalledTimes(1);
    // Primary must NOT be touched
    expect(primaryMock.order.findFirst).not.toHaveBeenCalled();
    expect(primaryMock.order.findUnique).not.toHaveBeenCalled();
  });
});

// ─── AnalyticsRepository routing ─────────────────────────────────────────────

describe('AnalyticsRepository routing', () => {
  let repo: AnalyticsRepository;
  const primaryMock = buildPrimaryMock();
  const replicaMock = buildReplicaMock();
  const dbMock = { primary: primaryMock, replica: replicaMock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsRepository,
        { provide: DatabaseService, useValue: dbMock },
      ],
    }).compile();

    repo = module.get<AnalyticsRepository>(AnalyticsRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('should route getCustomerRevenue to db.replica', async () => {
    (replicaMock.$queryRaw as ReturnType<typeof jest.fn>).mockResolvedValue([]);

    await repo.getCustomerRevenue({ days: 90 });

    expect(replicaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(primaryMock.order.findFirst).not.toHaveBeenCalled();
  });

  it('should route getTopProducts to db.replica', async () => {
    (replicaMock.$queryRaw as ReturnType<typeof jest.fn>).mockResolvedValue([]);

    await repo.getTopProducts({});

    expect(replicaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(primaryMock.order.findFirst).not.toHaveBeenCalled();
  });
});
