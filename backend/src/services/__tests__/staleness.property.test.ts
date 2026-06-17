import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CalculationService } from '../calculation.service.js';

const calculationService = new CalculationService();

/**
 * Property 6: Detecção de Dados Desatualizados (Staleness)
 *
 * For any FII com timestamp de última atualização de cotação T, o sistema SHALL
 * marcar como desatualizado (isStale = true) se e somente se (now - T) > 48 horas.
 * For any FII com timestamp de último provento P, o sistema SHALL marcar dividendos
 * como desatualizados se e somente se (now - P) > 60 dias.
 *
 * **Validates: Requirements 4.4, 5.5**
 */
describe('Property 6: Detecção de Dados Desatualizados (Staleness)', () => {
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

  it('Property 6a: isQuoteStale(T) = true iff (now - T) > 48 hours', () => {
    fc.assert(
      fc.property(
        // Generate an offset in milliseconds from now (negative = past, positive = future)
        // Range covers from 96 hours in the past to 96 hours in the future to test around the boundary
        fc.integer({ min: -96 * 60 * 60 * 1000, max: 96 * 60 * 60 * 1000 }),
        (offsetMs) => {
          const now = Date.now();
          const lastUpdateDate = new Date(now - offsetMs);

          const result = calculationService.isQuoteStale(lastUpdateDate);

          // The elapsed time from lastUpdateDate to now is offsetMs
          // isStale should be true iff offsetMs > 48 hours
          const expectedStale = offsetMs > FORTY_EIGHT_HOURS_MS;

          expect(result).toBe(expectedStale);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6b: isDividendStale(P) = true iff (now - P) > 60 days', () => {
    fc.assert(
      fc.property(
        // Generate an offset in milliseconds from now
        // Range covers from 120 days in the past to 120 days in the future to test around the boundary
        fc.integer({ min: -120 * 24 * 60 * 60 * 1000, max: 120 * 24 * 60 * 60 * 1000 }),
        (offsetMs) => {
          const now = Date.now();
          const lastPaymentDate = new Date(now - offsetMs);

          const result = calculationService.isDividendStale(lastPaymentDate);

          // The elapsed time from lastPaymentDate to now is offsetMs
          // isDividendStale should be true iff offsetMs > 60 days
          const expectedStale = offsetMs > SIXTY_DAYS_MS;

          expect(result).toBe(expectedStale);
        }
      ),
      { numRuns: 100 }
    );
  });
});
