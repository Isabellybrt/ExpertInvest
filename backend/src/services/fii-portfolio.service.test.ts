import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FIIPortfolioService } from './fii-portfolio.service.js';

// Mock FIIRepository
const mockFIIRepository = {
  findByUserIdWithAllDividends: vi.fn(),
};

describe('FIIPortfolioService', () => {
  let service: FIIPortfolioService;
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FIIPortfolioService({ fiiRepository: mockFIIRepository as any });
  });

  describe('getPortfolio', () => {
    it('should return empty array for user with no FIIs', async () => {
      mockFIIRepository.findByUserIdWithAllDividends.mockResolvedValue([]);

      const result = await service.getPortfolio(userId);

      expect(result).toEqual([]);
      expect(mockFIIRepository.findByUserIdWithAllDividends).toHaveBeenCalledWith(userId);
    });

    it('should return 0 for calculated fields when FII has no dividends', async () => {
      mockFIIRepository.findByUserIdWithAllDividends.mockResolvedValue([
        {
          id: 'fii-1',
          userId,
          ticker: 'HGLG11',
          shares: 50,
          averagePrice: 160.25,
          createdAt: new Date('2024-01-10'),
          dividends: [],
        },
      ]);

      const result = await service.getPortfolio(userId);

      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('HGLG11');
      expect(result[0].shares).toBe(50);
      expect(result[0].averagePrice).toBe(160.25);
      expect(result[0].lastMonthDividend).toBe(0);
      expect(result[0].projectedMonthlyYield).toBe(0);
    });

    it('should correctly calculate lastMonthDividend with multiple dividend records in previous month', async () => {
      // Use a fixed reference: the service uses new Date() internally,
      // so we mock Date to control "now"
      const now = new Date('2024-03-15T12:00:00.000Z');
      vi.setSystemTime(now);

      // Previous month is February 2024
      mockFIIRepository.findByUserIdWithAllDividends.mockResolvedValue([
        {
          id: 'fii-1',
          userId,
          ticker: 'MXRF11',
          shares: 100,
          averagePrice: 10.5,
          createdAt: new Date('2024-01-01'),
          dividends: [
            // Most recent first (ordered by paymentDate desc)
            {
              id: 'div-3',
              fiiId: 'fii-1',
              dividendPerShare: 0.10,
              paymentDate: new Date('2024-02-25'),
            },
            {
              id: 'div-2',
              fiiId: 'fii-1',
              dividendPerShare: 0.08,
              paymentDate: new Date('2024-02-10'),
            },
            {
              id: 'div-1',
              fiiId: 'fii-1',
              dividendPerShare: 0.09,
              paymentDate: new Date('2024-01-15'),
            },
          ],
        },
      ]);

      const result = await service.getPortfolio(userId);

      expect(result).toHaveLength(1);
      // lastMonthDividend = (0.10 * 100) + (0.08 * 100) = 10 + 8 = 18
      expect(result[0].lastMonthDividend).toBe(18);
      // projectedMonthlyYield uses the most recent dividend (first in array) = 0.10 * 100 = 10
      expect(result[0].projectedMonthlyYield).toBe(10);

      vi.useRealTimers();
    });

    it('should correctly calculate projectedMonthlyYield with most recent dividend', async () => {
      const now = new Date('2024-06-15T12:00:00.000Z');
      vi.setSystemTime(now);

      mockFIIRepository.findByUserIdWithAllDividends.mockResolvedValue([
        {
          id: 'fii-1',
          userId,
          ticker: 'XPML11',
          shares: 200,
          averagePrice: 95.0,
          createdAt: new Date('2024-01-01'),
          dividends: [
            // Most recent first (ordered by paymentDate desc)
            {
              id: 'div-2',
              fiiId: 'fii-1',
              dividendPerShare: 0.75,
              paymentDate: new Date('2024-04-10'),
            },
            {
              id: 'div-1',
              fiiId: 'fii-1',
              dividendPerShare: 0.60,
              paymentDate: new Date('2024-03-10'),
            },
          ],
        },
      ]);

      const result = await service.getPortfolio(userId);

      expect(result).toHaveLength(1);
      // projectedMonthlyYield = most recent dividendPerShare * shares = 0.75 * 200 = 150
      expect(result[0].projectedMonthlyYield).toBe(150);
      // lastMonthDividend: previous month is May 2024, no dividends in May → 0
      expect(result[0].lastMonthDividend).toBe(0);

      vi.useRealTimers();
    });
  });
});
