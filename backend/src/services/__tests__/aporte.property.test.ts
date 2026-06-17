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

/**
 * Property 3: Aporte em Renda Fixa soma ao saldo existente
 *
 * For any título de Renda Fixa com saldo S e qualquer aporte válido de valor V
 * (onde 0.01 ≤ V ≤ 999999999.99), o novo saldo SHALL ser exatamente S + V.
 *
 * **Validates: Requirements 3.1**
 */
describe('Property 3: Aporte em Renda Fixa soma ao saldo existente', () => {
  const userId = 'user-123';
  const rfAssetId = '11111111-1111-1111-1111-111111111111';
  let aporteService: AporteService;

  beforeEach(() => {
    vi.clearAllMocks();
    aporteService = new AporteService(
      mockAporteRepository as any,
      mockRendaFixaRepository as any,
      mockFIIRepository as any
    );
  });

  it('new balance = S + V for any valid initial balance S and aporte amount V', async () => {
    await fc.assert(
      fc.asyncProperty(
        // S: initial balance (0.01 to a reasonable max)
        fc.double({ min: 0.01, max: 500_000_000, noNaN: true, noDefaultInfinity: true }),
        // V: aporte amount (valid range per schema)
        fc.double({ min: 0.01, max: 999_999_999.99, noNaN: true, noDefaultInfinity: true }),
        async (initialBalance, aporteAmount) => {
          mockRendaFixaRepository.findById.mockReset();
          mockRendaFixaRepository.update.mockReset();
          mockAporteRepository.create.mockReset();

          const existingRendaFixa = {
            id: rfAssetId,
            userId,
            institution: 'Banco Test',
            investedAmount: initialBalance,
            maturityDate: new Date('2030-01-01'),
            rateType: 'CDI_PERCENTAGE',
            rateValue: 110,
            ipcaPlusRate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          mockRendaFixaRepository.findById.mockResolvedValue(existingRendaFixa);
          mockRendaFixaRepository.update.mockResolvedValue({
            ...existingRendaFixa,
            investedAmount: initialBalance + aporteAmount,
          });
          mockAporteRepository.create.mockResolvedValue({
            id: 'aporte-gen',
            userId,
            assetType: 'RENDA_FIXA',
            rendaFixaId: rfAssetId,
            fiiId: null,
            amount: aporteAmount,
            shares: null,
            pricePerShare: null,
            operationType: 'EXISTING_POSITION',
            date: new Date('2024-06-01T00:00:00.000Z'),
            createdAt: new Date(),
          });

          await aporteService.registerAporte(userId, {
            assetType: 'RENDA_FIXA',
            assetId: rfAssetId,
            amount: aporteAmount,
            date: '2024-06-01T00:00:00.000Z',
          });

          // Verify that the update was called with new balance = S + V
          expect(mockRendaFixaRepository.update).toHaveBeenCalledWith(
            rfAssetId,
            { investedAmount: initialBalance + aporteAmount },
            expect.anything()
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 4: Recálculo de Preço Médio de FII
 *
 * For any FII com quantidade anterior Q₁ e preço médio P₁, e qualquer aporte com
 * quantidade nova Q₂ (≥ 1) e preço P₂ (> 0), o novo preço médio SHALL ser igual a
 * (Q₁ × P₁ + Q₂ × P₂) / (Q₁ + Q₂), e a nova quantidade SHALL ser Q₁ + Q₂.
 *
 * **Validates: Requirements 3.2**
 */
describe('Property 4: Recálculo de Preço Médio de FII', () => {
  const userId = 'user-123';
  const fiiAssetId = '22222222-2222-2222-2222-222222222222';
  let aporteService: AporteService;

  beforeEach(() => {
    vi.clearAllMocks();
    aporteService = new AporteService(
      mockAporteRepository as any,
      mockRendaFixaRepository as any,
      mockFIIRepository as any
    );
  });

  it('new average price = (Q1*P1 + Q2*P2) / (Q1 + Q2) and new quantity = Q1 + Q2', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Q1: existing shares (1 to 100000)
        fc.integer({ min: 1, max: 100_000 }),
        // P1: existing average price (0.01 to 10000)
        fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
        // Q2: new shares (1 to 100000)
        fc.integer({ min: 1, max: 100_000 }),
        // P2: new price per share (0.01 to 10000)
        fc.double({ min: 0.01, max: 10_000, noNaN: true, noDefaultInfinity: true }),
        async (q1, p1, q2, p2) => {
          mockFIIRepository.findById.mockReset();
          mockFIIRepository.update.mockReset();
          mockAporteRepository.create.mockReset();

          const existingFII = {
            id: fiiAssetId,
            userId,
            ticker: 'MXRF11',
            shares: q1,
            averagePrice: p1,
            purchaseDate: new Date('2024-01-15'),
            createdAt: new Date(),
            updatedAt: new Date(),
            quotes: [],
            dividends: [],
          };

          mockFIIRepository.findById.mockResolvedValue(existingFII);
          mockFIIRepository.update.mockResolvedValue({
            ...existingFII,
            shares: q1 + q2,
            averagePrice: (q1 * p1 + q2 * p2) / (q1 + q2),
          });
          mockAporteRepository.create.mockResolvedValue({
            id: 'aporte-fii-gen',
            userId,
            assetType: 'FII',
            rendaFixaId: null,
            fiiId: fiiAssetId,
            amount: q2 * p2,
            shares: q2,
            pricePerShare: p2,
            operationType: 'EXISTING_POSITION',
            date: new Date('2024-06-01T00:00:00.000Z'),
            createdAt: new Date(),
          });

          await aporteService.registerAporte(userId, {
            assetType: 'FII',
            assetId: fiiAssetId,
            shares: q2,
            pricePerShare: p2,
            date: '2024-06-01T00:00:00.000Z',
          });

          // Verify the update was called with the correct weighted average price
          const expectedNewShares = q1 + q2;
          const expectedAvgPrice = (q1 * p1 + q2 * p2) / (q1 + q2);

          expect(mockFIIRepository.update).toHaveBeenCalledWith(
            fiiAssetId,
            {
              shares: expectedNewShares,
              averagePrice: expect.closeTo(expectedAvgPrice, 4),
            },
            expect.anything()
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 5: Completude do Histórico de Aportes
 *
 * For any sequência de N aportes válidos registrados com sucesso, o histórico SHALL
 * conter exatamente N entradas, cada uma com data, valor, identificação do ativo e
 * tipo de operação corretos.
 *
 * **Validates: Requirements 3.4**
 */
describe('Property 5: Completude do Histórico de Aportes', () => {
  const userId = 'user-123';
  const rfAssetId = '11111111-1111-1111-1111-111111111111';
  let aporteService: AporteService;

  beforeEach(() => {
    vi.clearAllMocks();
    aporteService = new AporteService(
      mockAporteRepository as any,
      mockRendaFixaRepository as any,
      mockFIIRepository as any
    );
  });

  it('N successful aportes result in exactly N history entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        // N: number of aportes (1 to 20)
        fc.integer({ min: 1, max: 20 }),
        async (n) => {
          mockRendaFixaRepository.findById.mockReset();
          mockRendaFixaRepository.update.mockReset();
          mockAporteRepository.create.mockReset();

          let aporteCounter = 0;

          const existingRendaFixa = {
            id: rfAssetId,
            userId,
            institution: 'Banco Test',
            investedAmount: 1000,
            maturityDate: new Date('2030-01-01'),
            rateType: 'CDI_PERCENTAGE',
            rateValue: 110,
            ipcaPlusRate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          mockRendaFixaRepository.findById.mockResolvedValue(existingRendaFixa);
          mockRendaFixaRepository.update.mockResolvedValue(existingRendaFixa);
          mockAporteRepository.create.mockImplementation(async (data: any) => {
            aporteCounter++;
            return {
              id: `aporte-${aporteCounter}`,
              userId,
              assetType: 'RENDA_FIXA',
              rendaFixaId: rfAssetId,
              fiiId: null,
              amount: data.amount,
              shares: null,
              pricePerShare: null,
              operationType: 'EXISTING_POSITION',
              date: data.date,
              createdAt: new Date(),
            };
          });

          // Register N aportes
          for (let i = 0; i < n; i++) {
            await aporteService.registerAporte(userId, {
              assetType: 'RENDA_FIXA',
              assetId: rfAssetId,
              amount: 100 + i,
              date: '2024-06-01T00:00:00.000Z',
            });
          }

          // Verify that exactly N history entries were created
          expect(mockAporteRepository.create).toHaveBeenCalledTimes(n);

          // Verify each entry has the required fields
          for (let i = 0; i < n; i++) {
            const callArgs = mockAporteRepository.create.mock.calls[i][0];
            expect(callArgs).toMatchObject({
              userId,
              assetType: 'RENDA_FIXA',
              rendaFixaId: rfAssetId,
              amount: 100 + i,
              operationType: 'EXISTING_POSITION',
              date: expect.any(Date),
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
