/**
 * Market Data service interface.
 * Defines the contract for fetching real-time market data (quotes and dividends)
 * from external APIs for FIIs.
 *
 * Implements:
 * - 30-second timeout per request (Req 4.3)
 * - Max 3 retry attempts per execution with 60s wait between retries (Req 11.3)
 * - On failure: maintain last valid data, log error (Req 4.3, 11.4)
 */

export interface QuoteData {
  /** Current price of the asset */
  price: number;
  /** Date/time of the quote from the source */
  sourceDate: Date;
}

export interface DividendData {
  /** Dividend value per share in BRL */
  dividendPerShare: number;
  /** Dividend yield as a percentage (e.g., 0.85 = 0.85%) */
  dividendYield: number;
  /** Date of the last dividend payment */
  paymentDate: Date;
}

export interface IMarketDataService {
  /**
   * Fetch the current quote for a given FII ticker.
   * Implements 30s timeout and retry logic (max 3 attempts, 60s between retries).
   * On failure, returns the last valid quote if available.
   *
   * @param ticker - The FII ticker code (e.g., "MXRF11")
   * @returns Quote data with price and source date
   * @throws MarketDataError if all retries fail and no cached data exists
   */
  fetchQuote(ticker: string): Promise<QuoteData>;

  /**
   * Fetch dividend/provento data for a given FII ticker.
   * Implements 30s timeout and retry logic (max 3 attempts, 60s between retries).
   * On failure, returns the last valid dividend data if available.
   *
   * @param ticker - The FII ticker code (e.g., "MXRF11")
   * @returns Dividend data with per-share value, yield, and payment date
   * @throws MarketDataError if all retries fail and no cached data exists
   */
  fetchDividendData(ticker: string): Promise<DividendData>;
}
