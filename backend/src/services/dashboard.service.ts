import { CalculationService } from './calculation.service.js';
import { CronService } from './cron.service.js';
import { FIIRepository } from '../repositories/fii.repository.js';
import { RendaFixaRepository } from '../repositories/renda-fixa.repository.js';
import { MarketIndexRepository } from '../repositories/market-index.repository.js';
import type {
  RendaFixaAsset,
  FIIWithQuote,
} from './interfaces/calculation.interface.js';

/**
 * Response DTO for portfolio summary.
 * Validates: Requirements 8.1, 8.2
 */
export interface PortfolioSummary {
  totalPatrimony: number;
  rendaFixaTotal: number;
  fiiTotal: number;
  rendaFixaPercentage: number;
  fiiPercentage: number;
  estimatedMonthlyDividends: number;
}

/**
 * Single data point for patrimony history chart.
 * Validates: Requirement 9.1
 */
export interface PatrimonyPoint {
  month: string; // YYYY-MM
  value: number;
}

/**
 * Single data point for dividend chart (history + projection).
 * Validates: Requirements 10.1, 10.2
 */
export interface DividendPoint {
  month: string; // YYYY-MM
  value: number;
  isProjection: boolean;
}

/**
 * Allocation breakdown response.
 */
export interface AllocationData {
  rendaFixaPercentage: number;
  fiiPercentage: number;
  rendaFixaTotal: number;
  fiiTotal: number;
}

export interface DashboardServiceDeps {
  calculationService: CalculationService;
  cronService: CronService;
  fiiRepository: FIIRepository;
  rendaFixaRepository: RendaFixaRepository;
  marketIndexRepository: MarketIndexRepository;
}

/**
 * DashboardService aggregates portfolio data for dashboard endpoints.
 * All data is served from local cache/DB — no direct API calls.
 *
 * Validates: Requirements 8.1, 8.2, 9.1, 9.2, 10.1, 10.2
 */
export class DashboardService {
  private calculationService: CalculationService;
  private cronService: CronService;
  private fiiRepository: FIIRepository;
  private rendaFixaRepository: RendaFixaRepository;
  private marketIndexRepository: MarketIndexRepository;

  constructor(deps: DashboardServiceDeps) {
    this.calculationService = deps.calculationService;
    this.cronService = deps.cronService;
    this.fiiRepository = deps.fiiRepository;
    this.rendaFixaRepository = deps.rendaFixaRepository;
    this.marketIndexRepository = deps.marketIndexRepository;
  }

  /**
   * Get current CDI and IPCA rates from DB (latest values).
   */
  private async getMarketRates(): Promise<{ cdiRate: number; ipcaRate: number }> {
    const cdiIndex = await this.marketIndexRepository.getLatest('CDI');
    const ipcaIndex = await this.marketIndexRepository.getLatest('IPCA');

    return {
      cdiRate: cdiIndex ? Number(cdiIndex.value) : 0,
      ipcaRate: ipcaIndex ? Number(ipcaIndex.value) : 0,
    };
  }

  /**
   * Map a DB RendaFixa record to the RendaFixaAsset interface used by CalculationService.
   */
  private mapRendaFixaAsset(rf: {
    id: string;
    investedAmount: unknown;
    rateType: string;
    rateValue: unknown;
    ipcaPlusRate: unknown;
    maturityDate: Date;
    createdAt: Date;
  }): RendaFixaAsset {
    return {
      id: rf.id,
      investedAmount: Number(rf.investedAmount),
      rateType: rf.rateType as 'CDI_PERCENTAGE' | 'IPCA_PLUS',
      rateValue: Number(rf.rateValue),
      ipcaPlusRate: rf.ipcaPlusRate ? Number(rf.ipcaPlusRate) : null,
      maturityDate: rf.maturityDate,
      createdAt: rf.createdAt,
    };
  }

  /**
   * Map a DB FII record (with included quotes/dividends) to FIIWithQuote.
   */
  private mapFIIWithQuote(fii: {
    id: string;
    ticker: string;
    shares: number;
    averagePrice: unknown;
    quotes: Array<{ price: unknown; updatedAt: Date }>;
    dividends: Array<{ dividendPerShare: unknown; paymentDate: Date }>;
  }): FIIWithQuote {
    const latestQuote = fii.quotes[0];
    const latestDividend = fii.dividends[0];

    // Use cached quote from cronService if available, otherwise use DB
    const cachedQuote = this.cronService.getCachedQuote(fii.ticker);

    const currentPrice = cachedQuote
      ? cachedQuote.price
      : latestQuote
        ? Number(latestQuote.price)
        : Number(fii.averagePrice);

    const lastQuoteUpdate = cachedQuote
      ? cachedQuote.sourceDate
      : latestQuote
        ? latestQuote.updatedAt
        : null;

    const cachedDividend = this.cronService.getCachedDividend(fii.ticker);

    const lastDividendPerShare = cachedDividend
      ? cachedDividend.dividendPerShare
      : latestDividend
        ? Number(latestDividend.dividendPerShare)
        : null;

    const lastDividendPaymentDate = cachedDividend
      ? cachedDividend.paymentDate
      : latestDividend
        ? latestDividend.paymentDate
        : null;

    return {
      id: fii.id,
      ticker: fii.ticker,
      shares: fii.shares,
      averagePrice: Number(fii.averagePrice),
      currentPrice,
      lastDividendPerShare,
      lastQuoteUpdate,
      lastDividendPaymentDate,
    };
  }

  /**
   * Get portfolio summary: total patrimony, allocation, estimated dividends.
   * Validates: Requirements 8.1, 8.2
   */
  async getSummary(userId: string): Promise<PortfolioSummary> {
    const { cdiRate, ipcaRate } = await this.getMarketRates();

    const rendaFixaRecords = await this.rendaFixaRepository.findByUserId(userId);
    const fiiRecords = await this.fiiRepository.findByUserId(userId);

    const rendaFixaAssets = rendaFixaRecords.map((rf) => this.mapRendaFixaAsset(rf));
    const fiiAssets = fiiRecords.map((fii) => this.mapFIIWithQuote(fii));

    // Calculate Renda Fixa total (sum of projected balances)
    const rendaFixaTotal = rendaFixaAssets.reduce((sum, asset) => {
      const projection = this.calculationService.calculateRendaFixaProjection(
        asset,
        cdiRate,
        ipcaRate
      );
      return sum + projection.projectedBalance;
    }, 0);

    // Calculate FII total (sum of shares × current price)
    const fiiTotal = fiiAssets.reduce(
      (sum, fii) => sum + fii.shares * fii.currentPrice,
      0
    );

    const totalPatrimony = Math.round((rendaFixaTotal + fiiTotal) * 100) / 100;

    // Allocation percentages
    const allocation = this.calculationService.calculateAllocation(
      rendaFixaTotal,
      fiiTotal
    );

    // Estimated monthly dividends
    const dividendProjection =
      this.calculationService.calculateDividendProjection(fiiAssets);

    return {
      totalPatrimony,
      rendaFixaTotal: Math.round(rendaFixaTotal * 100) / 100,
      fiiTotal: Math.round(fiiTotal * 100) / 100,
      rendaFixaPercentage: allocation.rendaFixaPercentage,
      fiiPercentage: allocation.fiiPercentage,
      estimatedMonthlyDividends: dividendProjection.totalProjected,
    };
  }

  /**
   * Generate patrimony history with monthly granularity.
   * Returns 1-60 months of data based on user's earliest asset creation.
   * Validates: Requirements 9.1, 9.2
   */
  async getPatrimonyHistory(
    userId: string,
    months?: number
  ): Promise<PatrimonyPoint[]> {
    const { cdiRate, ipcaRate } = await this.getMarketRates();

    const rendaFixaRecords = await this.rendaFixaRepository.findByUserId(userId);
    const fiiRecords = await this.fiiRepository.findByUserId(userId);

    const rendaFixaAssets = rendaFixaRecords.map((rf) => this.mapRendaFixaAsset(rf));
    const fiiAssets = fiiRecords.map((fii) => this.mapFIIWithQuote(fii));

    // Determine how many months of history we can show
    const now = new Date();
    const allDates: Date[] = [
      ...rendaFixaAssets.map((rf) => rf.createdAt),
      ...fiiRecords.map((fii) => fii.createdAt),
    ];

    if (allDates.length === 0) {
      return [];
    }

    const earliest = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const diffMonths = this.monthDiff(earliest, now);
    const totalMonths = Math.min(Math.max(diffMonths, 1), months ?? 60);

    const points: PatrimonyPoint[] = [];

    for (let i = totalMonths - 1; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = this.formatMonth(targetDate);

      // For historical months, calculate value using assets that existed at that point
      const rfValue = rendaFixaAssets
        .filter((rf) => rf.createdAt <= targetDate)
        .reduce((sum, asset) => {
          // Simplified: use current projection proportional to time
          const projection = this.calculationService.calculateRendaFixaProjection(
            asset,
            cdiRate,
            ipcaRate
          );
          // Scale projection based on how much time had passed at targetDate vs now
          const totalDays = Math.max(1, this.daysDiff(asset.createdAt, now));
          const daysAtTarget = Math.max(0, this.daysDiff(asset.createdAt, targetDate));
          const ratio = Math.min(daysAtTarget / totalDays, 1);
          const valueAtTarget =
            asset.investedAmount +
            (projection.projectedBalance - asset.investedAmount) * ratio;
          return sum + valueAtTarget;
        }, 0);

      const fiiValue = fiiAssets
        .filter((fii) => {
          const fiiRecord = fiiRecords.find((f) => f.id === fii.id);
          return fiiRecord && fiiRecord.createdAt <= targetDate;
        })
        .reduce((sum, fii) => sum + fii.shares * fii.currentPrice, 0);

      points.push({
        month: monthStr,
        value: Math.round((rfValue + fiiValue) * 100) / 100,
      });
    }

    return points;
  }

  /**
   * Get dividend history (last 12 months) + projection (next 6 months).
   * Validates: Requirements 10.1, 10.2
   */
  async getDividends(userId: string): Promise<DividendPoint[]> {
    const fiiRecords = await this.fiiRepository.findByUserId(userId);
    const fiiAssets = fiiRecords.map((fii) => this.mapFIIWithQuote(fii));

    const now = new Date();
    const points: DividendPoint[] = [];

    // Last 12 months — historical dividends
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = this.formatMonth(targetDate);

      // Sum dividends received in this month from all FIIs
      const monthlyValue = fiiAssets.reduce((sum, fii) => {
        // Use last known dividend per share as approximation for monthly dividend
        const dividendPerShare = fii.lastDividendPerShare ?? 0;
        // Only count if the FII existed in that month
        const fiiRecord = fiiRecords.find((f) => f.id === fii.id);
        if (fiiRecord && fiiRecord.createdAt <= targetDate) {
          return sum + fii.shares * dividendPerShare;
        }
        return sum;
      }, 0);

      points.push({
        month: monthStr,
        value: Math.round(monthlyValue * 100) / 100,
        isProjection: false,
      });
    }

    // Next 6 months — projected dividends
    for (let i = 1; i <= 6; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = this.formatMonth(targetDate);

      // Project using last known dividend per share for each FII
      const projectedValue = fiiAssets.reduce((sum, fii) => {
        const dividendPerShare = fii.lastDividendPerShare ?? 0;
        return sum + fii.shares * dividendPerShare;
      }, 0);

      points.push({
        month: monthStr,
        value: Math.round(projectedValue * 100) / 100,
        isProjection: true,
      });
    }

    return points;
  }

  /**
   * Get allocation breakdown.
   * Validates: Requirements 8.2, 8.3
   */
  async getAllocation(userId: string): Promise<AllocationData> {
    const { cdiRate, ipcaRate } = await this.getMarketRates();

    const rendaFixaRecords = await this.rendaFixaRepository.findByUserId(userId);
    const fiiRecords = await this.fiiRepository.findByUserId(userId);

    const rendaFixaAssets = rendaFixaRecords.map((rf) => this.mapRendaFixaAsset(rf));
    const fiiAssets = fiiRecords.map((fii) => this.mapFIIWithQuote(fii));

    const rendaFixaTotal = rendaFixaAssets.reduce((sum, asset) => {
      const projection = this.calculationService.calculateRendaFixaProjection(
        asset,
        cdiRate,
        ipcaRate
      );
      return sum + projection.projectedBalance;
    }, 0);

    const fiiTotal = fiiAssets.reduce(
      (sum, fii) => sum + fii.shares * fii.currentPrice,
      0
    );

    const allocation = this.calculationService.calculateAllocation(
      rendaFixaTotal,
      fiiTotal
    );

    return {
      rendaFixaPercentage: allocation.rendaFixaPercentage,
      fiiPercentage: allocation.fiiPercentage,
      rendaFixaTotal: Math.round(rendaFixaTotal * 100) / 100,
      fiiTotal: Math.round(fiiTotal * 100) / 100,
    };
  }

  /**
   * Calculate the difference in months between two dates.
   */
  private monthDiff(from: Date, to: Date): number {
    return (
      (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth())
    );
  }

  /**
   * Calculate the difference in days between two dates.
   */
  private daysDiff(from: Date, to: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((to.getTime() - from.getTime()) / msPerDay);
  }

  /**
   * Format a date as YYYY-MM string.
   */
  private formatMonth(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
