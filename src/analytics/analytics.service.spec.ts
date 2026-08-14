import { Test, TestingModule } from "@nestjs/testing";
import { jest } from "@jest/globals";
import { AnalyticsService } from "./analytics.service.js";
import { AnalyticsRepository } from "./analytics.repository.js";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let repository: AnalyticsRepository;

  const mockAnalyticsRepository = {
    getCustomerRevenue: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: AnalyticsRepository,
          useValue: mockAnalyticsRepository
        }
      ]
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    repository = module.get<AnalyticsRepository>(AnalyticsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getCustomerRevenue", () => {
    it("should return mapped CustomerRevenueResponseDto list", async () => {
      const mockRawRows = [
        {
          customerId: "cust-1",
          name: "Bob Smith",
          email: "bob@example.com",
          revenue: 450.75
        },
        {
          customerId: "cust-2",
          name: "Alice Jones",
          email: "alice@example.com",
          revenue: "150.25"
        }
      ];

      mockAnalyticsRepository.getCustomerRevenue.mockResolvedValue(mockRawRows);

      const result = await service.getCustomerRevenue({ days: 90 });

      expect(mockAnalyticsRepository.getCustomerRevenue).toHaveBeenCalledWith({ days: 90 });
      expect(result).toEqual([
        {
          customerId: "cust-1",
          name: "Bob Smith",
          email: "bob@example.com",
          revenue: 450.75
        },
        {
          customerId: "cust-2",
          name: "Alice Jones",
          email: "alice@example.com",
          revenue: 150.25
        }
      ]);
    });
  });
});
