/**
 * Calculation service interface.
 * Defines the contract for all financial computations in the portfolio,
 * including projections, average price, dividends, patrimony, allocation,
 * and staleness detection.
 *
 * Validates: Requirements 6.1, 6.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

export interface RendaFixaAsset {
  id: string;
  investedAmount: number;
  rateType: 'CDI_PERCENTAGE' | 'IPCA_PLUS';
  rateValue: number;
  ipcaPlusRate?: number | null;
  maturityDate: Date;
  createdAt: Date;
}

export interface FIIWithQuote {
  id: string;
  ticker: string;
  shares: number;
  averagePrice: number;
  currentPrice: number;
  lastDividendPerShare: number | null;
  lastQuoteUpdate: Date | null;
  lastDividendPaymentDate: Date | null;
}

export interface ProjectionResult {
  projectedBalance: number;
  grossReturn: number;
  dailyRate: number;
  businessDays: number;
}

export interface DividendProjectionResult {
  totalProjected: number;
  details: DividendProjectionDetail[];
}

export interface DividendProjectionDetail {
  ticker: string;
  shares: number;
  lastDividendPerShare: number;
  projectedValue: number;
}

export interface AllocationResult {
  rendaFixaPercentage: number;
  fiiPercentage: number;
}

export interface ICalculationService {
  /**
   * Calculate projected balance for a Renda Fixa asset.
   * CDI: V * (1 + R * P/100)^D
   * IPCA+: V * (1 + I + T/100)^(D/252)
   * Uses last valid index value when CDI/IPCA unavailable.
   */
  calculateRendaFixaProjection(
    asset: RendaFixaAsset,
    cdiRate: number,
    ipcaRate: number
  ): ProjectionResult;

  /**
   * Calculate new average price after an additional purchase.
   * Formula: (Q1*P1 + Q2*P2) / (Q1+Q2)
   */
  calculateAveragePrice(
    currentQty: number,
    currentAvg: number,
    newQty: number,
    newPrice: number
  ): number;

  /**
   * Calculate dividend projection for all FIIs.
   * Formula: Σ(Qi × Di) for all FIIs.
   * If dividend data is unavailable, considers Di = 0.
   */
  calculateDividendProjection(fiis: FIIWithQuote[]): DividendProjectionResult;

  /**
   * Calculate total patrimony.
   * Formula: Σ(RF_j) + Σ(Qi × Ci)
   */
  calculatePatrimonyTotal(
    rendaFixa: RendaFixaAsset[],
    fiis: FIIWithQuote[],
    cdiRate: number,
    ipcaRate: number
  ): number;

  /**
   * Calculate allocation percentages (must sum to 100%).
   */
  calculateAllocation(rfTotal: number, fiiTotal: number): AllocationResult;

  /**
   * Calculate FII variation percent.
   * Formula: ((CA - PM) / PM) * 100
   */
  calculateFIIVariation(averagePrice: number, currentPrice: number): number;

  /**
   * Detect if a quote is stale (>48h since last update).
   */
  isQuoteStale(lastUpdateDate: Date): boolean;

  /**
   * Detect if dividend data is stale (>60 days since last payment).
   */
  isDividendStale(lastPaymentDate: Date): boolean;
}
