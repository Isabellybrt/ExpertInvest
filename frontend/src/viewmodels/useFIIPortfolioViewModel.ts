/**
 * FII Portfolio ViewModel hook following MVVM pattern.
 * Handles fetching and exposing the FII portfolio data for read-only display.
 * Uses AbortController with 10-second timeout for the portfolio fetch request.
 *
 * Validates: Requirements 1.1, 1.4, 1.6, 5.1, 5.3
 */

import { useState, useCallback, useRef } from 'react';
import fiiPortfolioService from '../services/fiiPortfolioService';
import type { FIIPortfolioItem } from '../services/fiiPortfolioService';

/** Timeout in milliseconds for the portfolio fetch request. */
export const PORTFOLIO_FETCH_TIMEOUT_MS = 10_000;

export interface UseFIIPortfolioViewModel {
  portfolioItems: FIIPortfolioItem[];
  isLoading: boolean;
  error: string | null;

  loadPortfolio: () => Promise<void>;
  retry: () => Promise<void>;
}

export function useFIIPortfolioViewModel(): UseFIIPortfolioViewModel {
  const [portfolioItems, setPortfolioItems] = useState<FIIPortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadPortfolio = useCallback(async () => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const dataPromise = fiiPortfolioService.getPortfolio();

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        }, PORTFOLIO_FETCH_TIMEOUT_MS);
      });

      const data = await Promise.race([dataPromise, timeoutPromise]);

      if (!controller.signal.aborted) {
        setPortfolioItems(data);
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setError('A requisição excedeu o tempo limite. Tente novamente.');
      } else {
        setError('Não foi possível carregar os dados do portfólio. Tente novamente.');
      }
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      setIsLoading(false);
    }
  }, []);

  const retry = useCallback(async () => {
    await loadPortfolio();
  }, [loadPortfolio]);

  return {
    portfolioItems,
    isLoading,
    error,
    loadPortfolio,
    retry,
  };
}

export type { FIIPortfolioItem };
