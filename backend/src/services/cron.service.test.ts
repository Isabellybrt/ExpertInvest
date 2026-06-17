import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CronService, CronServiceDeps, CronLogger } from './cron.service.js';
import { IMarketDataService, QuoteData, DividendData } from './interfaces/market-data.interface.js';
import { FIIRepository } from '../repositories/fii.repository.js';
import { CronLogRepository } from '../repositories/cron-log.repository.js';

// --- Test Helpers ---

function createMockLogger(): CronLogger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };
}

function createMockMarketDataService(): IMarketDataService {
  return {
    fetchQuote: vi.fn().mockResolvedValue({
      price: 10.5,
      sourceDate: new Date('2024-01-15T18:00:00Z'),
    } as QuoteData),
    fetchDividendData: vi.fn().mockResolvedValue({
      dividendPerShare: 0.09,
      dividendYield: 10.5,
      paymentDate: new Date('2024-02-10T00:00:00Z'),
    } as DividendData),
  };
}

function createMockFiiRepository(): Partial<FIIRepository> & {
  findAll: ReturnType<typeof vi.fn>;
  createQuote: ReturnType<typeof vi.fn>;
  createDividend: ReturnType<typeof vi.fn>;
} {
  return {
    findAll: vi.fn().mockResolvedValue([
      { id: 'fii-1', ticker: 'MXRF11', userId: 'user-1', shares: 100, averagePrice: 10.0 },
      { id: 'fii-2', ticker: 'HGLG11', userId: 'user-1', shares: 50, averagePrice: 160.0 },
      { id: 'fii-3', ticker: 'MXRF11', userId: 'user-2', shares: 200, averagePrice: 10.5 },
    ]),
    createQuote: vi.fn().mockResolvedValue({ id: 'quote-1' }),
    createDividend: vi.fn().mockResolvedValue({ id: 'dividend-1' }),
  };
}

function createMockCronLogRepository(): Partial<CronLogRepository> & {
  create: ReturnType<typeof vi.fn>;
  getLatest: ReturnType<typeof vi.fn>;
} {
  return {
    create: vi.fn().mockResolvedValue({ id: 'log-1' }),
    getLatest: vi.fn().mockResolvedValue(null),
  };
}

function createMockCronScheduler() {
  const mockTask = {
    stop: vi.fn(),
    start: vi.fn(),
  };
  const scheduler = vi.fn().mockReturnValue(mockTask);
  return { scheduler, mockTask };
}

function createDeps(overrides?: Partial<CronServiceDeps>): CronServiceDeps {
  const { scheduler } = createMockCronScheduler();
  return {
    marketDataService: createMockMarketDataService(),
    fiiRepository: createMockFiiRepository() as unknown as FIIRepository,
    cronLogRepository: createMockCronLogRepository() as unknown as CronLogRepository,
    logger: createMockLogger(),
    cronScheduler: scheduler,
    nowFn: () => new Date('2024-03-15T10:00:00Z').getTime(),
    ...overrides,
  };
}

// --- Tests ---

describe('CronService', () => {
  describe('scheduleQuoteUpdate', () => {
    it('should schedule a cron job with the given expression', () => {
      const { scheduler } = createMockCronScheduler();
      const deps = createDeps({ cronScheduler: scheduler });
      const service = new CronService(deps);

      service.scheduleQuoteUpdate('0 8,16 * * *');

      expect(scheduler).toHaveBeenCalledWith('0 8,16 * * *', expect.any(Function));
    });

    it('should stop existing task before scheduling a new one', () => {
      const { scheduler, mockTask } = createMockCronScheduler();
      const deps = createDeps({ cronScheduler: scheduler });
      const service = new CronService(deps);

      service.scheduleQuoteUpdate('0 8 * * *');
      service.scheduleQuoteUpdate('0 16 * * *');

      expect(mockTask.stop).toHaveBeenCalledTimes(1);
      expect(scheduler).toHaveBeenCalledTimes(2);
    });

    it('should log scheduling info', () => {
      const logger = createMockLogger();
      const deps = createDeps({ logger });
      const service = new CronService(deps);

      service.scheduleQuoteUpdate('0 8,16 * * *');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Quote update scheduled')
      );
    });
  });

  describe('executeQuoteUpdate', () => {
    it('should fetch quotes and dividends for all distinct tickers', async () => {
      const marketDataService = createMockMarketDataService();
      const fiiRepo = createMockFiiRepository();
      const deps = createDeps({
        marketDataService,
        fiiRepository: fiiRepo as unknown as FIIRepository,
      });
      const service = new CronService(deps);

      const result = await service.executeQuoteUpdate();

      // 2 distinct tickers: MXRF11 and HGLG11
      expect(marketDataService.fetchQuote).toHaveBeenCalledTimes(2);
      expect(marketDataService.fetchQuote).toHaveBeenCalledWith('MXRF11');
      expect(marketDataService.fetchQuote).toHaveBeenCalledWith('HGLG11');
      expect(marketDataService.fetchDividendData).toHaveBeenCalledTimes(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should persist quote and dividend for each FII with the same ticker', async () => {
      const fiiRepo = createMockFiiRepository();
      const deps = createDeps({
        fiiRepository: fiiRepo as unknown as FIIRepository,
      });
      const service = new CronService(deps);

      await service.executeQuoteUpdate();

      // MXRF11 has 2 FIIs (fii-1, fii-3), HGLG11 has 1 (fii-2) = 3 quotes + 3 dividends
      expect(fiiRepo.createQuote).toHaveBeenCalledTimes(3);
      expect(fiiRepo.createDividend).toHaveBeenCalledTimes(3);

      // Verify quote persistence data
      expect(fiiRepo.createQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          fiiId: 'fii-1',
          price: 10.5,
          sourceDate: new Date('2024-01-15T18:00:00Z'),
        })
      );
    });

    it('should enforce minimum 8h interval between executions', async () => {
      let currentTime = new Date('2024-03-15T10:00:00Z').getTime();
      const deps = createDeps({ nowFn: () => currentTime });
      const service = new CronService(deps);

      // First execution succeeds
      const first = await service.executeQuoteUpdate();
      expect(first.successCount).toBe(2);

      // Advance only 4 hours (less than 8h minimum)
      currentTime = new Date('2024-03-15T14:00:00Z').getTime();

      const second = await service.executeQuoteUpdate();
      expect(second.successCount).toBe(0);
      expect(second.failureCount).toBe(0);
      expect(second.duration).toBe(0);
    });

    it('should allow execution after 8h interval has passed', async () => {
      let currentTime = new Date('2024-03-15T08:00:00Z').getTime();
      const deps = createDeps({ nowFn: () => currentTime });
      const service = new CronService(deps);

      // First execution
      await service.executeQuoteUpdate();

      // Advance 9 hours (more than 8h minimum)
      currentTime = new Date('2024-03-15T17:00:00Z').getTime();

      const second = await service.executeQuoteUpdate();
      expect(second.successCount).toBe(2);
    });

    it('should log execution results to CronLog', async () => {
      const cronLogRepo = createMockCronLogRepository();
      const deps = createDeps({
        cronLogRepository: cronLogRepo as unknown as CronLogRepository,
      });
      const service = new CronService(deps);

      await service.executeQuoteUpdate();

      expect(cronLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          successCount: 2,
          failureCount: 0,
          duration: expect.any(Number),
        })
      );
    });

    it('should handle partial failures gracefully', async () => {
      const marketDataService = createMockMarketDataService();
      (marketDataService.fetchQuote as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ price: 10.5, sourceDate: new Date() })
        .mockRejectedValueOnce(new Error('API timeout for HGLG11'));

      const deps = createDeps({ marketDataService });
      const service = new CronService(deps);

      const result = await service.executeQuoteUpdate();

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ticker).toBe('HGLG11');
      expect(result.errors[0].error).toContain('API timeout');
    });

    it('should count duration in milliseconds', async () => {
      let callCount = 0;
      const startTime = new Date('2024-03-15T10:00:00Z').getTime();
      const deps = createDeps({
        nowFn: () => {
          callCount++;
          // Simulate 500ms elapsed after start
          if (callCount <= 1) return startTime;
          return startTime + 500;
        },
      });
      const service = new CronService(deps);

      const result = await service.executeQuoteUpdate();

      expect(result.duration).toBe(500);
    });

    it('should prevent concurrent executions', async () => {
      const marketDataService = createMockMarketDataService();
      // Make fetchQuote slow
      (marketDataService.fetchQuote as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ price: 10, sourceDate: new Date() }), 50))
      );

      const deps = createDeps({ marketDataService });
      const service = new CronService(deps);

      // Start two concurrent executions
      const [first, second] = await Promise.all([
        service.executeQuoteUpdate(),
        service.executeQuoteUpdate(),
      ]);

      // One should have been skipped
      const totalSuccess = first.successCount + second.successCount;
      expect(totalSuccess).toBe(2); // Only one execution actually ran
    });

    it('should handle empty FII list gracefully', async () => {
      const fiiRepo = createMockFiiRepository();
      fiiRepo.findAll.mockResolvedValue([]);
      const deps = createDeps({
        fiiRepository: fiiRepo as unknown as FIIRepository,
      });
      const service = new CronService(deps);

      const result = await service.executeQuoteUpdate();

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should log errors with ticker and error message for failed FIIs', async () => {
      const cronLogRepo = createMockCronLogRepository();
      const marketDataService = createMockMarketDataService();
      (marketDataService.fetchQuote as ReturnType<typeof vi.fn>)
        .mockRejectedValue(new Error('Connection refused'));

      const deps = createDeps({
        marketDataService,
        cronLogRepository: cronLogRepo as unknown as CronLogRepository,
      });
      const service = new CronService(deps);

      await service.executeQuoteUpdate();

      expect(cronLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          failureCount: 2,
          errors: expect.arrayContaining([
            expect.objectContaining({ ticker: 'MXRF11', error: expect.stringContaining('Connection refused') }),
          ]),
        })
      );
    });
  });

  describe('getLastExecution', () => {
    it('should return null when no executions have been logged', async () => {
      const cronLogRepo = createMockCronLogRepository();
      cronLogRepo.getLatest.mockResolvedValue(null);
      const deps = createDeps({
        cronLogRepository: cronLogRepo as unknown as CronLogRepository,
      });
      const service = new CronService(deps);

      const result = await service.getLastExecution();

      expect(result).toBeNull();
    });

    it('should return the latest execution log', async () => {
      const logEntry = {
        id: 'log-123',
        executionDate: new Date('2024-03-15T08:00:00Z'),
        successCount: 5,
        failureCount: 1,
        errors: [{ ticker: 'FAIL11', error: 'timeout' }],
        duration: 3500,
      };
      const cronLogRepo = createMockCronLogRepository();
      cronLogRepo.getLatest.mockResolvedValue(logEntry);
      const deps = createDeps({
        cronLogRepository: cronLogRepo as unknown as CronLogRepository,
      });
      const service = new CronService(deps);

      const result = await service.getLastExecution();

      expect(result).toEqual({
        id: 'log-123',
        executionDate: new Date('2024-03-15T08:00:00Z'),
        successCount: 5,
        failureCount: 1,
        errors: [{ ticker: 'FAIL11', error: 'timeout' }],
        duration: 3500,
      });
    });
  });

  describe('cache management', () => {
    it('should cache quote and dividend data after successful execution', async () => {
      const deps = createDeps();
      const service = new CronService(deps);

      await service.executeQuoteUpdate();

      const cachedQuote = service.getCachedQuote('MXRF11');
      expect(cachedQuote).not.toBeNull();
      expect(cachedQuote!.price).toBe(10.5);

      const cachedDividend = service.getCachedDividend('MXRF11');
      expect(cachedDividend).not.toBeNull();
      expect(cachedDividend!.dividendPerShare).toBe(0.09);
    });

    it('should return null for uncached ticker', () => {
      const deps = createDeps();
      const service = new CronService(deps);

      expect(service.getCachedQuote('UNKNOWN11')).toBeNull();
      expect(service.getCachedDividend('UNKNOWN11')).toBeNull();
    });

    it('should report cache as valid after execution', async () => {
      const deps = createDeps();
      const service = new CronService(deps);

      expect(service.isCacheValid()).toBe(false);

      await service.executeQuoteUpdate();

      expect(service.isCacheValid()).toBe(true);
    });

    it('should invalidate cache when invalidateCache is called', async () => {
      const deps = createDeps();
      const service = new CronService(deps);

      await service.executeQuoteUpdate();
      expect(service.isCacheValid()).toBe(true);

      service.invalidateCache();
      expect(service.isCacheValid()).toBe(false);
      expect(service.getCachedQuote('MXRF11')).toBeNull();
    });

    it('should not cache data for failed tickers', async () => {
      const marketDataService = createMockMarketDataService();
      (marketDataService.fetchQuote as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ price: 10.5, sourceDate: new Date() })
        .mockRejectedValueOnce(new Error('Failed'));

      const deps = createDeps({ marketDataService });
      const service = new CronService(deps);

      await service.executeQuoteUpdate();

      // MXRF11 succeeded (called first due to Map ordering)
      expect(service.getCachedQuote('MXRF11')).not.toBeNull();
      // HGLG11 failed
      expect(service.getCachedQuote('HGLG11')).toBeNull();
    });
  });

  describe('stop', () => {
    it('should stop the scheduled task', () => {
      const { scheduler, mockTask } = createMockCronScheduler();
      const deps = createDeps({ cronScheduler: scheduler });
      const service = new CronService(deps);

      service.scheduleQuoteUpdate('0 8,16 * * *');
      service.stop();

      expect(mockTask.stop).toHaveBeenCalled();
    });

    it('should not throw if no task is scheduled', () => {
      const deps = createDeps();
      const service = new CronService(deps);

      expect(() => service.stop()).not.toThrow();
    });
  });
});
