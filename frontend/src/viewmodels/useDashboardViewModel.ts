/**
 * Dashboard ViewModel hook following MVVM pattern.
 * Fetches portfolio summary and allocation data, computes derived state.
 * Renders numeric values first (within 1 second) per Req 16.2.
 * Shows error with retry if loading exceeds 10 seconds per Req 16.4.
 * Uses Zustand portfolio store for caching to minimize re-fetches.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 4.4, 13.1, 16.2, 16.4
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import dashboardService from '../services/dashboardService';
import type { AllocationData } from '../services/dashboardService';
import { ApiClientError } from '../services/api';
import { usePortfolioStore, CACHE_TTL_MS } from '../stores/portfolioStore';

export interface FIISummaryItem {
  ticker: string;
  shares: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  acquisitionValue: number;
  variationPercent: number;
  lastUpdateDate: string | null;
  isStale: boolean;
}

export interface UseDashboardViewModel {
  // Summary state
  totalPatrimony: number;
  rendaFixaTotal: number;
  fiiTotal: number;
  estimatedMonthlyDividends: number;

  // Allocation state
  allocationData: AllocationData | null;

  // Loading and error
  isLoading: boolean;
  isSummaryLoaded: boolean;
  error: string | null;

  // Actions
  refreshData: () => Promise<void>;
}

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

/** Maximum time (ms) to wait for dashboard data before showing error. Req 16.4 */
export const DASHBOARD_TIMEOUT_MS = 10_000;

/**
 * Determines if a quote is stale (> 48h old).
 * Validates: Requirement 4.4
 */
export function isQuoteStale(lastUpdateDate: string | null | undefined): boolean {
  if (!lastUpdateDate) return true;
  const lastUpdate = new Date(lastUpdateDate).getTime();
  const now = Date.now();
  return (now - lastUpdate) > STALE_THRESHOLD_MS;
}

/**
 * Calculates FII variation percent: ((currentPrice - averagePrice) / averagePrice) * 100
 * Validates: Requirements 8.4, 8.5, 8.6
 */
export function calculateVariation(currentPrice: number, averagePrice: number): number {
  if (averagePrice <= 0) return 0;
  return ((currentPrice - averagePrice) / averagePrice) * 100;
}

/**
 * Determines the variation type for visual indicator.
 * Returns 'positive', 'negative', or 'neutral'.
 * Validates: Requirements 8.4, 8.5, 8.6, 13.1
 */
export function getVariationType(variationPercent: number): 'positive' | 'negative' | 'neutral' {
  if (variationPercent > 0) return 'positive';
  if (variationPercent < 0) return 'negative';
  return 'neutral';
}

/**
 * Wraps a promise with a timeout. Rejects if the promise doesn't settle
 * within the specified duration.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export function useDashboardViewModel(): UseDashboardViewModel {
  const [totalPatrimony, setTotalPatrimony] = useState(0);
  const [rendaFixaTotal, setRendaFixaTotal] = useState(0);
  const [fiiTotal, setFiiTotal] = useState(0);
  const [estimatedMonthlyDividends, setEstimatedMonthlyDividends] = useState(0);
  const [allocationData, setAllocationData] = useState<AllocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSummaryLoaded, setIsSummaryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchSummary = useCallback(async () => {
    // Access store directly (non-reactive) to avoid re-render loops
    const store = usePortfolioStore.getState();

    // Check cache first
    if (store.isCacheFresh('lastSummaryFetch', CACHE_TTL_MS) && store.summary) {
      const cached = store.summary;
      setTotalPatrimony(cached.totalPatrimony);
      setRendaFixaTotal(cached.rendaFixaTotal);
      setFiiTotal(cached.fiiTotal);
      setEstimatedMonthlyDividends(cached.estimatedMonthlyDividends);
      setIsSummaryLoaded(true);
      return;
    }

    const summary = await dashboardService.getSummary();
    if (!isMounted.current) return;

    // Cache in Zustand store
    usePortfolioStore.getState().setSummary(summary);

    setTotalPatrimony(summary.totalPatrimony);
    setRendaFixaTotal(summary.rendaFixaTotal);
    setFiiTotal(summary.fiiTotal);
    setEstimatedMonthlyDividends(summary.estimatedMonthlyDividends);
    setIsSummaryLoaded(true);
  }, []);

  const fetchAllocation = useCallback(async () => {
    // Access store directly (non-reactive) to avoid re-render loops
    const store = usePortfolioStore.getState();

    // Check cache first
    if (store.isCacheFresh('lastAllocationFetch', CACHE_TTL_MS) && store.allocation) {
      setAllocationData(store.allocation);
      return;
    }

    const allocation = await dashboardService.getAllocation();
    if (!isMounted.current) return;

    // Cache in Zustand store
    usePortfolioStore.getState().setAllocation(allocation);
    setAllocationData(allocation);
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsSummaryLoaded(false);

    // Invalidate cache on explicit refresh to ensure fresh data
    usePortfolioStore.getState().clearCache();

    try {
      // First, trigger quote/dividend update in background (best-effort, don't block dashboard)
      try {
        await fetch('/api/fiis/update-quotes');
      } catch {
        // Silently ignore — update is best-effort
      }

      // Wrap entire dashboard load in a 10-second timeout (Req 16.4)
      await withTimeout(
        (async () => {
          // Fetch summary first for fast numeric rendering (Req 16.2)
          await fetchSummary();
          // Then fetch allocation for chart (non-critical — failure doesn't block dashboard)
          try {
            await fetchAllocation();
          } catch (err) {
            // Allocation failure is non-critical, summary is already loaded
            console.error('[Dashboard] Failed to load allocation:', err);
          }
        })(),
        DASHBOARD_TIMEOUT_MS,
        'Os dados não puderam ser carregados. Tente novamente.'
      );
    } catch (err) {
      if (!isMounted.current) return;
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao carregar dados do dashboard. Tente novamente.');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [fetchSummary, fetchAllocation]);

  useEffect(() => {
    isMounted.current = true;
    refreshData();
    return () => {
      isMounted.current = false;
    };
  }, [refreshData]);

  return {
    totalPatrimony,
    rendaFixaTotal,
    fiiTotal,
    estimatedMonthlyDividends,
    allocationData,
    isLoading,
    isSummaryLoaded,
    error,
    refreshData,
  };
}
