/**
 * FII Portfolio service layer — handles API communication for the FII portfolio table.
 * Uses the shared apiClient for authenticated requests.
 */

import { apiClient } from './api';

export interface FIIPortfolioItem {
  ticker: string;
  shares: number;
  averagePrice: number;
  lastMonthDividend: number;
  projectedMonthlyYield: number;
}

const fiiPortfolioService = {
  async getPortfolio(): Promise<FIIPortfolioItem[]> {
    const response = await apiClient.get<FIIPortfolioItem[]>('/fiis/portfolio');
    return response.data;
  },
};

export default fiiPortfolioService;
