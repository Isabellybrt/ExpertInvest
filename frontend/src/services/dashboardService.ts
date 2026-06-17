/**
 * Dashboard service layer — handles API communication for dashboard data.
 * Consumes /api/dashboard/summary and /api/dashboard/allocation endpoints.
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 4.4, 16.2
 */

import { apiClient } from './api';

export interface PortfolioSummary {
  totalPatrimony: number;
  rendaFixaTotal: number;
  fiiTotal: number;
  rendaFixaPercentage: number;
  fiiPercentage: number;
  estimatedMonthlyDividends: number;
}

export interface AllocationData {
  rendaFixaPercentage: number;
  fiiPercentage: number;
  rendaFixaTotal: number;
  fiiTotal: number;
}

export interface FIIPerformanceData {
  ticker: string;
  shares: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  acquisitionValue: number;
  variationPercent: number;
  lastDividend: number;
  dividendYield: number;
  lastUpdateDate: string;
  isStale: boolean;
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

const dashboardService = {
  async getSummary(): Promise<PortfolioSummary> {
    const response = await apiClient.get<PortfolioSummary>('/dashboard/summary');
    return response.data;
  },

  async getAllocation(): Promise<AllocationData> {
    const response = await apiClient.get<AllocationData>('/dashboard/allocation');
    return response.data;
  },

  /**
   * Fetch dividend history (last 12 months) + projection (next 6 months).
   * Validates: Requirements 10.1, 10.2, 10.5
   */
  async getDividends(): Promise<DividendPoint[]> {
    const response = await apiClient.get<DividendPoint[]>('/dashboard/dividends');
    return response.data;
  },
};

export default dashboardService;
