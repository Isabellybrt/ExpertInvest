import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MarketDataService,
  MarketDataError,
  MarketDataServiceConfig,
  Logger,
  FetchFn,
  DelayFn,
} from './market-data.service.js';
import { QuoteData, DividendData } from './interfaces/market-data.interface.js';

// --- Test helpers ---

function createMockLogger(): Logger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };
}

function createNoOpDelay(): DelayFn {
  return vi.fn().mockResolvedValue(undefined);
}

function createMockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => createMockResponse(body, ok, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

function validQuoteApiResponse(ticker = 'MXRF11', price = 10.5) {
  return {
    results: [
      {
        regularMarketPrice: price,
        regularMarketTime: '2024-01-15T18:00:00.000Z',
      },
    ],
  };
}

function validDividendApiResponse(ticker = 'MXRF11') {
  return {
    results: [
      {
        dividendsData: {
          cashDividends: [
            {
              rate: 0.08,
              paymentDate: '2024-01-10T00:00:00.000Z',
            },
            {
              rate: 0.09,
              paymentDate: '2024-02-10T00:00:00.000Z',
            },
          ],
          yieldLast12Months: {
            dividendYield: 10.5,
          },
        },
      },
    ],
  };
}

const testConfig: Partial<MarketDataServiceConfig> = {
  apiBaseUrl: 'https://test-api.example.com/api',
  apiToken: 'test-token',
  requestTimeoutMs: 30_000,
  maxRetries: 3,
  retryDelayMs: 100, // short for tests
};

// --- Tests ---

describe('MarketDataService', () => {
  let logger: Logger;
  let delayFn: DelayFn;

  beforeEach(() => {
    logger = createMockLogger();
    delayFn = createNoOpDelay();
  });

  describe('fetchQuote', () => {
    it('should return quote data on successful first attempt', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse(validQuoteApiResponse('MXRF11', 10.5))
      );

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);
      const result = await service.fetchQuote('MXRF11');

      expect(result.price).toBe(10.5);
      expect(result.sourceDate).toEqual(new Date('2024-01-15T18:00:00.000Z'));
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(delayFn).not.toHaveBeenCalled();
    });

    it('should include API token in the URL query params', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse(validQuoteApiResponse())
      );

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);
      await service.fetchQuote('HGLG11');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('token=test-token'),
        expect.any(Object)
      );
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const mockFetch: FetchFn = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse(validQuoteApiResponse('XPML11', 99.0)));

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);
      const result = await service.fetchQuote('XPML11');

      expect(result.price).toBe(99.0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(delayFn).toHaveBeenCalledTimes(1);
      expect(delayFn).toHaveBeenCalledWith(testConfig.retryDelayMs);
    });

    it('should retry up to maxRetries (3) times before failing', async () => {
      const mockFetch: FetchFn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);

      await expect(service.fetchQuote('FAIL11')).rejects.toThrow(MarketDataError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      // Wait is called between retries, not after the last one
      expect(delayFn).toHaveBeenCalledTimes(2);
    });

    it('should return cached quote when all retries fail and cache exists', async () => {
      const mockFetch: FetchFn = vi.fn()
        .mockResolvedValueOnce(createMockResponse(validQuoteApiResponse('MXRF11', 10.0)))
        .mockRejectedValue(new Error('API down'));

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);

      // First call succeeds and caches
      const first = await service.fetchQuote('MXRF11');
      expect(first.price).toBe(10.0);

      // Second call fails all retries but returns cached
      const second = await service.fetchQuote('MXRF11');
      expect(second.price).toBe(10.0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Returning cached quote'),
        expect.any(Object)
      );
    });

    it('should throw MarketDataError when all retries fail and no cache exists', async () => {
      const mockFetch: FetchFn = vi.fn().mockRejectedValue(new Error('Total failure'));

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);

      try {
        await service.fetchQuote('NOCACHE11');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MarketDataError);
        const mdError = error as MarketDataError;
        expect(mdError.code).toBe('QUOTE_FETCH_FAILED');
        expect(mdError.ticker).toBe('NOCACHE11');
        expect(mdError.attempts).toBe(3);
      }
    });

    it('should handle HTTP non-OK responses as errors', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse({ error: 'rate limited' }, false, 429)
      );

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);

      await expect(service.fetchQuote('RATE11')).rejects.toThrow(MarketDataError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle timeout (AbortError) as an error triggering retry', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      const mockFetch: FetchFn = vi.fn()
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(createMockResponse(validQuoteApiResponse('TIMEOUT11', 50.0)));

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);
      const result = await service.fetchQuote('TIMEOUT11');

      expect(result.price).toBe(50.0);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid response format gracefully', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse({ results: [] })
      );

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);

      await expect(service.fetchQuote('EMPTY11')).rejects.toThrow(MarketDataError);
    });

    it('should handle missing price field in response', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse({ results: [{ regularMarketPrice: null }] })
      );

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);

      await expect(service.fetchQuote('NOPRICE11')).rejects.toThrow(MarketDataError);
    });
  });

  describe('fetchDividendData', () => {
    it('should return dividend data on successful first attempt', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse(validDividendApiResponse())
      );

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);
      const result = await service.fetchDividendData('MXRF11');

      // Gets the last (most recent) dividend
      expect(result.dividendPerShare).toBe(0.09);
      expect(result.dividendYield).toBe(10.5);
      expect(result.paymentDate).toEqual(new Date('2024-02-10T00:00:00.000Z'));
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should include fundamental=true in the dividend URL', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse(validDividendApiResponse())
      );

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);
      await service.fetchDividendData('HGLG11');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('fundamental=true'),
        expect.any(Object)
      );
    });

    it('should retry on failure and succeed on third attempt', async () => {
      const mockFetch: FetchFn = vi.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce(createMockResponse(validDividendApiResponse()));

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);
      const result = await service.fetchDividendData('MXRF11');

      expect(result.dividendPerShare).toBe(0.09);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(delayFn).toHaveBeenCalledTimes(2);
    });

    it('should return cached dividend data when all retries fail and cache exists', async () => {
      const mockFetch: FetchFn = vi.fn()
        .mockResolvedValueOnce(createMockResponse(validDividendApiResponse()))
        .mockRejectedValue(new Error('API down'));

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);

      // First call succeeds and caches
      const first = await service.fetchDividendData('MXRF11');
      expect(first.dividendPerShare).toBe(0.09);

      // Second call fails all retries but returns cached
      const second = await service.fetchDividendData('MXRF11');
      expect(second.dividendPerShare).toBe(0.09);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Returning cached dividend data'),
        expect.any(Object)
      );
    });

    it('should throw MarketDataError when all retries fail and no cache exists', async () => {
      const mockFetch: FetchFn = vi.fn().mockRejectedValue(new Error('Total failure'));

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);

      try {
        await service.fetchDividendData('NOCACHE11');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MarketDataError);
        const mdError = error as MarketDataError;
        expect(mdError.code).toBe('DIVIDEND_FETCH_FAILED');
        expect(mdError.ticker).toBe('NOCACHE11');
        expect(mdError.attempts).toBe(3);
      }
    });

    it('should handle response with no dividendsData field', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse({ results: [{ symbol: 'MXRF11' }] })
      );

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);

      await expect(service.fetchDividendData('MXRF11')).rejects.toThrow(MarketDataError);
    });

    it('should handle response with empty cashDividends array', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse({
          results: [{ dividendsData: { cashDividends: [] } }],
        })
      );

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);

      await expect(service.fetchDividendData('MXRF11')).rejects.toThrow(MarketDataError);
    });
  });

  describe('configuration', () => {
    it('should use default config when none provided', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse(validQuoteApiResponse())
      );

      // Pass empty config but override fetch/logger/delay
      const service = new MarketDataService({}, logger, mockFetch, delayFn);
      await service.fetchQuote('MXRF11');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('brapi.dev'),
        expect.any(Object)
      );
    });

    it('should respect custom maxRetries config', async () => {
      const mockFetch: FetchFn = vi.fn().mockRejectedValue(new Error('fail'));

      const service = new MarketDataService(
        { ...testConfig, maxRetries: 1 },
        logger,
        mockFetch,
        delayFn
      );

      await expect(service.fetchQuote('TEST11')).rejects.toThrow(MarketDataError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // No delay for single attempt
      expect(delayFn).not.toHaveBeenCalled();
    });

    it('should pass abort signal to fetch for timeout enforcement', async () => {
      const mockFetch: FetchFn = vi.fn().mockImplementation((url, init) => {
        // Verify signal is provided
        expect(init?.signal).toBeDefined();
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve(createMockResponse(validQuoteApiResponse()));
      });

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);
      await service.fetchQuote('MXRF11');
    });
  });

  describe('logging', () => {
    it('should log info on successful fetch', async () => {
      const mockFetch: FetchFn = vi.fn().mockResolvedValue(
        createMockResponse(validQuoteApiResponse())
      );

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);
      await service.fetchQuote('MXRF11');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Quote fetched successfully'),
        expect.objectContaining({ attempt: 1 })
      );
    });

    it('should log error on each failed attempt', async () => {
      const mockFetch: FetchFn = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failure'))
        .mockResolvedValueOnce(createMockResponse(validQuoteApiResponse()));

      const service = new MarketDataService(testConfig, logger, mockFetch, delayFn);
      await service.fetchQuote('MXRF11');

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('attempt 1/3'),
        expect.objectContaining({ ticker: 'MXRF11', attempt: 1 })
      );
    });
  });
});
