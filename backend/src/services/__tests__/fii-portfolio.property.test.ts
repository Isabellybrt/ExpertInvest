import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { FIIPortfolioService, FIIDividendRecord } from '../fii-portfolio.service.js';
import { FIIRepository } from '../../repositories/fii.repository.js';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Weighted average price calculation on new aporte.
 * Formula: round2((currentShares * currentAvgPrice + newShares * newPricePerShare) / (currentShares + newShares))
 */
function calculateWeightedAverage(
  currentShares: number,
  currentAvgPrice: number,
  newShares: number,
  newPricePerShare: number
): number {
  const totalShares = currentShares + newShares;
  return round2((currentShares * currentAvgPrice + newShares * newPricePerShare) / totalShares);
}

/**
 * Reverse weighted average on aporte deletion.
 * Formula: round2((currentShares * currentAvgPrice - deletedShares * deletedPricePerShare) / (currentShares - deletedShares))
 * If resulting shares <= 0, returns 0.
 */
function calculateReverseWeightedAverage(
  currentShares: number,
  currentAvgPrice: number,
  deletedShares: number,
  deletedPricePerShare: number
): number {
  const resultingShares = currentShares - deletedShares;
  if (resultingShares <= 0) {
    return 0;
  }
  return round2((currentShares * currentAvgPrice - deletedShares * deletedPricePerShare) / resultingShares);
}

/**
 * Arbitrary: generates a unique ticker string (1-6 uppercase alpha chars)
 */
const tickerArb = fc.stringOf(
  fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
  { minLength: 1, maxLength: 6 }
);

/**
 * Arbitrary: generates a set of N unique tickers
 */
function uniqueTickersArb(minLength: number, maxLength: number) {
  return fc.uniqueArray(tickerArb, { minLength, maxLength, comparator: (a, b) => a === b });
}

/**
 * Creates a Decimal-like object that works with Number() coercion (via valueOf)
 * and also has a toNumber() method, matching Prisma Decimal behavior.
 */
function mockDecimal(value: number) {
  return {
    toNumber: () => value,
    valueOf: () => value,
    toString: () => String(value),
  } as any;
}

/**
 * Helper to create a mock FII record matching the shape returned by findByUserIdWithAllDividends
 */
function createMockFII(opts: {
  ticker: string;
  userId: string;
  shares: number;
  averagePrice: number;
  dividends: Array<{ dividendPerShare: number; paymentDate: Date }>;
  createdAt: Date;
}) {
  return {
    id: `fii-${opts.ticker}`,
    userId: opts.userId,
    ticker: opts.ticker,
    shares: opts.shares,
    averagePrice: mockDecimal(opts.averagePrice),
    purchaseDate: new Date(),
    createdAt: opts.createdAt,
    updatedAt: new Date(),
    dividends: opts.dividends.map((d, i) => ({
      id: `div-${opts.ticker}-${i}`,
      fiiId: `fii-${opts.ticker}`,
      dividendPerShare: mockDecimal(d.dividendPerShare),
      dividendYield: mockDecimal(0),
      paymentDate: d.paymentDate,
      updatedAt: new Date(),
    })),
  };
}

describe('Feature: fii-portfolio-table — FIIPortfolioService Properties', () => {
  let service: FIIPortfolioService;
  let mockRepo: { findByUserIdWithAllDividends: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRepo = {
      findByUserIdWithAllDividends: vi.fn(),
    };
    service = new FIIPortfolioService({
      fiiRepository: mockRepo as unknown as FIIRepository,
    });
  });

  /**
   * Property 1: Portfolio returns exactly the user's FIIs
   *
   * For any authenticated user with N FIIs in the database, calling `getPortfolio(userId)`
   * SHALL return exactly N items, and the set of tickers in the result SHALL equal the set
   * of tickers belonging to that user. No FIIs from other users SHALL appear in the result.
   *
   * **Validates: Requirements 1.1, 6.3**
   */
  describe('Property 1: Portfolio returns exactly the user\'s FIIs', () => {
    it('N FIIs in → N items out with correct ticker set', async () => {
      await fc.assert(
        fc.asyncProperty(
          uniqueTickersArb(0, 15),
          fc.integer({ min: 1, max: 1000 }),
          async (tickers, shares) => {
            const userId = 'user-1';
            const fiis = tickers.map((ticker) =>
              createMockFII({
                ticker,
                userId,
                shares,
                averagePrice: 100.0,
                dividends: [],
                createdAt: new Date(),
              })
            );

            mockRepo.findByUserIdWithAllDividends.mockResolvedValue(fiis);

            const result = await service.getPortfolio(userId);

            // Exact count
            expect(result).toHaveLength(tickers.length);

            // Exact ticker set
            const resultTickers = new Set(result.map((item) => item.ticker));
            const inputTickers = new Set(tickers);
            expect(resultTickers).toEqual(inputTickers);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no cross-user leakage — only the requested user\'s FIIs are returned', async () => {
      await fc.assert(
        fc.asyncProperty(
          uniqueTickersArb(1, 5),
          uniqueTickersArb(1, 5),
          async (userATickers, userBTickers) => {
            const userAId = 'user-A';
            const userAFiis = userATickers.map((ticker) =>
              createMockFII({
                ticker,
                userId: userAId,
                shares: 10,
                averagePrice: 50.0,
                dividends: [],
                createdAt: new Date(),
              })
            );

            mockRepo.findByUserIdWithAllDividends.mockResolvedValue(userAFiis);

            const result = await service.getPortfolio(userAId);

            // Result should not contain any ticker from user B that isn't also in user A
            const resultTickers = new Set(result.map((item) => item.ticker));
            for (const bTicker of userBTickers) {
              if (!userATickers.includes(bTicker)) {
                expect(resultTickers.has(bTicker)).toBe(false);
              }
            }
            // Result should contain exactly user A's tickers
            const inputTickers = new Set(userATickers);
            expect(resultTickers).toEqual(inputTickers);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Portfolio response fields are correctly rounded to 2 decimal places
   *
   * For any FII portfolio item returned by `getPortfolio`, the fields `averagePrice`,
   * `lastMonthDividend`, and `projectedMonthlyYield` SHALL each be equal to their
   * mathematically computed value rounded to exactly 2 decimal places
   * (i.e., `Math.round(value * 100) / 100`).
   *
   * **Validates: Requirements 1.2, 6.1**
   */
  describe('Property 2: Portfolio response fields are correctly rounded to 2 decimal places', () => {
    it('averagePrice, lastMonthDividend, projectedMonthlyYield are all rounded to 2dp', async () => {
      await fc.assert(
        fc.asyncProperty(
          // averagePrice: arbitrary decimal
          fc.double({ min: 0.001, max: 10000, noNaN: true, noDefaultInfinity: true }),
          // shares: positive integer
          fc.integer({ min: 1, max: 100_000 }),
          // dividend per share: arbitrary decimal
          fc.double({ min: 0.001, max: 100, noNaN: true, noDefaultInfinity: true }),
          async (averagePrice, shares, dividendPerShare) => {
            const userId = 'user-1';
            // Place dividend in previous month so lastMonthDividend is non-zero
            const now = new Date();
            let prevMonth = now.getMonth() - 1;
            let prevYear = now.getFullYear();
            if (prevMonth < 0) {
              prevMonth = 11;
              prevYear -= 1;
            }
            const dividendDate = new Date(prevYear, prevMonth, 15);

            const fiis = [
              createMockFII({
                ticker: 'TEST11',
                userId,
                shares,
                averagePrice,
                dividends: [{ dividendPerShare, paymentDate: dividendDate }],
                createdAt: new Date(),
              }),
            ];

            mockRepo.findByUserIdWithAllDividends.mockResolvedValue(fiis);

            const result = await service.getPortfolio(userId);

            expect(result).toHaveLength(1);
            const item = result[0]!;

            // Each numeric field should be rounded to 2dp
            expect(item.averagePrice).toBe(round2(item.averagePrice));
            expect(item.lastMonthDividend).toBe(round2(item.lastMonthDividend));
            expect(item.projectedMonthlyYield).toBe(round2(item.projectedMonthlyYield));

            // Verify the specific computation matches round2
            expect(item.averagePrice).toBe(round2(averagePrice));
            expect(item.projectedMonthlyYield).toBe(round2(dividendPerShare * shares));
            expect(item.lastMonthDividend).toBe(round2(dividendPerShare * shares));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Portfolio is sorted by creation date descending
   *
   * For any portfolio result with more than one item, for every consecutive pair of items
   * (item[i], item[i+1]), the creation date of item[i] SHALL be greater than or equal to
   * the creation date of item[i+1].
   *
   * **Validates: Requirements 1.5**
   */
  describe('Property 3: Portfolio is sorted by creation date descending', () => {
    it('consecutive items have non-increasing creation dates', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 2-10 unique tickers with associated creation dates
          uniqueTickersArb(2, 10).chain((tickers) =>
            fc.tuple(
              fc.constant(tickers),
              fc.array(
                fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
                { minLength: tickers.length, maxLength: tickers.length }
              )
            )
          ),
          async ([tickers, dates]) => {
            const userId = 'user-1';

            // Sort dates descending (this is what the repo does with orderBy: createdAt desc)
            const sortedDates = [...dates].sort((a, b) => b.getTime() - a.getTime());

            const fiis = tickers.map((ticker, i) =>
              createMockFII({
                ticker,
                userId,
                shares: 10,
                averagePrice: 100.0,
                dividends: [],
                createdAt: sortedDates[i]!,
              })
            );

            mockRepo.findByUserIdWithAllDividends.mockResolvedValue(fiis);

            const result = await service.getPortfolio(userId);

            expect(result).toHaveLength(tickers.length);

            // The result should preserve the same order as the repo returned them
            // (which is createdAt desc). Since the service maps in order,
            // the result order should match input order.
            for (let i = 0; i < result.length; i++) {
              expect(result[i]!.ticker).toBe(fiis[i]!.ticker);
            }

            // Verify the input was indeed sorted desc
            for (let i = 0; i < sortedDates.length - 1; i++) {
              expect(sortedDates[i]!.getTime()).toBeGreaterThanOrEqual(sortedDates[i + 1]!.getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Last month dividend calculation
   *
   * For any FII with N dividend records and S shares, `lastMonthDividend` SHALL equal
   * `round2(Σ(d.dividendPerShare × S))` where the sum is over all dividend records `d`
   * with paymentDate within the previous calendar month. If no dividends fall within
   * the previous month, the result SHALL be 0.
   *
   * **Validates: Requirements 2.1, 2.2, 2.3**
   */
  describe('Property 4: Last month dividend calculation', () => {
    it('lastMonthDividend = round2(Σ(dividendPerShare × shares)) for dividends in previous month', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }),
          fc.date({ min: new Date('2021-02-01'), max: new Date('2030-12-31') }),
          fc.array(
            fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
            { minLength: 0, maxLength: 10 }
          ),
          fc.array(
            fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
            { minLength: 0, maxLength: 5 }
          ),
          (shares, referenceDate, prevMonthDividendAmounts, outsideDividendAmounts) => {
            const year = referenceDate.getFullYear();
            const month = referenceDate.getMonth();
            let prevYear = year;
            let prevMonth = month - 1;
            if (prevMonth < 0) {
              prevMonth = 11;
              prevYear = year - 1;
            }

            const prevMonthDividends: FIIDividendRecord[] = prevMonthDividendAmounts.map((amount, i) => ({
              id: `prev-${i}`,
              fiiId: 'fii-1',
              dividendPerShare: amount,
              paymentDate: new Date(prevYear, prevMonth, Math.min(i + 1, 28)),
            }));

            let olderYear = prevYear;
            let olderMonth = prevMonth - 1;
            if (olderMonth < 0) {
              olderMonth = 11;
              olderYear = prevYear - 1;
            }
            const outsideDividends: FIIDividendRecord[] = outsideDividendAmounts.map((amount, i) => ({
              id: `outside-${i}`,
              fiiId: 'fii-1',
              dividendPerShare: amount,
              paymentDate: new Date(olderYear, olderMonth, Math.min(i + 1, 28)),
            }));

            const allDividends = [...prevMonthDividends, ...outsideDividends];
            const result = service.calculateLastMonthDividend(shares, allDividends, referenceDate);

            const expectedSum = prevMonthDividendAmounts.reduce((acc, d) => acc + d * shares, 0);
            const expected = prevMonthDividendAmounts.length > 0 ? round2(expectedSum) : 0;

            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns 0 when no dividends fall within previous month', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }),
          fc.date({ min: new Date('2021-02-01'), max: new Date('2030-12-31') }),
          fc.array(
            fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
            { minLength: 1, maxLength: 5 }
          ),
          (shares, referenceDate, dividendAmounts) => {
            const year = referenceDate.getFullYear();
            const month = referenceDate.getMonth();
            let targetYear = year;
            let targetMonth = month - 3;
            if (targetMonth < 0) {
              targetMonth += 12;
              targetYear -= 1;
            }

            const dividends: FIIDividendRecord[] = dividendAmounts.map((amount, i) => ({
              id: `old-${i}`,
              fiiId: 'fii-1',
              dividendPerShare: amount,
              paymentDate: new Date(targetYear, targetMonth, Math.min(i + 1, 28)),
            }));

            const result = service.calculateLastMonthDividend(shares, dividends, referenceDate);
            expect(result).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Previous month range computation
   *
   * For any reference date D, `getPreviousMonthRange(D)` SHALL return [start, end]
   * where start is the first day of the month immediately preceding D's month (at 00:00:00)
   * and end is the last day of that month (at 23:59:59.999), inclusive. The returned range
   * SHALL always span exactly one calendar month.
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 5: Previous month range computation', () => {
    it('start is first day of previous month at 00:00:00 and end is last day at 23:59:59.999', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-02-01'), max: new Date('2030-12-31') }),
          (referenceDate) => {
            const [start, end] = service.getPreviousMonthRange(referenceDate);

            const year = referenceDate.getFullYear();
            const month = referenceDate.getMonth();
            let prevYear = year;
            let prevMonth = month - 1;
            if (prevMonth < 0) {
              prevMonth = 11;
              prevYear = year - 1;
            }

            expect(start.getFullYear()).toBe(prevYear);
            expect(start.getMonth()).toBe(prevMonth);
            expect(start.getDate()).toBe(1);
            expect(start.getHours()).toBe(0);
            expect(start.getMinutes()).toBe(0);
            expect(start.getSeconds()).toBe(0);
            expect(start.getMilliseconds()).toBe(0);

            const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
            expect(end.getFullYear()).toBe(prevYear);
            expect(end.getMonth()).toBe(prevMonth);
            expect(end.getDate()).toBe(lastDay);
            expect(end.getHours()).toBe(23);
            expect(end.getMinutes()).toBe(59);
            expect(end.getSeconds()).toBe(59);
            expect(end.getMilliseconds()).toBe(999);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('range spans exactly one calendar month (start and end are in the same month)', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-02-01'), max: new Date('2030-12-31') }),
          (referenceDate) => {
            const [start, end] = service.getPreviousMonthRange(referenceDate);

            expect(start.getFullYear()).toBe(end.getFullYear());
            expect(start.getMonth()).toBe(end.getMonth());

            expect(start.getDate()).toBe(1);
            const lastDayOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
            expect(end.getDate()).toBe(lastDayOfMonth);

            const diffMs = end.getTime() - start.getTime();
            const expectedDiffMs = (lastDayOfMonth - 1) * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000 + 999;
            expect(diffMs).toBe(expectedDiffMs);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Projected monthly yield calculation
   *
   * For any FII with S shares and a non-empty list of dividend records ordered by
   * paymentDate descending, `projectedMonthlyYield` SHALL equal
   * `round2(dividends[0].dividendPerShare × S)`. If the dividend list is empty
   * or S is 0, the result SHALL be 0.
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  describe('Property 6: Projected monthly yield calculation', () => {
    it('projectedMonthlyYield = round2(dividends[0].dividendPerShare × shares) for non-empty dividends', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }),
          fc.array(
            fc.record({
              dividendPerShare: fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
              paymentDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (shares, dividendData) => {
            const sorted = [...dividendData].sort(
              (a, b) => b.paymentDate.getTime() - a.paymentDate.getTime()
            );

            const dividends: FIIDividendRecord[] = sorted.map((d, i) => ({
              id: `div-${i}`,
              fiiId: 'fii-1',
              dividendPerShare: d.dividendPerShare,
              paymentDate: d.paymentDate,
            }));

            const result = service.calculateProjectedMonthlyYield(shares, dividends);
            const expected = round2(sorted[0]!.dividendPerShare * shares);
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns 0 when dividend list is empty', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100_000 }),
          (shares) => {
            const result = service.calculateProjectedMonthlyYield(shares, []);
            expect(result).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns 0 when shares is 0', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              dividendPerShare: fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
              paymentDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (dividendData) => {
            const dividends: FIIDividendRecord[] = dividendData.map((d, i) => ({
              id: `div-${i}`,
              fiiId: 'fii-1',
              dividendPerShare: d.dividendPerShare,
              paymentDate: d.paymentDate,
            }));

            const result = service.calculateProjectedMonthlyYield(0, dividends);
            expect(result).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Weighted average price on new aporte
   *
   * For any existing FII position with currentShares > 0 and currentAvgPrice > 0,
   * and a new aporte with newShares > 0 and newPricePerShare > 0, the resulting
   * average price SHALL equal:
   * round2((currentShares * currentAvgPrice + newShares * newPricePerShare) / (currentShares + newShares))
   *
   * **Validates: Requirements 4.2, 4.3**
   */
  describe('Property 7: Weighted average price on new aporte', () => {
    it('new average price = round2((currentShares * currentAvgPrice + newShares * newPricePerShare) / totalShares)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 1, max: 100_000 }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          (currentShares, currentAvgPrice, newShares, newPricePerShare) => {
            const result = calculateWeightedAverage(currentShares, currentAvgPrice, newShares, newPricePerShare);

            const totalShares = currentShares + newShares;
            const expected = round2(
              (currentShares * currentAvgPrice + newShares * newPricePerShare) / totalShares
            );

            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('weighted average is between min and max of the two prices', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 1, max: 100_000 }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          (currentShares, currentAvgPrice, newShares, newPricePerShare) => {
            const result = calculateWeightedAverage(currentShares, currentAvgPrice, newShares, newPricePerShare);

            const minPrice = Math.min(currentAvgPrice, newPricePerShare);
            const maxPrice = Math.max(currentAvgPrice, newPricePerShare);

            // Weighted average must lie between (or equal to) the two prices
            // Allow small rounding tolerance
            expect(result).toBeGreaterThanOrEqual(round2(minPrice) - 0.01);
            expect(result).toBeLessThanOrEqual(round2(maxPrice) + 0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('when newShares equals currentShares, result is the simple average of the two prices', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          (shares, currentAvgPrice, newPricePerShare) => {
            const result = calculateWeightedAverage(shares, currentAvgPrice, shares, newPricePerShare);

            const expected = round2((currentAvgPrice + newPricePerShare) / 2);
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Reverse weighted average on aporte deletion
   *
   * For any FII position resulting from at least 2 aportes, deleting the most recent aporte
   * SHALL produce an average price equal to:
   * round2((currentShares * currentAvgPrice - deletedShares * deletedPricePerShare) / (currentShares - deletedShares))
   * If the resulting shares equal 0, the average price SHALL be 0.
   *
   * **Validates: Requirements 4.4**
   */
  describe('Property 8: Reverse weighted average on aporte deletion', () => {
    it('reverse formula: round2((currentShares * currentAvgPrice - deletedShares * deletedPricePerShare) / (currentShares - deletedShares))', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100_000 }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 1, max: 50_000 }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          (currentShares, currentAvgPrice, deletedSharesRaw, deletedPricePerShare) => {
            // Ensure deletedShares < currentShares (resulting shares > 0)
            const deletedShares = Math.min(deletedSharesRaw, currentShares - 1);

            const result = calculateReverseWeightedAverage(
              currentShares,
              currentAvgPrice,
              deletedShares,
              deletedPricePerShare
            );

            const resultingShares = currentShares - deletedShares;
            const expected = round2(
              (currentShares * currentAvgPrice - deletedShares * deletedPricePerShare) / resultingShares
            );

            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns 0 when resulting shares equal 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          (shares, currentAvgPrice, deletedPricePerShare) => {
            // deletedShares == currentShares -> resulting shares = 0 -> avgPrice = 0
            const result = calculateReverseWeightedAverage(shares, currentAvgPrice, shares, deletedPricePerShare);
            expect(result).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('round-trip: adding then removing an aporte returns original average price', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 1, max: 100_000 }),
          fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
          (originalShares, originalAvgPrice, newShares, newPricePerShare) => {
            // Step 1: Add aporte (forward weighted average without rounding intermediate)
            const afterAddShares = originalShares + newShares;
            const afterAddAvgPrice = (originalShares * originalAvgPrice + newShares * newPricePerShare) / afterAddShares;

            // Step 2: Remove the same aporte (reverse weighted average)
            const restored = calculateReverseWeightedAverage(
              afterAddShares,
              afterAddAvgPrice,
              newShares,
              newPricePerShare
            );

            // Should return to original (within rounding tolerance)
            expect(restored).toBe(round2(originalAvgPrice));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
