import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service.js';
import { CalculationService } from './calculation.service.js';
import { CronService } from './cron.service.js';

// Mock repositories
function createMockFIIRepository() {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createQuote: vi.fn(),
    getLatestQuote: vi.fn(),
    createDividend: vi.fn(),
    getLatestDividend: vi.fn(),
  };
}

function createMockRendaFixaRepository() {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockMarketIndexRepository() {
  return {
    getLatest: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    findByTypeAndDate: vi.fn(),
  };
}

function createMockCronService() {
  return {
    getCachedQuote: vi.fn().mockReturnValue(null),
    getCachedDividend: vi.fn().mockReturnValue(null),
    isCacheValid: vi.fn().mockReturnValue(false),
    scheduleQuoteUpdate: vi.fn(),
    executeQuoteUpdate: vi.fn(),
    getLastExecution: vi.fn(),
    invalidateCache: vi.fn(),
    stop: vi.fn(),
    getLastExecutionTime: vi.fn(),
  } as unknown as CronService;
}

describe('DashboardService', () => {
  let dashboardService: DashboardService;
  let mockFiiRepo: ReturnType<typeof createMockFIIRepository>;
  let mockRendaFixaRepo: ReturnType<typeof createMockRendaFixaRepository>;
  let mockMarketIndexRepo: ReturnType<typeof createMockMarketIndexRepository>;
  let mockCronService: CronService;
  let calculationService: CalculationService;

  beforeEach(() => {
    mockFiiRepo = createMockFIIRepository();
    mockRendaFixaRepo = createMockRendaFixaRepository();
    mockMarketIndexRepo = createMockMarketIndexRepository();
    mockCronService = createMockCronService();
    calculationService = new CalculationService();

    dashboardService = new DashboardService({
      calculationService,
      cronService: mockCronService,
      fiiRepository: mockFiiRepo as any,
      rendaFixaRepository: mockRendaFixaRepo as any,
      marketIndexRepository: mockMarketIndexRepo as any,
    });
  });

  describe('getSummary', () => {
    it('should return zero values for empty portfolio', async () => {
      const summary = await dashboardService.getSummary('user-1');

      expect(summary).toEqual({
        totalPatrimony: 0,
        rendaFixaTotal: 0,
        fiiTotal: 0,
        rendaFixaPercentage: 0,
        fiiPercentage: 0,
        estimatedMonthlyDividends: 0,
      });
    });

    it('should calculate summary with FIIs only', async () => {
      mockFiiRepo.findByUserId.mockResolvedValue([
        {
          id: 'fii-1',
          userId: 'user-1',
          ticker: 'MXRF11',
          shares: 100,
          averagePrice: 10.0,
          purchaseDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          quotes: [{ price: 12.0, updatedAt: new Date(), sourceDate: new Date() }],
          dividends: [{ dividendPerShare: 0.10, paymentDate: new Date(), dividendYield: 0.83 }],
        },
      ]);

      const summary = await dashboardService.getSummary('user-1');

      expect(summary.fiiTotal).toBe(1200); // 100 shares * R$12
      expect(summary.rendaFixaTotal).toBe(0);
      expect(summary.totalPatrimony).toBe(1200);
      expect(summary.fiiPercentage).toBe(100);
      expect(summary.rendaFixaPercentage).toBe(0);
      expect(summary.estimatedMonthlyDividends).toBe(10); // 100 * 0.10
    });

    it('should calculate summary with Renda Fixa only', async () => {
      mockRendaFixaRepo.findByUserId.mockResolvedValue([
        {
          id: 'rf-1',
          userId: 'user-1',
          institution: 'Banco X',
          investedAmount: 10000,
          maturityDate: new Date('2025-12-01'),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 100,
          ipcaPlusRate: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]);

      // Set CDI rate
      mockMarketIndexRepo.getLatest.mockImplementation(async (type: string) => {
        if (type === 'CDI') return { value: 0.0004 }; // Daily CDI
        return null;
      });

      const summary = await dashboardService.getSummary('user-1');

      expect(summary.rendaFixaTotal).toBeGreaterThan(10000);
      expect(summary.fiiTotal).toBe(0);
      expect(summary.totalPatrimony).toBe(summary.rendaFixaTotal);
      expect(summary.rendaFixaPercentage).toBe(100);
      expect(summary.fiiPercentage).toBe(0);
    });

    it('should calculate summary with both asset types', async () => {
      mockRendaFixaRepo.findByUserId.mockResolvedValue([
        {
          id: 'rf-1',
          userId: 'user-1',
          institution: 'Banco X',
          investedAmount: 5000,
          maturityDate: new Date('2025-12-01'),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 100,
          ipcaPlusRate: null,
          createdAt: new Date(), // Created now so projection = investedAmount
          updatedAt: new Date(),
        },
      ]);

      mockFiiRepo.findByUserId.mockResolvedValue([
        {
          id: 'fii-1',
          userId: 'user-1',
          ticker: 'HGLG11',
          shares: 50,
          averagePrice: 100.0,
          purchaseDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          quotes: [{ price: 120.0, updatedAt: new Date(), sourceDate: new Date() }],
          dividends: [{ dividendPerShare: 0.80, paymentDate: new Date(), dividendYield: 0.67 }],
        },
      ]);

      const summary = await dashboardService.getSummary('user-1');

      expect(summary.fiiTotal).toBe(6000); // 50 * 120
      expect(summary.rendaFixaTotal).toBe(5000); // Created now, no interest accrued
      expect(summary.totalPatrimony).toBe(11000);
      // Allocation: RF = 5000/11000 ≈ 45.45%, FII = 54.55%
      expect(summary.rendaFixaPercentage).toBeCloseTo(45.45, 1);
      expect(summary.fiiPercentage).toBeCloseTo(54.55, 1);
      expect(summary.estimatedMonthlyDividends).toBe(40); // 50 * 0.80
    });

    it('should use cached quote from cron service when available', async () => {
      (mockCronService.getCachedQuote as any).mockImplementation((ticker: string) => {
        if (ticker === 'XPLG11') return { price: 150.0, sourceDate: new Date() };
        return null;
      });

      mockFiiRepo.findByUserId.mockResolvedValue([
        {
          id: 'fii-1',
          userId: 'user-1',
          ticker: 'XPLG11',
          shares: 10,
          averagePrice: 100.0,
          purchaseDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          quotes: [{ price: 110.0, updatedAt: new Date(), sourceDate: new Date() }],
          dividends: [],
        },
      ]);

      const summary = await dashboardService.getSummary('user-1');

      // Should use cached price (150) instead of DB price (110)
      expect(summary.fiiTotal).toBe(1500); // 10 * 150
    });
  });

  describe('getPatrimonyHistory', () => {
    it('should return empty array for user with no assets', async () => {
      const history = await dashboardService.getPatrimonyHistory('user-1');
      expect(history).toEqual([]);
    });

    it('should return monthly points for user with assets', async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      mockFiiRepo.findByUserId.mockResolvedValue([
        {
          id: 'fii-1',
          userId: 'user-1',
          ticker: 'MXRF11',
          shares: 100,
          averagePrice: 10.0,
          purchaseDate: sixMonthsAgo,
          createdAt: sixMonthsAgo,
          updatedAt: sixMonthsAgo,
          quotes: [{ price: 12.0, updatedAt: new Date(), sourceDate: new Date() }],
          dividends: [],
        },
      ]);

      const history = await dashboardService.getPatrimonyHistory('user-1');

      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.length).toBeLessThanOrEqual(60);

      // Each point should have month (YYYY-MM format) and value
      for (const point of history) {
        expect(point.month).toMatch(/^\d{4}-\d{2}$/);
        expect(point.value).toBeGreaterThanOrEqual(0);
      }
    });

    it('should respect months parameter (clamped to 1-60)', async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      mockRendaFixaRepo.findByUserId.mockResolvedValue([
        {
          id: 'rf-1',
          userId: 'user-1',
          institution: 'Banco A',
          investedAmount: 1000,
          maturityDate: new Date('2026-01-01'),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 100,
          ipcaPlusRate: null,
          createdAt: oneYearAgo,
          updatedAt: oneYearAgo,
        },
      ]);

      const history = await dashboardService.getPatrimonyHistory('user-1', 3);

      expect(history.length).toBe(3);
    });
  });

  describe('getDividends', () => {
    it('should return 18 points (12 history + 6 projection) when FIIs exist', async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      mockFiiRepo.findByUserId.mockResolvedValue([
        {
          id: 'fii-1',
          userId: 'user-1',
          ticker: 'HGLG11',
          shares: 20,
          averagePrice: 150.0,
          purchaseDate: sixMonthsAgo,
          createdAt: sixMonthsAgo,
          updatedAt: sixMonthsAgo,
          quotes: [{ price: 160.0, updatedAt: new Date(), sourceDate: new Date() }],
          dividends: [{ dividendPerShare: 1.20, paymentDate: new Date(), dividendYield: 0.75 }],
        },
      ]);

      const dividends = await dashboardService.getDividends('user-1');

      expect(dividends.length).toBe(18);

      // First 12 are history
      const history = dividends.filter((d) => !d.isProjection);
      expect(history.length).toBe(12);

      // Last 6 are projections
      const projections = dividends.filter((d) => d.isProjection);
      expect(projections.length).toBe(6);

      // Projection value should be shares * lastDividendPerShare = 20 * 1.20 = 24
      for (const proj of projections) {
        expect(proj.value).toBe(24);
      }

      // Each point should have month format
      for (const point of dividends) {
        expect(point.month).toMatch(/^\d{4}-\d{2}$/);
      }
    });

    it('should return zero values when no FIIs exist', async () => {
      const dividends = await dashboardService.getDividends('user-1');

      expect(dividends.length).toBe(18);
      for (const point of dividends) {
        expect(point.value).toBe(0);
      }
    });

    it('should handle FIIs with no dividend data', async () => {
      mockFiiRepo.findByUserId.mockResolvedValue([
        {
          id: 'fii-1',
          userId: 'user-1',
          ticker: 'NEWF11',
          shares: 50,
          averagePrice: 80.0,
          purchaseDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          quotes: [{ price: 85.0, updatedAt: new Date(), sourceDate: new Date() }],
          dividends: [], // No dividends
        },
      ]);

      const dividends = await dashboardService.getDividends('user-1');

      // With no dividend data, all values should be 0
      for (const point of dividends) {
        expect(point.value).toBe(0);
      }
    });
  });

  describe('getAllocation', () => {
    it('should return zero allocation for empty portfolio', async () => {
      const allocation = await dashboardService.getAllocation('user-1');

      expect(allocation).toEqual({
        rendaFixaPercentage: 0,
        fiiPercentage: 0,
        rendaFixaTotal: 0,
        fiiTotal: 0,
      });
    });

    it('should return 100% FII when only FIIs exist', async () => {
      mockFiiRepo.findByUserId.mockResolvedValue([
        {
          id: 'fii-1',
          userId: 'user-1',
          ticker: 'MXRF11',
          shares: 100,
          averagePrice: 10.0,
          purchaseDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          quotes: [{ price: 12.0, updatedAt: new Date(), sourceDate: new Date() }],
          dividends: [],
        },
      ]);

      const allocation = await dashboardService.getAllocation('user-1');

      expect(allocation.fiiPercentage).toBe(100);
      expect(allocation.rendaFixaPercentage).toBe(0);
      expect(allocation.fiiTotal).toBe(1200);
    });

    it('should return 100% Renda Fixa when only RF exists', async () => {
      mockRendaFixaRepo.findByUserId.mockResolvedValue([
        {
          id: 'rf-1',
          userId: 'user-1',
          institution: 'Banco X',
          investedAmount: 5000,
          maturityDate: new Date('2026-01-01'),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 100,
          ipcaPlusRate: null,
          createdAt: new Date(), // Now, so no interest
          updatedAt: new Date(),
        },
      ]);

      const allocation = await dashboardService.getAllocation('user-1');

      expect(allocation.rendaFixaPercentage).toBe(100);
      expect(allocation.fiiPercentage).toBe(0);
      expect(allocation.rendaFixaTotal).toBe(5000);
    });

    it('should sum to 100% when both asset types exist', async () => {
      mockRendaFixaRepo.findByUserId.mockResolvedValue([
        {
          id: 'rf-1',
          userId: 'user-1',
          institution: 'Banco X',
          investedAmount: 3000,
          maturityDate: new Date('2026-01-01'),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 100,
          ipcaPlusRate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockFiiRepo.findByUserId.mockResolvedValue([
        {
          id: 'fii-1',
          userId: 'user-1',
          ticker: 'XPLG11',
          shares: 20,
          averagePrice: 100.0,
          purchaseDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          quotes: [{ price: 100.0, updatedAt: new Date(), sourceDate: new Date() }],
          dividends: [],
        },
      ]);

      const allocation = await dashboardService.getAllocation('user-1');

      // RF = 3000, FII = 20*100 = 2000, Total = 5000
      // RF% = 60%, FII% = 40%
      expect(allocation.rendaFixaPercentage + allocation.fiiPercentage).toBe(100);
      expect(allocation.rendaFixaPercentage).toBe(60);
      expect(allocation.fiiPercentage).toBe(40);
    });
  });
});
