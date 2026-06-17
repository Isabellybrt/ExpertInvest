/**
 * Portfolio store using Zustand for caching dashboard data.
 * Caches summary, allocation, patrimony history and dividends
 * to minimize re-fetches on re-renders.
 *
 * Validates: Requirements 16.1, 16.2, 16.4
 */

import { create } from 'zustand';
import type { PortfolioSummary, AllocationData, DividendPoint } from '../services/dashboardService';
import type { PatrimonyPoint } from '../views/dashboard/PatrimonyChart';

interface PortfolioCache {
  summary: PortfolioSummary | null;
  allocation: AllocationData | null;
  patrimonyHistory: PatrimonyPoint[];
  dividends: DividendPoint[];
  /** Timestamp of last successful summary fetch */
  lastSummaryFetch: number | null;
  /** Timestamp of last successful allocation fetch */
  lastAllocationFetch: number | null;
  /** Timestamp of last successful patrimony history fetch */
  lastPatrimonyFetch: number | null;
  /** Timestamp of last successful dividends fetch */
  lastDividendsFetch: number | null;
}

interface PortfolioActions {
  setSummary: (summary: PortfolioSummary) => void;
  setAllocation: (allocation: AllocationData) => void;
  setPatrimonyHistory: (history: PatrimonyPoint[]) => void;
  setDividends: (dividends: DividendPoint[]) => void;
  /** Clear all cached data (e.g., on logout) */
  clearCache: () => void;
  /** Check if cached data is still fresh (less than maxAge ms old) */
  isCacheFresh: (key: keyof Pick<PortfolioCache, 'lastSummaryFetch' | 'lastAllocationFetch' | 'lastPatrimonyFetch' | 'lastDividendsFetch'>, maxAgeMs: number) => boolean;
}

export type PortfolioStore = PortfolioCache & PortfolioActions;

/** Default cache TTL: 5 minutes */
export const CACHE_TTL_MS = 5 * 60 * 1000;

const initialState: PortfolioCache = {
  summary: null,
  allocation: null,
  patrimonyHistory: [],
  dividends: [],
  lastSummaryFetch: null,
  lastAllocationFetch: null,
  lastPatrimonyFetch: null,
  lastDividendsFetch: null,
};

export const usePortfolioStore = create<PortfolioStore>()((set, get) => ({
  ...initialState,

  setSummary: (summary) =>
    set({
      summary,
      lastSummaryFetch: Date.now(),
    }),

  setAllocation: (allocation) =>
    set({
      allocation,
      lastAllocationFetch: Date.now(),
    }),

  setPatrimonyHistory: (history) =>
    set({
      patrimonyHistory: history,
      lastPatrimonyFetch: Date.now(),
    }),

  setDividends: (dividends) =>
    set({
      dividends,
      lastDividendsFetch: Date.now(),
    }),

  clearCache: () => set(initialState),

  isCacheFresh: (key, maxAgeMs) => {
    const timestamp = get()[key];
    if (timestamp === null) return false;
    return (Date.now() - timestamp) < maxAgeMs;
  },
}));

export type { PortfolioCache, PortfolioActions };
