import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ExportService } from '../export.service.js';

// Mock repositories and calculation service
const mockAporteRepo = {
  findByUserId: vi.fn(),
  create: vi.fn(),
  findByAssetId: vi.fn(),
};

const mockRendaFixaRepo = {
  findByUserId: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockFiiRepo = {
  findByUserId: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createQuote: vi.fn(),
  getLatestQuote: vi.fn(),
  createDividend: vi.fn(),
  getLatestDividend: vi.fn(),
};

const mockMarketIndexRepo = {
  getLatest: vi.fn(),
  create: vi.fn(),
  findByTypeAndDate: vi.fn(),
};

const mockCalculationService = {
  calculateRendaFixaProjection: vi.fn(),
  calculateAveragePrice: vi.fn(),
  calculateDividendProjection: vi.fn(),
  calculatePatrimonyTotal: vi.fn(),
  calculateAllocation: vi.fn(),
  calculateFIIVariation: vi.fn(),
  isQuoteStale: vi.fn(),
  isDividendStale: vi.fn(),
};

/**
 * Property 16: Completude dos Dados de Exportação
 *
 * For any carteira com N aportes registrados, o arquivo exportado (CSV ou Excel)
 * SHALL conter exatamente N linhas de dados, e cada linha SHALL conter:
 * data (formato AAAA-MM-DD), nome do ativo, tipo (Renda_Fixa ou FII),
 * valor investido (2 casas decimais), quantidade de cotas (quando FII) e saldo calculado.
 *
 * **Validates: Requirements 15.1, 15.2**
 */
describe('Property 16: Completude dos Dados de Exportação', () => {
  const userId = 'user-export-test';
  let exportService: ExportService;

  beforeEach(() => {
    vi.clearAllMocks();
    exportService = new ExportService(
      mockRendaFixaRepo as any,
      mockFiiRepo as any,
      mockAporteRepo as any,
      mockMarketIndexRepo as any,
      mockCalculationService as any,
    );
  });

  // Arbitrary for generating a valid date between 2020 and 2030
  const arbDate = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

  // Arbitrary for generating a valid amount (positive, 2 decimal places range)
  const arbAmount = fc.double({ min: 0.01, max: 999_999_999.99, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for generating a valid asset type
  const arbAssetType = fc.constantFrom('RENDA_FIXA' as const, 'FII' as const);

  // Arbitrary for generating FII shares (positive integer)
  const arbShares = fc.integer({ min: 1, max: 100_000 });

  // Arbitrary for generating a ticker
  const arbTicker = fc.tuple(
    fc.stringOf(fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'), { minLength: 4, maxLength: 4 }),
    fc.integer({ min: 10, max: 99 }),
  ).map(([letters, digits]) => `${letters}${digits}`);

  // Arbitrary for generating an institution name
  const arbInstitution = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

  // Generate N aportes with matching asset data
  const arbAporteList = fc.integer({ min: 1, max: 30 }).chain((n) =>
    fc.tuple(
      fc.constant(n),
      fc.array(
        fc.tuple(arbAssetType, arbDate, arbAmount, arbShares, arbTicker, arbInstitution),
        { minLength: n, maxLength: n },
      ),
    ),
  );

  it('export rows count equals N aportes and each row has all required columns', async () => {
    await fc.assert(
      fc.asyncProperty(arbAporteList, async ([n, aporteData]) => {
        vi.clearAllMocks();

        // Build aportes, RF assets, and FII assets from generated data
        const rendaFixaAssets: any[] = [];
        const fiiAssets: any[] = [];
        const aportes: any[] = [];

        for (let i = 0; i < n; i++) {
          const [assetType, date, amount, shares, ticker, institution] = aporteData[i]!;
          const isRF = assetType === 'RENDA_FIXA';
          const assetId = `asset-${i}`;

          if (isRF) {
            rendaFixaAssets.push({
              id: assetId,
              userId,
              institution,
              investedAmount: amount,
              maturityDate: new Date('2030-01-01'),
              rateType: 'CDI_PERCENTAGE',
              rateValue: 110,
              ipcaPlusRate: null,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
            });
          } else {
            fiiAssets.push({
              id: assetId,
              userId,
              ticker,
              shares,
              averagePrice: 10.0,
              purchaseDate: date,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
              quotes: [{ id: `q-${i}`, fiiId: assetId, price: 12.0, sourceDate: new Date(), updatedAt: new Date() }],
              dividends: [],
            });
          }

          aportes.push({
            id: `aporte-${i}`,
            userId,
            assetType,
            rendaFixaId: isRF ? assetId : null,
            fiiId: isRF ? null : assetId,
            amount,
            shares: isRF ? null : shares,
            pricePerShare: isRF ? null : amount / shares,
            operationType: 'NEW_POSITION',
            date,
            createdAt: date,
          });
        }

        // Configure mocks
        mockAporteRepo.findByUserId.mockResolvedValue(aportes);
        mockRendaFixaRepo.findByUserId.mockResolvedValue(rendaFixaAssets);
        mockFiiRepo.findByUserId.mockResolvedValue(fiiAssets);
        mockMarketIndexRepo.getLatest.mockResolvedValue(null);
        mockCalculationService.calculateRendaFixaProjection.mockReturnValue({
          projectedBalance: 10000.0,
          grossReturn: 500.0,
          dailyRate: 0.0005,
          businessDays: 252,
        });

        // Execute: get export rows
        const rows = await exportService.getExportRows(userId);

        // ASSERT: exactly N data rows
        expect(rows).toHaveLength(n);

        // ASSERT: each row has all required columns with correct formats
        for (let i = 0; i < n; i++) {
          const row = rows[i]!;

          // date must be YYYY-MM-DD format
          expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

          // assetName must be a non-empty string
          expect(row.assetName).toBeDefined();
          expect(typeof row.assetName).toBe('string');
          expect(row.assetName.length).toBeGreaterThan(0);

          // assetType must be 'Renda_Fixa' or 'FII'
          expect(['Renda_Fixa', 'FII']).toContain(row.assetType);

          // investedAmount must be a string with exactly 2 decimal places
          expect(row.investedAmount).toMatch(/^\d+\.\d{2}$/);

          // shares must be a string (number for FII, empty for RF)
          expect(typeof row.shares).toBe('string');
          if (row.assetType === 'FII') {
            // FII rows should have a numeric shares value
            expect(row.shares).toMatch(/^\d+$/);
          }

          // currentBalance must be a string with exactly 2 decimal places
          expect(row.currentBalance).toMatch(/^\d+\.\d{2}$/);
        }
      }),
      { numRuns: 100 },
    );
  });
});
