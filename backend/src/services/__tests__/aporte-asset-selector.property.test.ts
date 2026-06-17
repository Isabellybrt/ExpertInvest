import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { AporteService } from '../aporte.service.js';

// Mock withTransaction to execute the callback directly (no real DB)
vi.mock('../../repositories/index.js', () => ({
  withTransaction: async (fn: any) => fn({}),
}));

// Mock repositories
const mockAporteRepository = {
  create: vi.fn(),
  findByUserId: vi.fn(),
  findByUserIdWithAssets: vi.fn(),
  findByAssetId: vi.fn(),
};

const mockRendaFixaRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockFIIRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createQuote: vi.fn(),
  getLatestQuote: vi.fn(),
  createDividend: vi.fn(),
  getLatestDividend: vi.fn(),
};

// === Arbitraries ===

/** Generates a random FII ticker (4-6 uppercase letters followed by 2 digits) */
const tickerArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 4, maxLength: 4 }),
  fc.integer({ min: 11, max: 11 })
).map(([letters, num]) => `${letters}${num}`);

/** Generates a random institution name (non-empty string) */
const institutionArb = fc.stringOf(
  fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '.split('')),
  { minLength: 3, maxLength: 30 }
).filter((s) => s.trim().length > 0);

/** Generates a random rate type */
const rateTypeArb = fc.constantFrom('CDI_PERCENTAGE', 'IPCA_PLUS') as fc.Arbitrary<'CDI_PERCENTAGE' | 'IPCA_PLUS'>;

/** Generates a random rate value (positive decimal, 1 to 200) */
const rateValueArb = fc.double({ min: 0.1, max: 200, noNaN: true, noDefaultInfinity: true });

/** Generates a random UUID-like string */
const uuidArb = fc.uuid();

describe('Feature: aporte-asset-selector', () => {
  let aporteService: AporteService;

  beforeEach(() => {
    vi.clearAllMocks();
    aporteService = new AporteService(
      mockAporteRepository as any,
      mockRendaFixaRepository as any,
      mockFIIRepository as any
    );
  });

  /**
   * Property 1: FII aporte resolves to ticker
   *
   * For any aporte record linked to an existing FII, the resolved `assetName`
   * SHALL equal the FII's `ticker` field.
   *
   * **Validates: Requirements 1.2, 4.2**
   */
  describe('Property 1: FII aporte resolves to ticker', () => {
    it('assetName equals FII ticker for any aporte linked to an existing FII', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          tickerArb,
          async (userId, fiiId, ticker) => {
            mockAporteRepository.findByUserIdWithAssets.mockReset();

            const aporteWithFii = {
              id: 'aporte-1',
              userId,
              assetType: 'FII',
              rendaFixaId: null,
              fiiId,
              amount: 1000,
              shares: 10,
              pricePerShare: 100,
              operationType: 'EXISTING_POSITION',
              date: new Date('2024-06-01'),
              createdAt: new Date(),
              fii: { ticker },
              rendaFixa: null,
            };

            mockAporteRepository.findByUserIdWithAssets.mockResolvedValue([aporteWithFii]);

            const result = await aporteService.listByUser(userId);

            expect(result).toHaveLength(1);
            expect(result[0].assetName).toBe(ticker);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Renda Fixa aporte resolves to institution name
   *
   * For any aporte record linked to an existing Renda Fixa title, the resolved
   * `assetName` SHALL equal the Renda Fixa's `institution` field.
   *
   * **Validates: Requirements 1.3, 4.3**
   */
  describe('Property 2: Renda Fixa aporte resolves to institution name', () => {
    it('assetName equals Renda Fixa institution for any aporte linked to an existing Renda Fixa', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          institutionArb,
          async (userId, rendaFixaId, institution) => {
            mockAporteRepository.findByUserIdWithAssets.mockReset();

            const aporteWithRendaFixa = {
              id: 'aporte-2',
              userId,
              assetType: 'RENDA_FIXA',
              rendaFixaId,
              fiiId: null,
              amount: 5000,
              shares: null,
              pricePerShare: null,
              operationType: 'EXISTING_POSITION',
              date: new Date('2024-06-01'),
              createdAt: new Date(),
              fii: null,
              rendaFixa: { institution },
            };

            mockAporteRepository.findByUserIdWithAssets.mockResolvedValue([aporteWithRendaFixa]);

            const result = await aporteService.listByUser(userId);

            expect(result).toHaveLength(1);
            expect(result[0].assetName).toBe(institution);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Deleted asset fallback label
   *
   * For any aporte record where both `fiiId` and `rendaFixaId` are null
   * (asset was deleted), the resolved `assetName` SHALL equal "Ativo removido".
   *
   * **Validates: Requirements 1.4, 4.4**
   */
  describe('Property 3: Deleted asset fallback label', () => {
    it('assetName equals "Ativo removido" when both fii and rendaFixa are null', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.constantFrom('FII', 'RENDA_FIXA') as fc.Arbitrary<'FII' | 'RENDA_FIXA'>,
          fc.double({ min: 0.01, max: 999999, noNaN: true, noDefaultInfinity: true }),
          async (userId, assetType, amount) => {
            mockAporteRepository.findByUserIdWithAssets.mockReset();

            const aporteWithDeletedAsset = {
              id: 'aporte-deleted',
              userId,
              assetType,
              rendaFixaId: null,
              fiiId: null,
              amount,
              shares: assetType === 'FII' ? 10 : null,
              pricePerShare: assetType === 'FII' ? amount / 10 : null,
              operationType: 'EXISTING_POSITION',
              date: new Date('2024-06-01'),
              createdAt: new Date(),
              fii: null,
              rendaFixa: null,
            };

            mockAporteRepository.findByUserIdWithAssets.mockResolvedValue([aporteWithDeletedAsset]);

            const result = await aporteService.listByUser(userId);

            expect(result).toHaveLength(1);
            expect(result[0].assetName).toBe('Ativo removido');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: FII dropdown label equals ticker
   *
   * For any FII record belonging to a user, the assets dropdown endpoint SHALL
   * return an option with `label` equal to the FII's `ticker`.
   *
   * **Validates: Requirements 2.2, 3.2**
   */
  describe('Property 4: FII dropdown label equals ticker', () => {
    it('listUserAssets returns FII options with label equal to ticker', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.array(
            fc.tuple(uuidArb, tickerArb).map(([id, ticker]) => ({
              id,
              userId: 'user-fixed',
              ticker,
              shares: 10,
              averagePrice: 100,
              purchaseDate: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
            { minLength: 1, maxLength: 10 }
          ),
          async (userId, fiis) => {
            mockFIIRepository.findByUserId.mockReset();
            mockRendaFixaRepository.findByUserId.mockReset();

            mockFIIRepository.findByUserId.mockResolvedValue(fiis);
            mockRendaFixaRepository.findByUserId.mockResolvedValue([]);

            const result = await aporteService.listUserAssets(userId);

            expect(result.fii).toHaveLength(fiis.length);
            for (let i = 0; i < fiis.length; i++) {
              expect(result.fii[i].label).toBe(fiis[i].ticker);
              expect(result.fii[i].id).toBe(fiis[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Renda Fixa dropdown label format
   *
   * For any Renda Fixa record belonging to a user, the assets dropdown endpoint
   * SHALL return an option with `label` matching the format
   * "{institution} - {rateValue}% {rateTypeSuffix}" where rateTypeSuffix is
   * "CDI" for CDI_PERCENTAGE or "IPCA+" for IPCA_PLUS.
   *
   * **Validates: Requirements 2.3, 3.3**
   */
  describe('Property 5: Renda Fixa dropdown label format', () => {
    it('listUserAssets returns Renda Fixa options with correctly formatted label', async () => {
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.array(
            fc.tuple(uuidArb, institutionArb, rateTypeArb, rateValueArb).map(([id, institution, rateType, rateValue]) => ({
              id,
              userId: 'user-fixed',
              institution,
              investedAmount: 1000,
              maturityDate: new Date('2030-01-01'),
              rateType,
              rateValue,
              ipcaPlusRate: rateType === 'IPCA_PLUS' ? rateValue : null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
            { minLength: 1, maxLength: 10 }
          ),
          async (userId, rendaFixas) => {
            mockFIIRepository.findByUserId.mockReset();
            mockRendaFixaRepository.findByUserId.mockReset();

            mockFIIRepository.findByUserId.mockResolvedValue([]);
            mockRendaFixaRepository.findByUserId.mockResolvedValue(rendaFixas);

            const result = await aporteService.listUserAssets(userId);

            expect(result.rendaFixa).toHaveLength(rendaFixas.length);
            for (let i = 0; i < rendaFixas.length; i++) {
              const rf = rendaFixas[i];
              const suffix = rf.rateType === 'CDI_PERCENTAGE' ? 'CDI' : 'IPCA+';
              const expectedLabel = `${rf.institution} - ${rf.rateValue}% ${suffix}`;
              expect(result.rendaFixa[i].label).toBe(expectedLabel);
              expect(result.rendaFixa[i].id).toBe(rf.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
