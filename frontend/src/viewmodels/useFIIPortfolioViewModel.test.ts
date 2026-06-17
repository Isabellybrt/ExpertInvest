/**
 * Unit tests for useFIIPortfolioViewModel.
 * Tests data fetching, error handling, retry, and timeout behavior.
 * Validates: Requirements 1.6, 5.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFIIPortfolioViewModel, PORTFOLIO_FETCH_TIMEOUT_MS } from './useFIIPortfolioViewModel';

// Mock the fiiPortfolioService module
vi.mock('../services/fiiPortfolioService', () => ({
  default: {
    getPortfolio: vi.fn(),
  },
}));

import fiiPortfolioService from '../services/fiiPortfolioService';

const mockedService = fiiPortfolioService as unknown as {
  getPortfolio: ReturnType<typeof vi.fn>;
};

describe('useFIIPortfolioViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('loadPortfolio', () => {
    it('should call API and set portfolioItems on success', async () => {
      const mockData = [
        { ticker: 'HGLG11', shares: 50, averagePrice: 160.0, lastMonthDividend: 8.5, projectedMonthlyYield: 8.5 },
        { ticker: 'MXRF11', shares: 100, averagePrice: 10.5, lastMonthDividend: 1.0, projectedMonthlyYield: 1.0 },
      ];
      mockedService.getPortfolio.mockResolvedValue(mockData);

      const { result } = renderHook(() => useFIIPortfolioViewModel());

      await act(async () => {
        await result.current.loadPortfolio();
      });

      expect(mockedService.getPortfolio).toHaveBeenCalledTimes(1);
      expect(result.current.portfolioItems).toEqual(mockData);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should set error state on API failure', async () => {
      mockedService.getPortfolio.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useFIIPortfolioViewModel());

      await act(async () => {
        await result.current.loadPortfolio();
      });

      expect(result.current.error).toBe('Não foi possível carregar os dados do portfólio. Tente novamente.');
      expect(result.current.portfolioItems).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('retry', () => {
    it('should re-fetch data successfully after a previous failure', async () => {
      mockedService.getPortfolio.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useFIIPortfolioViewModel());

      // First call fails
      await act(async () => {
        await result.current.loadPortfolio();
      });

      expect(result.current.error).toBe('Não foi possível carregar os dados do portfólio. Tente novamente.');

      // Set up success for retry
      const mockData = [
        { ticker: 'XPML11', shares: 30, averagePrice: 95.0, lastMonthDividend: 3.0, projectedMonthlyYield: 3.0 },
      ];
      mockedService.getPortfolio.mockResolvedValue(mockData);

      // Retry succeeds
      await act(async () => {
        await result.current.retry();
      });

      expect(mockedService.getPortfolio).toHaveBeenCalledTimes(2);
      expect(result.current.portfolioItems).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('timeout', () => {
    it('should set timeout error message when request exceeds 10 seconds', async () => {
      vi.useFakeTimers();

      // Service never resolves within timeout window
      mockedService.getPortfolio.mockImplementation(
        () => new Promise(() => { /* never resolves */ })
      );

      const { result } = renderHook(() => useFIIPortfolioViewModel());

      // Start the load (don't await — it won't resolve)
      let loadPromise: Promise<void>;
      act(() => {
        loadPromise = result.current.loadPortfolio();
      });

      expect(result.current.isLoading).toBe(true);

      // Advance time past the 10s timeout
      await act(async () => {
        vi.advanceTimersByTime(PORTFOLIO_FETCH_TIMEOUT_MS + 100);
      });

      // Wait for the promise to settle
      await act(async () => {
        await loadPromise;
      });

      expect(result.current.error).toBe('A requisição excedeu o tempo limite. Tente novamente.');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.portfolioItems).toEqual([]);
    });
  });
});
