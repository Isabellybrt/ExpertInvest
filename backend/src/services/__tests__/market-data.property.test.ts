import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  MarketDataService,
  MarketDataError,
  Logger,
  FetchFn,
  DelayFn,
} from '../market-data.service.js';

// --- Test helpers ---

function createMockLogger(): Logger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };
}

/**
 * Property 13: Limite de Retentativas na API Externa
 *
 * For any execução do Cron Job, se a API retornar erro, o sistema SHALL realizar
 * no máximo 3 tentativas por execução, com intervalo mínimo de 60 segundos entre
 * cada tentativa.
 *
 * **Validates: Requirements 11.3**
 */
describe('Property 13: Limite de Retentativas na API Externa', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it('for any error scenario, fetch is called at most 3 times (maxRetries)', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate arbitrary error types to simulate different API failure scenarios
        fc.oneof(
          fc.constant('network'),
          fc.constant('timeout'),
          fc.constant('http-error'),
          fc.constant('parse-error')
        ),
        // Generate an arbitrary ticker (4 uppercase letters + 2 digits)
        fc.stringMatching(/^[A-Z]{4}\d{2}$/),
        // Generate arbitrary maxRetries (1 to 3) — we validate the configured value of 3
        fc.constant(3),
        async (errorType, ticker, maxRetries) => {
          const fetchCallCount = { value: 0 };

          const mockFetch: FetchFn = vi.fn().mockImplementation(() => {
            fetchCallCount.value++;
            switch (errorType) {
              case 'network':
                return Promise.reject(new Error('Network error'));
              case 'timeout': {
                const err = new Error('The operation was aborted');
                err.name = 'AbortError';
                return Promise.reject(err);
              }
              case 'http-error':
                return Promise.resolve({
                  ok: false,
                  status: 500,
                  statusText: 'Internal Server Error',
                  json: () => Promise.resolve({}),
                  headers: new Headers(),
                  redirected: false,
                  type: 'basic',
                  url: '',
                  clone: () => ({}),
                  body: null,
                  bodyUsed: false,
                  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                  blob: () => Promise.resolve(new Blob()),
                  formData: () => Promise.resolve(new FormData()),
                  text: () => Promise.resolve(''),
                } as unknown as Response);
              case 'parse-error':
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  statusText: 'OK',
                  json: () => Promise.resolve({ invalid: 'data' }),
                  headers: new Headers(),
                  redirected: false,
                  type: 'basic',
                  url: '',
                  clone: () => ({}),
                  body: null,
                  bodyUsed: false,
                  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                  blob: () => Promise.resolve(new Blob()),
                  formData: () => Promise.resolve(new FormData()),
                  text: () => Promise.resolve(''),
                } as unknown as Response);
              default:
                return Promise.reject(new Error('Unknown error'));
            }
          });

          const delayFn: DelayFn = vi.fn().mockResolvedValue(undefined);

          const service = new MarketDataService(
            {
              apiBaseUrl: 'https://test-api.example.com/api',
              apiToken: 'test-token',
              requestTimeoutMs: 30_000,
              maxRetries,
              retryDelayMs: 60_000,
            },
            logger,
            mockFetch,
            delayFn
          );

          // The call should either throw or return cached data
          try {
            await service.fetchQuote(ticker);
          } catch (error) {
            // Expected: MarketDataError when all retries fail
          }

          // PROPERTY: fetch is called at most maxRetries (3) times
          expect(fetchCallCount.value).toBeLessThanOrEqual(maxRetries);
          expect(fetchCallCount.value).toBe(maxRetries);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('delay is called exactly (maxRetries - 1) times between retries', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate arbitrary error types
        fc.oneof(
          fc.constant('network'),
          fc.constant('timeout'),
          fc.constant('http-error'),
          fc.constant('parse-error')
        ),
        // Generate an arbitrary ticker
        fc.stringMatching(/^[A-Z]{4}\d{2}$/),
        async (errorType, ticker) => {
          const maxRetries = 3;

          const mockFetch: FetchFn = vi.fn().mockImplementation(() => {
            switch (errorType) {
              case 'network':
                return Promise.reject(new Error('Network error'));
              case 'timeout': {
                const err = new Error('The operation was aborted');
                err.name = 'AbortError';
                return Promise.reject(err);
              }
              case 'http-error':
                return Promise.resolve({
                  ok: false,
                  status: 429,
                  statusText: 'Too Many Requests',
                  json: () => Promise.resolve({}),
                  headers: new Headers(),
                  redirected: false,
                  type: 'basic',
                  url: '',
                  clone: () => ({}),
                  body: null,
                  bodyUsed: false,
                  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                  blob: () => Promise.resolve(new Blob()),
                  formData: () => Promise.resolve(new FormData()),
                  text: () => Promise.resolve(''),
                } as unknown as Response);
              case 'parse-error':
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  statusText: 'OK',
                  json: () => Promise.resolve({ results: [] }),
                  headers: new Headers(),
                  redirected: false,
                  type: 'basic',
                  url: '',
                  clone: () => ({}),
                  body: null,
                  bodyUsed: false,
                  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                  blob: () => Promise.resolve(new Blob()),
                  formData: () => Promise.resolve(new FormData()),
                  text: () => Promise.resolve(''),
                } as unknown as Response);
              default:
                return Promise.reject(new Error('Unknown error'));
            }
          });

          const delayFn: DelayFn = vi.fn().mockResolvedValue(undefined);

          const service = new MarketDataService(
            {
              apiBaseUrl: 'https://test-api.example.com/api',
              apiToken: 'test-token',
              requestTimeoutMs: 30_000,
              maxRetries,
              retryDelayMs: 60_000,
            },
            logger,
            mockFetch,
            delayFn
          );

          try {
            await service.fetchQuote(ticker);
          } catch (error) {
            // Expected
          }

          // PROPERTY: delay is called exactly (maxRetries - 1) times
          // because delay happens between attempts, not after the last one
          expect(delayFn).toHaveBeenCalledTimes(maxRetries - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each delay call receives at least 60000ms (60 seconds)', () => {
    fc.assert(
      fc.asyncProperty(
        // Generate arbitrary error types
        fc.oneof(
          fc.constant('network'),
          fc.constant('timeout'),
          fc.constant('http-error'),
          fc.constant('parse-error')
        ),
        // Generate an arbitrary ticker
        fc.stringMatching(/^[A-Z]{4}\d{2}$/),
        // Generate arbitrary retryDelayMs (must be >= 60000)
        fc.integer({ min: 60_000, max: 300_000 }),
        async (errorType, ticker, retryDelayMs) => {
          const maxRetries = 3;

          const mockFetch: FetchFn = vi.fn().mockImplementation(() => {
            switch (errorType) {
              case 'network':
                return Promise.reject(new Error('Network error'));
              case 'timeout': {
                const err = new Error('The operation was aborted');
                err.name = 'AbortError';
                return Promise.reject(err);
              }
              case 'http-error':
                return Promise.resolve({
                  ok: false,
                  status: 503,
                  statusText: 'Service Unavailable',
                  json: () => Promise.resolve({}),
                  headers: new Headers(),
                  redirected: false,
                  type: 'basic',
                  url: '',
                  clone: () => ({}),
                  body: null,
                  bodyUsed: false,
                  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                  blob: () => Promise.resolve(new Blob()),
                  formData: () => Promise.resolve(new FormData()),
                  text: () => Promise.resolve(''),
                } as unknown as Response);
              case 'parse-error':
                return Promise.resolve({
                  ok: true,
                  status: 200,
                  statusText: 'OK',
                  json: () => Promise.resolve(null),
                  headers: new Headers(),
                  redirected: false,
                  type: 'basic',
                  url: '',
                  clone: () => ({}),
                  body: null,
                  bodyUsed: false,
                  arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                  blob: () => Promise.resolve(new Blob()),
                  formData: () => Promise.resolve(new FormData()),
                  text: () => Promise.resolve(''),
                } as unknown as Response);
              default:
                return Promise.reject(new Error('Unknown error'));
            }
          });

          const delayFn: DelayFn = vi.fn().mockResolvedValue(undefined);

          const service = new MarketDataService(
            {
              apiBaseUrl: 'https://test-api.example.com/api',
              apiToken: 'test-token',
              requestTimeoutMs: 30_000,
              maxRetries,
              retryDelayMs,
            },
            logger,
            mockFetch,
            delayFn
          );

          try {
            await service.fetchQuote(ticker);
          } catch (error) {
            // Expected
          }

          // PROPERTY: each delay call must receive at least 60000ms
          const delayCalls = (delayFn as ReturnType<typeof vi.fn>).mock.calls;
          for (const call of delayCalls) {
            expect(call[0]).toBeGreaterThanOrEqual(60_000);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
