/**
 * Unit tests for useDashboardViewModel.
 * Tests data fetching, error handling, staleness detection, variation calculation,
 * 10-second timeout (Req 16.4), and Zustand cache integration.
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 4.4, 13.1, 16.2, 16.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useDashboardViewModel,
  isQuoteStale,
  calculateVariation,
  getVariationType,
  DASHBOARD_TIMEOUT_MS,
} from './useDashboardViewModel';
import { usePortfolioStore } from '../stores/portfolioStore';

// Mock the dashboardService module
vi.mock('../services/dashboardService', () => ({
  default: {
    getSummary: vi.fn(),
    getAllocation: vi.fn(),
  },
}));

import dashboardService from '../services/dashboardService';
import { ApiClientError } from '../services/api';

const mockedService = dashboardService as unknown as {
  getSummary: ReturnType<typeof vi.fn>;
  getAllocation: ReturnType<typeof vi.fn>;
};

describe('useDashboardViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear portfolio store cache before each test
    usePortfolioStore.getState().clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('data fetching', () => {
    it('should load summary and allocation on mount', async () => {
      mockedService.getSummary.mockResolvedValue({
        totalPatrimony: 150000.0,
        rendaFixaTotal: 100000.0,
        fiiTotal: 50000.0,
        rendaFixaPercentage: 66.67,
        fiiPercentage: 33.33,
        estimatedMonthlyDividends: 500.0,
      });
      mockedService.getAllocation.mockResolvedValue({
        rendaFixaPercentage: 66.67,
        fiiPercentage: 33.33,
        rendaFixaTotal: 100000.0,
        fiiTotal: 50000.0,
      });

      const { result } = renderHook(() => useDashboardViewModel());

      await waitFor(() => {
        expect(result.current.isSummaryLoaded).toBe(true);
      });

      expect(result.current.totalPatrimony).toBe(150000.0);
      expect(result.current.rendaFixaTotal).toBe(100000.0);
      expect(result.current.fiiTotal).toBe(50000.0);
      expect(result.current.estimatedMonthlyDividends).toBe(500.0);
      expect(result.current.allocationData).toEqual({
        rendaFixaPercentage: 66.67,
        fiiPercentage: 33.33,
        rendaFixaTotal: 100000.0,
        fiiTotal: 50000.0,
      });
      expect(result.current.isLoading).toBe(false);
    });

    it('should set error on summary fetch failure', async () => {
      mockedService.getSummary.mockRejectedValue(
        new ApiClientError('Erro de rede', 500)
      );
      mockedService.getAllocation.mockResolvedValue({
        rendaFixaPercentage: 0,
        fiiPercentage: 0,
        rendaFixaTotal: 0,
        fiiTotal: 0,
      });

      const { result } = renderHook(() => useDashboardViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Erro de rede');
      expect(result.current.isSummaryLoaded).toBe(false);
    });

    it('should set generic error for non-ApiClientError failures', async () => {
      mockedService.getSummary.mockRejectedValue(new Error('Network error'));
      mockedService.getAllocation.mockResolvedValue({
        rendaFixaPercentage: 0,
        fiiPercentage: 0,
        rendaFixaTotal: 0,
        fiiTotal: 0,
      });

      const { result } = renderHook(() => useDashboardViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should still load summary even if allocation fails', async () => {
      mockedService.getSummary.mockResolvedValue({
        totalPatrimony: 50000.0,
        rendaFixaTotal: 50000.0,
        fiiTotal: 0,
        rendaFixaPercentage: 100,
        fiiPercentage: 0,
        estimatedMonthlyDividends: 0,
      });
      mockedService.getAllocation.mockRejectedValue(new Error('Allocation error'));

      const { result } = renderHook(() => useDashboardViewModel());

      await waitFor(() => {
        expect(result.current.isSummaryLoaded).toBe(true);
      });

      expect(result.current.totalPatrimony).toBe(50000.0);
      expect(result.current.allocationData).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should show timeout error if loading exceeds 10 seconds (Req 16.4)', async () => {
      vi.useFakeTimers();

      // Summary never resolves within timeout window
      mockedService.getSummary.mockImplementation(
        () => new Promise(() => { /* never resolves */ })
      );
      mockedService.getAllocation.mockResolvedValue({
        rendaFixaPercentage: 60,
        fiiPercentage: 40,
        rendaFixaTotal: 60000,
        fiiTotal: 40000,
      });

      const { result } = renderHook(() => useDashboardViewModel());

      // At this point the hook is loading and waiting for summary
      expect(result.current.isLoading).toBe(true);

      // Advance time past the 10s timeout and flush microtasks
      await act(async () => {
        vi.advanceTimersByTime(DASHBOARD_TIMEOUT_MS + 500);
      });

      // The timeout should have triggered an error
      expect(result.current.error).toBe(
        'Os dados não puderam ser carregados. Tente novamente.'
      );
      expect(result.current.isSummaryLoaded).toBe(false);
      expect(result.current.isLoading).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('refreshData', () => {
    it('should reload data when refreshData is called', async () => {
      mockedService.getSummary.mockResolvedValue({
        totalPatrimony: 100000.0,
        rendaFixaTotal: 60000.0,
        fiiTotal: 40000.0,
        rendaFixaPercentage: 60.0,
        fiiPercentage: 40.0,
        estimatedMonthlyDividends: 300.0,
      });
      mockedService.getAllocation.mockResolvedValue({
        rendaFixaPercentage: 60.0,
        fiiPercentage: 40.0,
        rendaFixaTotal: 60000.0,
        fiiTotal: 40000.0,
      });

      const { result } = renderHook(() => useDashboardViewModel());

      await waitFor(() => {
        expect(result.current.isSummaryLoaded).toBe(true);
      });

      // Update mock values
      mockedService.getSummary.mockResolvedValue({
        totalPatrimony: 120000.0,
        rendaFixaTotal: 70000.0,
        fiiTotal: 50000.0,
        rendaFixaPercentage: 58.33,
        fiiPercentage: 41.67,
        estimatedMonthlyDividends: 400.0,
      });

      await act(async () => {
        await result.current.refreshData();
      });

      expect(result.current.totalPatrimony).toBe(120000.0);
      expect(result.current.rendaFixaTotal).toBe(70000.0);
      expect(result.current.fiiTotal).toBe(50000.0);
    });
  });
});

describe('isQuoteStale', () => {
  it('should return true when lastUpdateDate is null', () => {
    expect(isQuoteStale(null)).toBe(true);
  });

  it('should return true when lastUpdateDate is undefined', () => {
    expect(isQuoteStale(undefined)).toBe(true);
  });

  it('should return true when quote is older than 48 hours', () => {
    const threeeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    expect(isQuoteStale(threeeDaysAgo)).toBe(true);
  });

  it('should return false when quote is within 48 hours', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(isQuoteStale(oneHourAgo)).toBe(false);
  });

  it('should return false when quote is exactly at boundary (within threshold)', () => {
    // 47 hours ago — within threshold
    const almostStale = new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString();
    expect(isQuoteStale(almostStale)).toBe(false);
  });

  it('should return true when quote is just past 48h threshold', () => {
    const justStale = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
    expect(isQuoteStale(justStale)).toBe(true);
  });
});

describe('calculateVariation', () => {
  it('should calculate positive variation correctly', () => {
    // currentPrice=11, avgPrice=10 => ((11-10)/10)*100 = 10%
    expect(calculateVariation(11, 10)).toBeCloseTo(10, 2);
  });

  it('should calculate negative variation correctly', () => {
    // currentPrice=9, avgPrice=10 => ((9-10)/10)*100 = -10%
    expect(calculateVariation(9, 10)).toBeCloseTo(-10, 2);
  });

  it('should return 0 when prices are equal', () => {
    expect(calculateVariation(10, 10)).toBe(0);
  });

  it('should return 0 when averagePrice is 0 (avoid division by zero)', () => {
    expect(calculateVariation(10, 0)).toBe(0);
  });

  it('should handle large variations', () => {
    // currentPrice=200, avgPrice=100 => 100%
    expect(calculateVariation(200, 100)).toBeCloseTo(100, 2);
  });
});

describe('getVariationType', () => {
  it('should return "positive" for positive variation', () => {
    expect(getVariationType(5.5)).toBe('positive');
    expect(getVariationType(0.01)).toBe('positive');
  });

  it('should return "negative" for negative variation', () => {
    expect(getVariationType(-3.2)).toBe('negative');
    expect(getVariationType(-0.01)).toBe('negative');
  });

  it('should return "neutral" for zero variation', () => {
    expect(getVariationType(0)).toBe('neutral');
  });
});
