import { describe, it, expect, beforeEach } from 'vitest';
import { CalculationService } from './calculation.service.js';
import {
  RendaFixaAsset,
  FIIWithQuote,
} from './interfaces/calculation.interface.js';

describe('CalculationService', () => {
  let service: CalculationService;

  beforeEach(() => {
    service = new CalculationService();
  });

  describe('calculateRendaFixaProjection', () => {
    it('should calculate CDI compound interest correctly', () => {
      // V * (1 + R * P/100)^D
      // 10000 * (1 + 0.0004 * 110/100)^22 = 10000 * (1.00044)^22
      const asset: RendaFixaAsset = {
        id: '1',
        investedAmount: 10000,
        rateType: 'CDI_PERCENTAGE',
        rateValue: 110, // 110% of CDI
        maturityDate: new Date('2025-12-31'),
        createdAt: new Date('2025-01-02'),
      };

      const cdiRate = 0.0004; // daily CDI rate
      const ipcaRate = 0; // not used for CDI

      const result = service.calculateRendaFixaProjection(asset, cdiRate, ipcaRate);

      expect(result.projectedBalance).toBeGreaterThan(10000);
      expect(result.grossReturn).toBeGreaterThan(0);
      expect(result.businessDays).toBeGreaterThan(0);
    });

    it('should calculate IPCA + fixed rate correctly', () => {
      // V * (1 + I + T/100)^(D/252)
      const asset: RendaFixaAsset = {
        id: '2',
        investedAmount: 50000,
        rateType: 'IPCA_PLUS',
        rateValue: 5, // 5% fixed rate
        maturityDate: new Date('2026-12-31'),
        createdAt: new Date('2025-01-02'),
      };

      const cdiRate = 0; // not used for IPCA
      const ipcaRate = 0.045; // annual IPCA 4.5%

      const result = service.calculateRendaFixaProjection(asset, cdiRate, ipcaRate);

      expect(result.projectedBalance).toBeGreaterThan(50000);
      expect(result.grossReturn).toBeGreaterThan(0);
      expect(result.businessDays).toBeGreaterThan(0);
    });

    it('should return invested amount when 0 business days', () => {
      const now = new Date();
      const asset: RendaFixaAsset = {
        id: '3',
        investedAmount: 1000,
        rateType: 'CDI_PERCENTAGE',
        rateValue: 100,
        maturityDate: new Date('2025-12-31'),
        createdAt: now, // created right now
      };

      const result = service.calculateRendaFixaProjection(asset, 0.0004, 0);

      expect(result.projectedBalance).toBe(1000);
      expect(result.grossReturn).toBe(0);
      expect(result.businessDays).toBe(0);
    });

    it('should format projected balance to 2 decimal places', () => {
      const asset: RendaFixaAsset = {
        id: '4',
        investedAmount: 10000,
        rateType: 'CDI_PERCENTAGE',
        rateValue: 100,
        maturityDate: new Date('2026-12-31'),
        createdAt: new Date('2024-01-02'),
      };

      const result = service.calculateRendaFixaProjection(asset, 0.0004, 0);

      // Check 2 decimal places
      const decimals = result.projectedBalance.toString().split('.')[1];
      expect(!decimals || decimals.length <= 2).toBe(true);
    });
  });

  describe('calculateAveragePrice', () => {
    it('should calculate average price correctly for basic case', () => {
      // (10*50 + 5*60) / (10+5) = (500 + 300) / 15 = 53.33
      const result = service.calculateAveragePrice(10, 50, 5, 60);
      expect(result).toBe(53.33);
    });

    it('should return currentAvg when new qty is 0 (edge case)', () => {
      const result = service.calculateAveragePrice(10, 50, 0, 60);
      // (10*50 + 0*60) / (10+0) = 500/10 = 50
      expect(result).toBe(50);
    });

    it('should return 0 when total quantity is 0', () => {
      const result = service.calculateAveragePrice(0, 0, 0, 0);
      expect(result).toBe(0);
    });

    it('should return new price when current qty is 0', () => {
      const result = service.calculateAveragePrice(0, 0, 10, 25.5);
      // (0*0 + 10*25.5) / (0+10) = 25.5
      expect(result).toBe(25.5);
    });

    it('should handle equal prices', () => {
      const result = service.calculateAveragePrice(100, 10, 200, 10);
      expect(result).toBe(10);
    });

    it('should round to 2 decimal places', () => {
      // (3*10 + 7*3) / 10 = 51/10 = 5.1
      const result = service.calculateAveragePrice(3, 10, 7, 3);
      expect(result).toBe(5.1);
    });
  });

  describe('calculateDividendProjection', () => {
    it('should calculate total dividend projection', () => {
      const fiis: FIIWithQuote[] = [
        {
          id: '1',
          ticker: 'MXRF11',
          shares: 100,
          averagePrice: 10,
          currentPrice: 11,
          lastDividendPerShare: 0.08,
          lastQuoteUpdate: new Date(),
          lastDividendPaymentDate: new Date(),
        },
        {
          id: '2',
          ticker: 'XPLG11',
          shares: 50,
          averagePrice: 95,
          currentPrice: 100,
          lastDividendPerShare: 0.72,
          lastQuoteUpdate: new Date(),
          lastDividendPaymentDate: new Date(),
        },
      ];

      const result = service.calculateDividendProjection(fiis);

      // 100*0.08 + 50*0.72 = 8 + 36 = 44
      expect(result.totalProjected).toBe(44);
      expect(result.details).toHaveLength(2);
      expect(result.details[0].projectedValue).toBe(8);
      expect(result.details[1].projectedValue).toBe(36);
    });

    it('should treat null dividend as 0', () => {
      const fiis: FIIWithQuote[] = [
        {
          id: '1',
          ticker: 'HGLG11',
          shares: 200,
          averagePrice: 160,
          currentPrice: 170,
          lastDividendPerShare: null,
          lastQuoteUpdate: new Date(),
          lastDividendPaymentDate: null,
        },
      ];

      const result = service.calculateDividendProjection(fiis);

      expect(result.totalProjected).toBe(0);
      expect(result.details[0].lastDividendPerShare).toBe(0);
      expect(result.details[0].projectedValue).toBe(0);
    });

    it('should return 0 for empty FII list', () => {
      const result = service.calculateDividendProjection([]);
      expect(result.totalProjected).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    it('should format values to 2 decimal places', () => {
      const fiis: FIIWithQuote[] = [
        {
          id: '1',
          ticker: 'VISC11',
          shares: 33,
          averagePrice: 100,
          currentPrice: 105,
          lastDividendPerShare: 0.77,
          lastQuoteUpdate: new Date(),
          lastDividendPaymentDate: new Date(),
        },
      ];

      const result = service.calculateDividendProjection(fiis);

      // 33 * 0.77 = 25.41
      expect(result.totalProjected).toBe(25.41);
    });
  });

  describe('calculatePatrimonyTotal', () => {
    it('should sum projected RF balances and FII market values', () => {
      // Use a createdAt far enough in the past to generate some return
      const rendaFixa: RendaFixaAsset[] = [
        {
          id: '1',
          investedAmount: 10000,
          rateType: 'CDI_PERCENTAGE',
          rateValue: 100,
          maturityDate: new Date('2026-12-31'),
          createdAt: new Date('2024-01-02'),
        },
      ];

      const fiis: FIIWithQuote[] = [
        {
          id: '1',
          ticker: 'MXRF11',
          shares: 100,
          averagePrice: 10,
          currentPrice: 11,
          lastDividendPerShare: 0.08,
          lastQuoteUpdate: new Date(),
          lastDividendPaymentDate: new Date(),
        },
      ];

      const result = service.calculatePatrimonyTotal(rendaFixa, fiis, 0.0004, 0);

      // FII part = 100 * 11 = 1100
      // RF part > 10000 (due to CDI returns)
      expect(result).toBeGreaterThan(11100);
    });

    it('should return 0 for empty portfolio', () => {
      const result = service.calculatePatrimonyTotal([], [], 0.0004, 0.045);
      expect(result).toBe(0);
    });

    it('should handle only RF assets', () => {
      const rendaFixa: RendaFixaAsset[] = [
        {
          id: '1',
          investedAmount: 5000,
          rateType: 'CDI_PERCENTAGE',
          rateValue: 100,
          maturityDate: new Date('2026-12-31'),
          createdAt: new Date('2024-06-01'),
        },
      ];

      const result = service.calculatePatrimonyTotal(rendaFixa, [], 0.0004, 0);
      expect(result).toBeGreaterThan(5000);
    });

    it('should handle only FII assets', () => {
      const fiis: FIIWithQuote[] = [
        {
          id: '1',
          ticker: 'HGLG11',
          shares: 50,
          averagePrice: 160,
          currentPrice: 170,
          lastDividendPerShare: 1.0,
          lastQuoteUpdate: new Date(),
          lastDividendPaymentDate: new Date(),
        },
      ];

      const result = service.calculatePatrimonyTotal([], fiis, 0.0004, 0.045);
      // 50 * 170 = 8500
      expect(result).toBe(8500);
    });
  });

  describe('calculateAllocation', () => {
    it('should calculate correct percentages', () => {
      const result = service.calculateAllocation(7000, 3000);
      expect(result.rendaFixaPercentage).toBe(70);
      expect(result.fiiPercentage).toBe(30);
    });

    it('should sum to 100%', () => {
      const result = service.calculateAllocation(3333.33, 6666.67);
      expect(result.rendaFixaPercentage + result.fiiPercentage).toBe(100);
    });

    it('should return 100% RF when no FIIs', () => {
      const result = service.calculateAllocation(50000, 0);
      expect(result.rendaFixaPercentage).toBe(100);
      expect(result.fiiPercentage).toBe(0);
    });

    it('should return 100% FII when no RF', () => {
      const result = service.calculateAllocation(0, 25000);
      expect(result.rendaFixaPercentage).toBe(0);
      expect(result.fiiPercentage).toBe(100);
    });

    it('should return 0% for both when total is 0', () => {
      const result = service.calculateAllocation(0, 0);
      expect(result.rendaFixaPercentage).toBe(0);
      expect(result.fiiPercentage).toBe(0);
    });

    it('should always sum to exactly 100 for non-zero totals', () => {
      // Test with values that might cause floating point issues
      const result = service.calculateAllocation(1, 2);
      expect(result.rendaFixaPercentage + result.fiiPercentage).toBe(100);
    });
  });

  describe('calculateFIIVariation', () => {
    it('should calculate positive variation (appreciation)', () => {
      // ((110 - 100) / 100) * 100 = 10%
      const result = service.calculateFIIVariation(100, 110);
      expect(result).toBe(10);
    });

    it('should calculate negative variation (depreciation)', () => {
      // ((90 - 100) / 100) * 100 = -10%
      const result = service.calculateFIIVariation(100, 90);
      expect(result).toBe(-10);
    });

    it('should return 0 for equal prices', () => {
      const result = service.calculateFIIVariation(50, 50);
      expect(result).toBe(0);
    });

    it('should return 0 when average price is 0', () => {
      const result = service.calculateFIIVariation(0, 100);
      expect(result).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      // ((11.5 - 10.3) / 10.3) * 100 = 11.650485...
      const result = service.calculateFIIVariation(10.3, 11.5);
      expect(result).toBe(11.65);
    });
  });

  describe('isQuoteStale', () => {
    it('should return true when quote is older than 48 hours', () => {
      const staleDate = new Date();
      staleDate.setHours(staleDate.getHours() - 49);
      expect(service.isQuoteStale(staleDate)).toBe(true);
    });

    it('should return false when quote is within 48 hours', () => {
      const freshDate = new Date();
      freshDate.setHours(freshDate.getHours() - 24);
      expect(service.isQuoteStale(freshDate)).toBe(false);
    });

    it('should return false for a quote just now', () => {
      expect(service.isQuoteStale(new Date())).toBe(false);
    });

    it('should return true at exactly 48h + 1ms boundary', () => {
      const boundary = new Date();
      boundary.setTime(boundary.getTime() - (48 * 60 * 60 * 1000 + 1));
      expect(service.isQuoteStale(boundary)).toBe(true);
    });
  });

  describe('isDividendStale', () => {
    it('should return true when dividend is older than 60 days', () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 61);
      expect(service.isDividendStale(staleDate)).toBe(true);
    });

    it('should return false when dividend is within 60 days', () => {
      const freshDate = new Date();
      freshDate.setDate(freshDate.getDate() - 30);
      expect(service.isDividendStale(freshDate)).toBe(false);
    });

    it('should return false for a dividend paid today', () => {
      expect(service.isDividendStale(new Date())).toBe(false);
    });

    it('should return true at exactly 60 days + 1ms boundary', () => {
      const boundary = new Date();
      boundary.setTime(boundary.getTime() - (60 * 24 * 60 * 60 * 1000 + 1));
      expect(service.isDividendStale(boundary)).toBe(true);
    });
  });
});
