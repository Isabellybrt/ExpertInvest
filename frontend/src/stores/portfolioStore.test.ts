import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { usePortfolioStore, CACHE_TTL_MS } from './portfolioStore';
import type { PortfolioSummary, AllocationData, DividendPoint } from '../services/dashboardService';
import type { PatrimonyPoint } from '../views/dashboard/PatrimonyChart';

describe('portfolioStore', () => {
  beforeEach(() => {
    usePortfolioStore.getState().clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with empty cache', () => {
    const state = usePortfolioStore.getState();
    expect(state.summary).toBeNull();
    expect(state.allocation).toBeNull();
    expect(state.patrimonyHistory).toEqual([]);
    expect(state.dividends).toEqual([]);
    expect(state.lastSummaryFetch).toBeNull();
    expect(state.lastAllocationFetch).toBeNull();
    expect(state.lastPatrimonyFetch).toBeNull();
    expect(state.lastDividendsFetch).toBeNull();
  });

  it('should cache summary data with timestamp', () => {
    const summary: PortfolioSummary = {
      totalPatrimony: 150000,
      rendaFixaTotal: 100000,
      fiiTotal: 50000,
      rendaFixaPercentage: 66.67,
      fiiPercentage: 33.33,
      estimatedMonthlyDividends: 450,
    };

    const before = Date.now();
    usePortfolioStore.getState().setSummary(summary);
    const after = Date.now();

    const state = usePortfolioStore.getState();
    expect(state.summary).toEqual(summary);
    expect(state.lastSummaryFetch).toBeGreaterThanOrEqual(before);
    expect(state.lastSummaryFetch).toBeLessThanOrEqual(after);
  });

  it('should cache allocation data with timestamp', () => {
    const allocation: AllocationData = {
      rendaFixaPercentage: 60,
      fiiPercentage: 40,
      rendaFixaTotal: 90000,
      fiiTotal: 60000,
    };

    usePortfolioStore.getState().setAllocation(allocation);

    const state = usePortfolioStore.getState();
    expect(state.allocation).toEqual(allocation);
    expect(state.lastAllocationFetch).not.toBeNull();
  });

  it('should cache patrimony history with timestamp', () => {
    const history: PatrimonyPoint[] = [
      { month: '2024-01', value: 100000 },
      { month: '2024-02', value: 105000 },
      { month: '2024-03', value: 110000 },
    ];

    usePortfolioStore.getState().setPatrimonyHistory(history);

    const state = usePortfolioStore.getState();
    expect(state.patrimonyHistory).toEqual(history);
    expect(state.lastPatrimonyFetch).not.toBeNull();
  });

  it('should cache dividends with timestamp', () => {
    const dividends: DividendPoint[] = [
      { month: '2024-01', value: 300, isProjection: false },
      { month: '2024-02', value: 320, isProjection: false },
      { month: '2024-03', value: 350, isProjection: true },
    ];

    usePortfolioStore.getState().setDividends(dividends);

    const state = usePortfolioStore.getState();
    expect(state.dividends).toEqual(dividends);
    expect(state.lastDividendsFetch).not.toBeNull();
  });

  it('should clear all cached data', () => {
    const summary: PortfolioSummary = {
      totalPatrimony: 100000,
      rendaFixaTotal: 60000,
      fiiTotal: 40000,
      rendaFixaPercentage: 60,
      fiiPercentage: 40,
      estimatedMonthlyDividends: 200,
    };

    usePortfolioStore.getState().setSummary(summary);
    usePortfolioStore.getState().setAllocation({
      rendaFixaPercentage: 60,
      fiiPercentage: 40,
      rendaFixaTotal: 60000,
      fiiTotal: 40000,
    });

    usePortfolioStore.getState().clearCache();

    const state = usePortfolioStore.getState();
    expect(state.summary).toBeNull();
    expect(state.allocation).toBeNull();
    expect(state.patrimonyHistory).toEqual([]);
    expect(state.dividends).toEqual([]);
    expect(state.lastSummaryFetch).toBeNull();
    expect(state.lastAllocationFetch).toBeNull();
  });

  describe('isCacheFresh', () => {
    it('should return false when no data has been fetched', () => {
      const result = usePortfolioStore.getState().isCacheFresh('lastSummaryFetch', CACHE_TTL_MS);
      expect(result).toBe(false);
    });

    it('should return true when data was fetched within TTL', () => {
      usePortfolioStore.getState().setSummary({
        totalPatrimony: 100000,
        rendaFixaTotal: 60000,
        fiiTotal: 40000,
        rendaFixaPercentage: 60,
        fiiPercentage: 40,
        estimatedMonthlyDividends: 200,
      });

      const result = usePortfolioStore.getState().isCacheFresh('lastSummaryFetch', CACHE_TTL_MS);
      expect(result).toBe(true);
    });

    it('should return false when data is older than TTL', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      usePortfolioStore.getState().setSummary({
        totalPatrimony: 100000,
        rendaFixaTotal: 60000,
        fiiTotal: 40000,
        rendaFixaPercentage: 60,
        fiiPercentage: 40,
        estimatedMonthlyDividends: 200,
      });

      // Advance time past TTL
      vi.setSystemTime(now + CACHE_TTL_MS + 1000);

      const result = usePortfolioStore.getState().isCacheFresh('lastSummaryFetch', CACHE_TTL_MS);
      expect(result).toBe(false);
    });
  });
});
