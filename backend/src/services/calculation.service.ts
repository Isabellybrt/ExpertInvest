import {
  ICalculationService,
  RendaFixaAsset,
  FIIWithQuote,
  ProjectionResult,
  DividendProjectionResult,
  AllocationResult,
} from './interfaces/calculation.interface.js';

/**
 * CalculationService implements all financial computations for the portfolio.
 *
 * Validates: Requirements 6.1, 6.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */
export class CalculationService implements ICalculationService {
  /** Threshold in milliseconds for quote staleness: 48 hours */
  private static readonly QUOTE_STALE_MS = 48 * 60 * 60 * 1000;

  /** Threshold in milliseconds for dividend staleness: 60 days */
  private static readonly DIVIDEND_STALE_MS = 60 * 24 * 60 * 60 * 1000;

  /**
   * Round a number to 2 decimal places.
   */
  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Count business days between two dates (excludes Saturdays and Sundays).
   * Used for CDI/IPCA compound interest calculations.
   */
  private countBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current < end) {
      current.setDate(current.getDate() + 1);
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
    }

    return count;
  }

  /**
   * Calculate projected balance for a Renda Fixa asset.
   *
   * CDI compound interest: V * (1 + R * P/100)^D
   *   where V = invested amount, R = daily CDI rate, P = contracted percentage, D = business days
   *
   * IPCA + fixed rate: V * (1 + I + T/100)^(D/252)
   *   where V = invested amount, I = annual IPCA rate, T = fixed rate, D = business days
   *
   * Uses last valid index value when CDI/IPCA unavailable (caller responsibility).
   *
   * Validates: Requirements 7.1, 7.3, 7.4
   */
  calculateRendaFixaProjection(
    asset: RendaFixaAsset,
    cdiRate: number,
    ipcaRate: number
  ): ProjectionResult {
    const now = new Date();
    const businessDays = this.countBusinessDays(asset.createdAt, now);

    if (businessDays <= 0) {
      return {
        projectedBalance: this.round2(asset.investedAmount),
        grossReturn: 0,
        dailyRate: 0,
        businessDays: 0,
      };
    }

    let projectedBalance: number;
    let dailyRate: number;

    if (asset.rateType === 'CDI_PERCENTAGE') {
      // CDI: V * (1 + R * P/100)^D
      // R = daily CDI rate, P = percentage of CDI contracted (e.g., 110 means 110% of CDI)
      dailyRate = cdiRate * (asset.rateValue / 100);
      projectedBalance = asset.investedAmount * Math.pow(1 + dailyRate, businessDays);
    } else {
      // IPCA_PLUS: V * (1 + I + T/100)^(D/252)
      // I = annual IPCA rate (decimal), T = fixed rate percentage
      dailyRate = ipcaRate + asset.rateValue / 100;
      projectedBalance = asset.investedAmount * Math.pow(1 + dailyRate, businessDays / 252);
    }

    projectedBalance = this.round2(projectedBalance);
    const grossReturn = this.round2(projectedBalance - asset.investedAmount);

    return {
      projectedBalance,
      grossReturn,
      dailyRate: this.round2(dailyRate * 10000) / 10000, // keep 4 decimals for rate
      businessDays,
    };
  }

  /**
   * Calculate new average price after an additional FII purchase.
   *
   * Formula: (Q1*P1 + Q2*P2) / (Q1+Q2)
   *
   * Validates: Requirement 3.2 (Property 4)
   */
  calculateAveragePrice(
    currentQty: number,
    currentAvg: number,
    newQty: number,
    newPrice: number
  ): number {
    const totalCost = currentQty * currentAvg + newQty * newPrice;
    const totalQty = currentQty + newQty;

    if (totalQty === 0) {
      return 0;
    }

    return this.round2(totalCost / totalQty);
  }

  /**
   * Calculate dividend projection for all FIIs.
   *
   * Formula: Σ(Qi × Di) for all FIIs
   * If Di (lastDividendPerShare) is null/unavailable, considers Di = 0.
   *
   * Validates: Requirements 6.1, 6.4
   */
  calculateDividendProjection(fiis: FIIWithQuote[]): DividendProjectionResult {
    const details = fiis.map((fii) => {
      const dividendPerShare = fii.lastDividendPerShare ?? 0;
      const projectedValue = this.round2(fii.shares * dividendPerShare);

      return {
        ticker: fii.ticker,
        shares: fii.shares,
        lastDividendPerShare: dividendPerShare,
        projectedValue,
      };
    });

    const totalProjected = this.round2(
      details.reduce((sum, d) => sum + d.projectedValue, 0)
    );

    return {
      totalProjected,
      details,
    };
  }

  /**
   * Calculate total patrimony.
   *
   * Formula: Σ(RF_j) + Σ(Qi × Ci)
   *   where RF_j = projected balance of each Renda Fixa asset
   *   Qi = shares of FII i, Ci = current price of FII i
   *
   * Validates: Requirement 8.1
   */
  calculatePatrimonyTotal(
    rendaFixa: RendaFixaAsset[],
    fiis: FIIWithQuote[],
    cdiRate: number,
    ipcaRate: number
  ): number {
    // Sum of projected Renda Fixa balances
    const rfTotal = rendaFixa.reduce((sum, asset) => {
      const projection = this.calculateRendaFixaProjection(asset, cdiRate, ipcaRate);
      return sum + projection.projectedBalance;
    }, 0);

    // Sum of FII market values (shares × current price)
    const fiiTotal = fiis.reduce((sum, fii) => {
      return sum + fii.shares * fii.currentPrice;
    }, 0);

    return this.round2(rfTotal + fiiTotal);
  }

  /**
   * Calculate allocation percentages.
   * Must always sum to 100%.
   * If total is 0, returns 0% for both.
   *
   * Validates: Requirements 8.2, 8.3
   */
  calculateAllocation(rfTotal: number, fiiTotal: number): AllocationResult {
    const total = rfTotal + fiiTotal;

    if (total === 0) {
      return {
        rendaFixaPercentage: 0,
        fiiPercentage: 0,
      };
    }

    const rendaFixaPercentage = this.round2((rfTotal / total) * 100);
    // Ensure they sum to exactly 100%
    const fiiPercentage = this.round2(100 - rendaFixaPercentage);

    return {
      rendaFixaPercentage,
      fiiPercentage,
    };
  }

  /**
   * Calculate FII variation percent.
   *
   * Formula: ((CA - PM) / PM) * 100
   *   where CA = current price, PM = average price
   *
   * Positive = appreciation (green), Negative = depreciation (red), Zero = neutral
   *
   * Validates: Requirements 8.4, 8.5, 8.6
   */
  calculateFIIVariation(averagePrice: number, currentPrice: number): number {
    if (averagePrice === 0) {
      return 0;
    }

    return this.round2(((currentPrice - averagePrice) / averagePrice) * 100);
  }

  /**
   * Detect if a quote is stale (>48h since last update).
   *
   * Validates: Requirement 4.4
   */
  isQuoteStale(lastUpdateDate: Date): boolean {
    const now = new Date();
    const elapsed = now.getTime() - lastUpdateDate.getTime();
    return elapsed > CalculationService.QUOTE_STALE_MS;
  }

  /**
   * Detect if dividend data is stale (>60 days since last payment).
   *
   * Validates: Requirement 5.5
   */
  isDividendStale(lastPaymentDate: Date): boolean {
    const now = new Date();
    const elapsed = now.getTime() - lastPaymentDate.getTime();
    return elapsed > CalculationService.DIVIDEND_STALE_MS;
  }
}
