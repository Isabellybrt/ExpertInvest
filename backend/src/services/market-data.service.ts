import {
  IMarketDataService,
  QuoteData,
  DividendData,
} from './interfaces/market-data.interface.js';

/**
 * Configuration for the MarketDataService retry and timeout behavior.
 */
export interface MarketDataServiceConfig {
  /** Timeout per request in milliseconds (default: 30000ms = 30s) */
  requestTimeoutMs: number;
  /** Maximum number of retry attempts per execution (default: 3) */
  maxRetries: number;
  /** Wait time between retries in milliseconds (default: 60000ms = 60s) */
  retryDelayMs: number;
}

const DEFAULT_CONFIG: MarketDataServiceConfig = {
  requestTimeoutMs: 30_000,
  maxRetries: 3,
  retryDelayMs: 60_000,
};

/**
 * Custom error class for market data fetch failures.
 */
export class MarketDataError extends Error {
  public readonly code: string;
  public readonly ticker: string;
  public readonly attempts: number;

  constructor(message: string, code: string, ticker: string, attempts: number) {
    super(message);
    this.name = 'MarketDataError';
    this.code = code;
    this.ticker = ticker;
    this.attempts = attempts;
  }
}

/**
 * Logger interface for dependency injection.
 */
export interface Logger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
}

const defaultLogger: Logger = {
  error: (message, context) => console.error(`[MarketDataService] ${message}`, context),
  warn: (message, context) => console.warn(`[MarketDataService] ${message}`, context),
  info: (message, context) => console.info(`[MarketDataService] ${message}`, context),
};

/**
 * Function type for the HTTP fetch implementation.
 */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Function type for the delay/sleep implementation.
 */
export type DelayFn = (ms: number) => Promise<void>;

const defaultDelay: DelayFn = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * MarketDataService fetches real-time quotes and dividend data from Yahoo Finance.
 * Uses the free Yahoo Finance chart API with Brazilian FII tickers (suffix .SA).
 *
 * Features:
 * - 30-second timeout per request (Req 4.3)
 * - Max 3 retry attempts per execution with 60s wait between retries (Req 11.3)
 * - On failure: maintains last valid data in cache, logs error (Req 4.3, 11.4)
 * - No API token required
 */
export class MarketDataService implements IMarketDataService {
  private config: MarketDataServiceConfig;
  private logger: Logger;
  private fetchFn: FetchFn;
  private delayFn: DelayFn;

  /** Cache of last valid quotes by ticker */
  private quoteCache: Map<string, QuoteData> = new Map();
  /** Cache of last valid dividend data by ticker */
  private dividendCache: Map<string, DividendData> = new Map();

  constructor(
    config?: Partial<MarketDataServiceConfig>,
    logger?: Logger,
    fetchFn?: FetchFn,
    delayFn?: DelayFn
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = logger ?? defaultLogger;
    this.fetchFn = fetchFn ?? globalThis.fetch.bind(globalThis);
    this.delayFn = delayFn ?? defaultDelay;
  }

  async fetchQuote(ticker: string): Promise<QuoteData> {
    const symbol = this.toYahooSymbol(ticker);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(url);
        const data = await response.json();
        const quote = this.parseQuoteResponse(data, ticker);

        this.quoteCache.set(ticker, quote);
        this.logger.info(`Quote fetched successfully for ${ticker}`, { attempt });
        return quote;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Failed to fetch quote for ${ticker} (attempt ${attempt}/${this.config.maxRetries})`, {
          ticker, attempt, error: lastError.message,
        });

        if (attempt < this.config.maxRetries) {
          await this.delayFn(this.config.retryDelayMs);
        }
      }
    }

    const cached = this.quoteCache.get(ticker);
    if (cached) {
      this.logger.warn(`Returning cached quote for ${ticker} after ${this.config.maxRetries} failed attempts`);
      return cached;
    }

    throw new MarketDataError(
      `Failed to fetch quote for ${ticker} after ${this.config.maxRetries} attempts`,
      'QUOTE_FETCH_FAILED',
      ticker,
      this.config.maxRetries
    );
  }

  async fetchDividendData(ticker: string): Promise<DividendData> {
    const symbol = this.toYahooSymbol(ticker);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1mo&range=6mo&events=div`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(url);
        const data = await response.json();
        const dividend = this.parseDividendResponse(data, ticker);

        this.dividendCache.set(ticker, dividend);
        this.logger.info(`Dividend data fetched successfully for ${ticker}`, { attempt });
        return dividend;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Failed to fetch dividend data for ${ticker} (attempt ${attempt}/${this.config.maxRetries})`, {
          ticker, attempt, error: lastError.message,
        });

        if (attempt < this.config.maxRetries) {
          await this.delayFn(this.config.retryDelayMs);
        }
      }
    }

    const cached = this.dividendCache.get(ticker);
    if (cached) {
      this.logger.warn(`Returning cached dividend data for ${ticker} after ${this.config.maxRetries} failed attempts`);
      return cached;
    }

    throw new MarketDataError(
      `Failed to fetch dividend data for ${ticker} after ${this.config.maxRetries} attempts`,
      'DIVIDEND_FETCH_FAILED',
      ticker,
      this.config.maxRetries
    );
  }

  /**
   * Convert a Brazilian ticker (e.g., MXRF11) to Yahoo Finance format (MXRF11.SA).
   */
  private toYahooSymbol(ticker: string): string {
    return `${ticker}.SA`;
  }

  /**
   * Makes an HTTP request with the configured timeout.
   */
  private async makeRequest(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const response = await this.fetchFn(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ExpertInvest/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.config.requestTimeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse Yahoo Finance chart response for quote data.
   * Response format: { chart: { result: [{ meta: { regularMarketPrice, regularMarketTime } }] } }
   */
  private parseQuoteResponse(data: unknown, ticker: string): QuoteData {
    const response = data as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            regularMarketTime?: number;
          };
        }>;
        error?: { description?: string };
      };
    };

    if (response.chart?.error) {
      throw new Error(`Yahoo Finance error for ${ticker}: ${response.chart.error.description}`);
    }

    const result = response.chart?.result?.[0];
    if (!result?.meta) {
      throw new Error(`No results found for ticker ${ticker}`);
    }

    const price = result.meta.regularMarketPrice;
    if (typeof price !== 'number' || isNaN(price)) {
      throw new Error(`Invalid price data for ticker ${ticker}`);
    }

    const sourceDate = result.meta.regularMarketTime
      ? new Date(result.meta.regularMarketTime * 1000)
      : new Date();

    return { price, sourceDate };
  }

  /**
   * Parse Yahoo Finance chart response for dividend data.
   * Response format: { chart: { result: [{ events: { dividends: { [timestamp]: { amount, date } } } }] } }
   */
  private parseDividendResponse(data: unknown, ticker: string): DividendData {
    const response = data as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number };
          events?: {
            dividends?: Record<string, { amount?: number; date?: number }>;
          };
        }>;
        error?: { description?: string };
      };
    };

    if (response.chart?.error) {
      throw new Error(`Yahoo Finance error for ${ticker}: ${response.chart.error.description}`);
    }

    const result = response.chart?.result?.[0];
    if (!result) {
      throw new Error(`No results found for dividend data ${ticker}`);
    }

    const dividends = result.events?.dividends;
    if (!dividends || Object.keys(dividends).length === 0) {
      throw new Error(`No dividend data available for ticker ${ticker}`);
    }

    // Get the most recent dividend (highest timestamp key)
    const sortedKeys = Object.keys(dividends).sort((a, b) => Number(b) - Number(a));
    const latestKey = sortedKeys[0];
    const latestDividend = dividends[latestKey];

    const dividendPerShare = latestDividend.amount ?? 0;
    const paymentDate = latestDividend.date
      ? new Date(latestDividend.date * 1000)
      : new Date();

    // Calculate approximate dividend yield using current price
    const currentPrice = result.meta?.regularMarketPrice ?? 0;
    const dividendYield = currentPrice > 0
      ? Math.round((dividendPerShare / currentPrice) * 12 * 100 * 100) / 100
      : 0;

    return {
      dividendPerShare,
      dividendYield,
      paymentDate,
    };
  }
}
