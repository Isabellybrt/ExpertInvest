import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateRendaFixa } from '../validators';

/**
 * Property 1: Validação de Renda Fixa aceita entradas válidas e rejeita inválidas
 *
 * For any entrada com instituição de 1-100 caracteres, valor entre 0.01 e 999999999.99,
 * data de vencimento futura e taxa no formato CDI (1-999%) ou IPCA+ (0.01-99.99%),
 * a validação SHALL aceitar a entrada.
 *
 * For any entrada que viole qualquer dessas regras (campos vazios, valor ≤ 0, data passada,
 * taxa fora do intervalo), a validação SHALL rejeitar e retornar mensagens de erro
 * indicando os campos inválidos.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7**
 */
describe('Property 1: Validação de Renda Fixa aceita entradas válidas e rejeita inválidas', () => {
  // Helper to generate a future date string (at least 1 day in the future)
  const futureDateArb = fc
    .integer({ min: 1, max: 3650 })
    .map((daysAhead) => {
      const date = new Date();
      date.setDate(date.getDate() + daysAhead);
      return date.toISOString().split('T')[0];
    });

  // Helper to generate a past date string
  const pastDateArb = fc
    .integer({ min: 1, max: 3650 })
    .map((daysAgo) => {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString().split('T')[0];
    });

  // Arbitrary for valid institution name (1-100 non-empty characters)
  const validInstitutionArb = fc
    .string({ minLength: 1, maxLength: 100 })
    .filter((s) => s.trim().length > 0);

  // Arbitrary for valid invested amount (0.01 to 999999999.99)
  const validAmountArb = fc.double({
    min: 0.01,
    max: 999_999_999.99,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // Arbitrary for valid CDI rate (1 to 999)
  const validCDIRateArb = fc.double({
    min: 1,
    max: 999,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // Arbitrary for valid IPCA+ rate (0.01 to 99.99)
  const validIPCARateArb = fc.double({
    min: 0.01,
    max: 99.99,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // Arbitrary for a complete valid RendaFixa input with CDI rate type
  const validRendaFixaCDIArb = fc.record({
    institution: validInstitutionArb,
    investedAmount: validAmountArb,
    maturityDate: futureDateArb,
    rateType: fc.constant('CDI_PERCENTAGE' as const),
    rateValue: validCDIRateArb,
  });

  // Arbitrary for a complete valid RendaFixa input with IPCA+ rate type
  const validRendaFixaIPCAArb = fc.record({
    institution: validInstitutionArb,
    investedAmount: validAmountArb,
    maturityDate: futureDateArb,
    rateType: fc.constant('IPCA_PLUS' as const),
    rateValue: validIPCARateArb,
  });

  // Combined arbitrary for any valid RendaFixa input
  const validRendaFixaArb = fc.oneof(validRendaFixaCDIArb, validRendaFixaIPCAArb);

  it('should accept all valid Renda Fixa inputs', () => {
    fc.assert(
      fc.property(validRendaFixaArb, (input) => {
        const result = validateRendaFixa(input);
        expect(result.success).toBe(true);
        expect(result.errors).toEqual({});
      }),
      { numRuns: 100 }
    );
  });

  it('should reject inputs with empty institution', () => {
    fc.assert(
      fc.property(validRendaFixaArb, (input) => {
        const invalidInput = { ...input, institution: '' };
        const result = validateRendaFixa(invalidInput);
        expect(result.success).toBe(false);
        expect(Object.keys(result.errors).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject inputs with institution exceeding 100 characters', () => {
    fc.assert(
      fc.property(
        validRendaFixaArb,
        fc.string({ minLength: 101, maxLength: 200 }),
        (input, longInstitution) => {
          const invalidInput = { ...input, institution: longInstitution };
          const result = validateRendaFixa(invalidInput);
          expect(result.success).toBe(false);
          expect(Object.keys(result.errors).length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject inputs with value <= 0', () => {
    fc.assert(
      fc.property(
        validRendaFixaArb,
        fc.double({ min: -999_999_999, max: 0, noNaN: true, noDefaultInfinity: true }),
        (input, invalidAmount) => {
          const invalidInput = { ...input, investedAmount: invalidAmount };
          const result = validateRendaFixa(invalidInput);
          expect(result.success).toBe(false);
          expect(Object.keys(result.errors).length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject inputs with past maturity date', () => {
    fc.assert(
      fc.property(validRendaFixaArb, pastDateArb, (input, pastDate) => {
        const invalidInput = { ...input, maturityDate: pastDate };
        const result = validateRendaFixa(invalidInput);
        expect(result.success).toBe(false);
        expect(Object.keys(result.errors).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject CDI rate out of valid range (< 1 or > 999)', () => {
    const invalidCDIRateArb = fc.oneof(
      fc.double({ min: -1000, max: 0.99, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 999.01, max: 10000, noNaN: true, noDefaultInfinity: true })
    );

    fc.assert(
      fc.property(validRendaFixaCDIArb, invalidCDIRateArb, (input, invalidRate) => {
        const invalidInput = { ...input, rateValue: invalidRate };
        const result = validateRendaFixa(invalidInput);
        expect(result.success).toBe(false);
        expect(Object.keys(result.errors).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject IPCA+ rate out of valid range (< 0.01 or > 99.99)', () => {
    const invalidIPCARateArb = fc.oneof(
      fc.double({ min: -1000, max: 0, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 100, max: 10000, noNaN: true, noDefaultInfinity: true })
    );

    fc.assert(
      fc.property(validRendaFixaIPCAArb, invalidIPCARateArb, (input, invalidRate) => {
        const invalidInput = { ...input, rateValue: invalidRate };
        const result = validateRendaFixa(invalidInput);
        expect(result.success).toBe(false);
        expect(Object.keys(result.errors).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject inputs with missing required fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'institution',
          'investedAmount',
          'maturityDate',
          'rateType',
          'rateValue'
        ),
        validRendaFixaArb,
        (fieldToRemove, input) => {
          const invalidInput = { ...input };
          delete (invalidInput as Record<string, unknown>)[fieldToRemove];
          const result = validateRendaFixa(invalidInput);
          expect(result.success).toBe(false);
          expect(Object.keys(result.errors).length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
