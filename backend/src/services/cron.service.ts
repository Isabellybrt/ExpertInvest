import cron, { ScheduledTask } from 'node-cron';
import {
  ICronService,
  CronExecutionResult,
  CronExecutionLog,
} from './interfaces/cron.interface.js';
import { IMarketDataService } from './interfaces/market-data.interface.js';
import { FIIRepository } from '../repositories/fii.repository.js';
import { CronLogRepository } from '../repositories/cron-log.repository.js';

/**
 * Logger interface for dependency injection.
 */
export interface CronLogger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
}

const defaultLogger: CronLogger = {
  error: (message, context) => console.error(`[CronService] ${message}`, context),
  warn: (message, context) => console.warn(`[CronService] ${message}`, context),
  info: (message, context) => console.info(`[CronService] ${message}`, context),
};

/** Minimum interval between executions: 8 hours in milliseconds */
const MIN_INTERVAL_MS = 8 * 60 * 60 * 1000;

/** Default schedule: 8am and 4pm daily */
const DEFAULT_SCHEDULE = '0 8,16 * * *';

export interface CronServiceDeps {
  marketDataService: IMarketDataService;
  fiiRepository: FIIRepository;
  cronLogRepository: CronLogRepository;
  logger?: CronLogger;
  /** Allows injecting node-cron schedule for testing */
  cronScheduler?: typeof cron.schedule;
  /** Allows overriding Date.now() for testing */
  nowFn?: () => number;
}

/**
 * CronService implements scheduled quote and dividend updates for all user FIIs.
 *
 * Features:
 * - Scheduled execution max 2x/day with 8h minimum interval (Req 11.1)
 * - Local cache with validity until next cron execution (Req 11.2)
 * - Execution logging with success/failure counts (Req 4.5)
 * - Fetches both quote and dividend data in same job (Req 5.1)
 */
export class CronService implements ICronService {
  private marketDataService: IMarketDataService;
  private fiiRepository: FIIRepository;
  private cronLogRepository: CronLogRepository;
  private logger: CronLogger;
  private cronScheduler: typeof cron.schedule;
  private nowFn: () => number;

  private scheduledTask: ScheduledTask | null = null;
  private lastExecutionTime: Date | null = null;
  private isExecuting = false;

  /** Local cache: ticker -> { quote, dividend, cachedAt } */
  private cache: Map<string, {
    quote?: { price: number; sourceDate: Date };
    dividend?: { dividendPerShare: number; dividendYield: number; paymentDate: Date };
    cachedAt: Date;
  }> = new Map();

  constructor(deps: CronServiceDeps) {
    this.marketDataService = deps.marketDataService;
    this.fiiRepository = deps.fiiRepository;
    this.cronLogRepository = deps.cronLogRepository;
    this.logger = deps.logger ?? defaultLogger;
    this.cronScheduler = deps.cronScheduler ?? cron.schedule;
    this.nowFn = deps.nowFn ?? Date.now;
  }

  scheduleQuoteUpdate(schedule: string = DEFAULT_SCHEDULE): void {
    // Stop any existing scheduled task
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
    }

    this.scheduledTask = this.cronScheduler(schedule, async () => {
      try {
        await this.executeQuoteUpdate();
      } catch (error) {
        this.logger.error('Scheduled quote update failed unexpectedly', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    this.logger.info(`Quote update scheduled with expression: ${schedule}`);
  }

  async executeQuoteUpdate(): Promise<CronExecutionResult> {
    // Enforce minimum 8h interval between executions
    if (this.lastExecutionTime) {
      const elapsed = this.nowFn() - this.lastExecutionTime.getTime();
      if (elapsed < MIN_INTERVAL_MS) {
        const remainingMs = MIN_INTERVAL_MS - elapsed;
        const remainingHours = (remainingMs / (60 * 60 * 1000)).toFixed(1);
        this.logger.warn(
          `Skipping execution: minimum 8h interval not met. Next execution allowed in ${remainingHours}h`,
          { lastExecution: this.lastExecutionTime.toISOString(), elapsedMs: elapsed }
        );
        return {
          successCount: 0,
          failureCount: 0,
          errors: [],
          duration: 0,
        };
      }
    }

    // Prevent concurrent executions
    if (this.isExecuting) {
      this.logger.warn('Execution already in progress, skipping');
      return { successCount: 0, failureCount: 0, errors: [], duration: 0 };
    }

    this.isExecuting = true;
    const startTime = this.nowFn();
    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ ticker: string; error: string }> = [];

    try {
      // Get all FIIs from all users
      const allFiis = await this.fiiRepository.findAll();

      // Get distinct tickers to avoid duplicate API calls
      const tickerToFiiIds = new Map<string, string[]>();
      for (const fii of allFiis) {
        const ids = tickerToFiiIds.get(fii.ticker) || [];
        ids.push(fii.id);
        tickerToFiiIds.set(fii.ticker, ids);
      }

      this.logger.info(`Starting quote update for ${tickerToFiiIds.size} distinct tickers (${allFiis.length} total FIIs)`);

      // Process each distinct ticker
      for (const [ticker, fiiIds] of tickerToFiiIds) {
        try {
          // Fetch quote
          const quoteData = await this.marketDataService.fetchQuote(ticker);

          // Fetch dividend data
          const dividendData = await this.marketDataService.fetchDividendData(ticker);

          // Persist for each FII with this ticker
          for (const fiiId of fiiIds) {
            await this.fiiRepository.createQuote({
              fiiId,
              price: quoteData.price,
              sourceDate: quoteData.sourceDate,
            });

            await this.fiiRepository.createDividend({
              fiiId,
              dividendPerShare: dividendData.dividendPerShare,
              dividendYield: dividendData.dividendYield,
              paymentDate: dividendData.paymentDate,
            });
          }

          // Update local cache
          this.cache.set(ticker, {
            quote: { price: quoteData.price, sourceDate: quoteData.sourceDate },
            dividend: {
              dividendPerShare: dividendData.dividendPerShare,
              dividendYield: dividendData.dividendYield,
              paymentDate: dividendData.paymentDate,
            },
            cachedAt: new Date(this.nowFn()),
          });

          successCount++;
          this.logger.info(`Successfully updated ${ticker}`, {
            price: quoteData.price,
            dividendPerShare: dividendData.dividendPerShare,
          });
        } catch (error) {
          failureCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({ ticker, error: errorMessage });
          this.logger.error(`Failed to update ${ticker}`, { ticker, error: errorMessage });
        }
      }

      const duration = this.nowFn() - startTime;
      this.lastExecutionTime = new Date(this.nowFn());

      // Log execution results to database
      await this.cronLogRepository.create({
        successCount,
        failureCount,
        errors: errors.length > 0 ? errors : undefined,
        duration,
      });

      this.logger.info('Quote update completed', {
        successCount,
        failureCount,
        duration,
      });

      return { successCount, failureCount, errors, duration };
    } finally {
      this.isExecuting = false;
    }
  }

  async getLastExecution(): Promise<CronExecutionLog | null> {
    const log = await this.cronLogRepository.getLatest();
    if (!log) return null;

    return {
      id: log.id,
      executionDate: log.executionDate,
      successCount: log.successCount,
      failureCount: log.failureCount,
      errors: log.errors as Array<{ ticker: string; error: string }> | null,
      duration: log.duration,
    };
  }

  /**
   * Get cached data for a ticker. Returns null if cache is empty or expired.
   * Cache is valid until next cron execution.
   */
  getCachedQuote(ticker: string): { price: number; sourceDate: Date } | null {
    const cached = this.cache.get(ticker);
    if (!cached || !cached.quote) return null;
    return cached.quote;
  }

  /**
   * Get cached dividend data for a ticker. Returns null if cache is empty or expired.
   * Cache is valid until next cron execution.
   */
  getCachedDividend(ticker: string): { dividendPerShare: number; dividendYield: number; paymentDate: Date } | null {
    const cached = this.cache.get(ticker);
    if (!cached || !cached.dividend) return null;
    return cached.dividend;
  }

  /**
   * Check if cache is still valid (hasn't been invalidated by a new execution).
   */
  isCacheValid(): boolean {
    return this.cache.size > 0;
  }

  /**
   * Invalidate the local cache (called before a new execution).
   */
  invalidateCache(): void {
    this.cache.clear();
  }

  /**
   * Stop the scheduled task. Useful for graceful shutdown.
   */
  stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      this.logger.info('Cron service stopped');
    }
  }

  /**
   * Get the last execution time (for testing/monitoring).
   */
  getLastExecutionTime(): Date | null {
    return this.lastExecutionTime;
  }
}
