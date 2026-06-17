import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { fiiSchema } from '../schemas';

/**
 * Property 2: Validação de FII aceita tickers válidos e rejeita inválidos
 *
 * For any string, a validação de ticker SHALL aceitar se e somente se a string
 * corresponder ao padrão `/^[A-Z]{4}\d{2}$/`.
 * For any entrada com shares ≤ 0 ou averagePrice ≤ 0, a validação SHALL rejeitar o cadastro.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */
describe('Property 2: Validação de FII aceita tickers válidos e rejeita inválidos', () => {
  // Helper to generate a valid ISO 8601 datetime string
  const validPurchaseDate = () =>
    fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }).map(
      (d) => d.toISOString()
    );

  // Generator for valid tickers: exactly 4 uppercase letters + 2 digits
  const validTickerArb = fc
    .tuple(
      fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 4, maxLength: 4 }),
      fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 2, maxLength: 2 })
    )
    .map(([letters, digits]) => letters + digits);

  // Generator for invalid tickers that do NOT match /^[A-Z]{4}\d{2}$/
  const invalidTickerArb = fc.oneof(
    // Too short (less than 6 chars)
    fc.string({ minLength: 0, maxLength: 5 }).filter((s) => !/^[A-Z]{4}\d{2}$/.test(s)),
    // Too long (more than 6 chars)
    fc.string({ minLength: 7, maxLength: 20 }).filter((s) => !/^[A-Z]{4}\d{2}$/.test(s)),
    // Contains lowercase letters
    fc.tuple(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 4, maxLength: 4 }),
      fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 2, maxLength: 2 })
    ).map(([letters, digits]) => letters + digits),
    // Letters part has digits mixed in
    fc.tuple(
      fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 4, maxLength: 4 }),
      fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 2, maxLength: 2 })
    ).filter(([letters]) => /\d/.test(letters)).map(([letters, digits]) => letters + digits),
    // Digits part has letters
    fc.tuple(
      fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 4, maxLength: 4 }),
      fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 2, maxLength: 2 })
    ).filter(([, digits]) => /[A-Z]/.test(digits)).map(([letters, digits]) => letters + digits)
  );

  it('should accept any ticker matching /^[A-Z]{4}\\d{2}$/ with valid shares and averagePrice', () => {
    fc.assert(
      fc.property(
        validTickerArb,
        fc.integer({ min: 1, max: 100000 }),
        fc.double({ min: 0.01, max: 100000, noNaN: true }),
        validPurchaseDate(),
        (ticker, shares, averagePrice, purchaseDate) => {
          const result = fiiSchema.safeParse({ ticker, shares, averagePrice, purchaseDate });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject any ticker NOT matching /^[A-Z]{4}\\d{2}$/', () => {
    fc.assert(
      fc.property(
        invalidTickerArb,
        fc.integer({ min: 1, max: 100000 }),
        fc.double({ min: 0.01, max: 100000, noNaN: true }),
        validPurchaseDate(),
        (ticker, shares, averagePrice, purchaseDate) => {
          const result = fiiSchema.safeParse({ ticker, shares, averagePrice, purchaseDate });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject shares ≤ 0', () => {
    fc.assert(
      fc.property(
        validTickerArb,
        fc.integer({ min: -10000, max: 0 }),
        fc.double({ min: 0.01, max: 100000, noNaN: true }),
        validPurchaseDate(),
        (ticker, shares, averagePrice, purchaseDate) => {
          const result = fiiSchema.safeParse({ ticker, shares, averagePrice, purchaseDate });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject non-integer shares', () => {
    fc.assert(
      fc.property(
        validTickerArb,
        fc.double({ min: 0.01, max: 100000, noNaN: true }).filter((n) => !Number.isInteger(n)),
        fc.double({ min: 0.01, max: 100000, noNaN: true }),
        validPurchaseDate(),
        (ticker, shares, averagePrice, purchaseDate) => {
          const result = fiiSchema.safeParse({ ticker, shares, averagePrice, purchaseDate });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject averagePrice ≤ 0', () => {
    fc.assert(
      fc.property(
        validTickerArb,
        fc.integer({ min: 1, max: 100000 }),
        fc.double({ min: -10000, max: 0, noNaN: true }),
        validPurchaseDate(),
        (ticker, shares, averagePrice, purchaseDate) => {
          const result = fiiSchema.safeParse({ ticker, shares, averagePrice, purchaseDate });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
