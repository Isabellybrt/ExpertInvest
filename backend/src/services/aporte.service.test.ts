import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AporteService, AporteServiceError } from './aporte.service.js';

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

// Mock withTransaction to execute the callback directly (no real DB)
vi.mock('../repositories/index.js', () => ({
  withTransaction: async (fn: any) => fn({}),
}));

describe('AporteService', () => {
  let aporteService: AporteService;
  const userId = 'user-123';
  const rfAssetId = '11111111-1111-1111-1111-111111111111';
  const fiiAssetId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();
    aporteService = new AporteService(
      mockAporteRepository as any,
      mockRendaFixaRepository as any,
      mockFIIRepository as any
    );
  });

  describe('registerAporte - Renda Fixa existing position (Req 3.1)', () => {
    const existingRendaFixa = {
      id: rfAssetId,
      userId: 'user-123',
      institution: 'Banco XYZ',
      investedAmount: 1000.0,
      maturityDate: new Date('2026-01-01'),
      rateType: 'CDI_PERCENTAGE',
      rateValue: 110,
      ipcaPlusRate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should sum amount to existing balance', async () => {
      mockRendaFixaRepository.findById.mockResolvedValue(existingRendaFixa);
      mockRendaFixaRepository.update.mockResolvedValue({ ...existingRendaFixa, investedAmount: 1500 });
      mockAporteRepository.create.mockResolvedValue({
        id: 'aporte-1',
        userId,
        assetType: 'RENDA_FIXA',
        rendaFixaId: rfAssetId,
        fiiId: null,
        amount: 500,
        shares: null,
        pricePerShare: null,
        operationType: 'EXISTING_POSITION',
        date: new Date('2024-06-01T00:00:00.000Z'),
        createdAt: new Date(),
      });

      const result = await aporteService.registerAporte(userId, {
        assetType: 'RENDA_FIXA',
        assetId: rfAssetId,
        amount: 500,
        date: '2024-06-01T00:00:00.000Z',
      });

      expect(mockRendaFixaRepository.update).toHaveBeenCalledWith(
        rfAssetId,
        { investedAmount: 1500 },
        expect.anything()
      );
      expect(result.operationType).toBe('EXISTING_POSITION');
      expect(result.amount).toBe(500);
      expect(result.rendaFixaId).toBe(rfAssetId);
    });

    it('should reject aporte with amount less than 0.01', async () => {
      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'RENDA_FIXA',
          assetId: rfAssetId,
          amount: 0,
          date: '2024-06-01T00:00:00.000Z',
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject aporte with amount exceeding max', async () => {
      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'RENDA_FIXA',
          assetId: rfAssetId,
          amount: 1_000_000_000,
          date: '2024-06-01T00:00:00.000Z',
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject aporte with invalid date format', async () => {
      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'RENDA_FIXA',
          assetId: rfAssetId,
          amount: 500,
          date: '01/06/2024',
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should return 404 when renda fixa not found', async () => {
      mockRendaFixaRepository.findById.mockResolvedValue(null);

      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'RENDA_FIXA',
          assetId: rfAssetId,
          amount: 500,
          date: '2024-06-01T00:00:00.000Z',
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('should return 404 when renda fixa belongs to another user', async () => {
      mockRendaFixaRepository.findById.mockResolvedValue({
        ...existingRendaFixa,
        userId: 'other-user',
      });

      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'RENDA_FIXA',
          assetId: rfAssetId,
          amount: 500,
          date: '2024-06-01T00:00:00.000Z',
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });
  });

  describe('registerAporte - FII existing position (Req 3.2)', () => {
    const existingFII = {
      id: fiiAssetId,
      userId: 'user-123',
      ticker: 'MXRF11',
      shares: 100,
      averagePrice: 10.0,
      purchaseDate: new Date('2024-01-15'),
      createdAt: new Date(),
      updatedAt: new Date(),
      quotes: [],
      dividends: [],
    };

    it('should recalculate average price correctly', async () => {
      mockFIIRepository.findById.mockResolvedValue(existingFII);
      mockFIIRepository.update.mockResolvedValue({
        ...existingFII,
        shares: 150,
        averagePrice: 10.33,
      });
      mockAporteRepository.create.mockResolvedValue({
        id: 'aporte-2',
        userId,
        assetType: 'FII',
        rendaFixaId: null,
        fiiId: fiiAssetId,
        amount: 550,
        shares: 50,
        pricePerShare: 11.0,
        operationType: 'EXISTING_POSITION',
        date: new Date('2024-06-01T00:00:00.000Z'),
        createdAt: new Date(),
      });

      const result = await aporteService.registerAporte(userId, {
        assetType: 'FII',
        assetId: fiiAssetId,
        shares: 50,
        pricePerShare: 11.0,
        date: '2024-06-01T00:00:00.000Z',
      });

      // Verify average price calculation: (100*10 + 50*11) / (100+50) = 1550/150 = 10.333...
      expect(mockFIIRepository.update).toHaveBeenCalledWith(
        fiiAssetId,
        {
          shares: 150,
          averagePrice: expect.closeTo(10.3333, 3),
        },
        expect.anything()
      );
      expect(result.operationType).toBe('EXISTING_POSITION');
      expect(result.shares).toBe(50);
      expect(result.pricePerShare).toBe(11.0);
      expect(result.fiiId).toBe(fiiAssetId);
    });

    it('should reject aporte with shares less than 1', async () => {
      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'FII',
          assetId: fiiAssetId,
          shares: 0,
          pricePerShare: 11.0,
          date: '2024-06-01T00:00:00.000Z',
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject aporte with non-integer shares', async () => {
      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'FII',
          assetId: fiiAssetId,
          shares: 10.5,
          pricePerShare: 11.0,
          date: '2024-06-01T00:00:00.000Z',
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should reject aporte with pricePerShare <= 0', async () => {
      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'FII',
          assetId: fiiAssetId,
          shares: 10,
          pricePerShare: 0,
          date: '2024-06-01T00:00:00.000Z',
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });

    it('should return 404 when FII not found', async () => {
      mockFIIRepository.findById.mockResolvedValue(null);

      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'FII',
          assetId: fiiAssetId,
          shares: 10,
          pricePerShare: 11.0,
          date: '2024-06-01T00:00:00.000Z',
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('should return 404 when FII belongs to another user', async () => {
      mockFIIRepository.findById.mockResolvedValue({
        ...existingFII,
        userId: 'other-user',
      });

      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'FII',
          assetId: fiiAssetId,
          shares: 10,
          pricePerShare: 11.0,
          date: '2024-06-01T00:00:00.000Z',
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });
  });

  describe('registerAporte - New position Renda Fixa (Req 3.3)', () => {
    it('should create new renda fixa position and register aporte', async () => {
      mockRendaFixaRepository.create.mockResolvedValue({
        id: 'new-rf-123',
        userId,
        institution: 'Banco ABC',
        investedAmount: 5000,
        maturityDate: new Date('2026-12-01'),
        rateType: 'CDI_PERCENTAGE',
        rateValue: 105,
        ipcaPlusRate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockAporteRepository.create.mockResolvedValue({
        id: 'aporte-3',
        userId,
        assetType: 'RENDA_FIXA',
        rendaFixaId: 'new-rf-123',
        fiiId: null,
        amount: 5000,
        shares: null,
        pricePerShare: null,
        operationType: 'NEW_POSITION',
        date: new Date('2024-06-01T00:00:00.000Z'),
        createdAt: new Date(),
      });

      const result = await aporteService.registerAporte(userId, {
        assetType: 'RENDA_FIXA',
        amount: 5000,
        date: '2024-06-01T00:00:00.000Z',
        institution: 'Banco ABC',
        maturityDate: '2026-12-01T00:00:00.000Z',
        rateType: 'CDI_PERCENTAGE',
        rateValue: 105,
      });

      expect(result.operationType).toBe('NEW_POSITION');
      expect(result.rendaFixaId).toBe('new-rf-123');
      expect(mockRendaFixaRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          institution: 'Banco ABC',
          investedAmount: 5000,
          rateType: 'CDI_PERCENTAGE',
          rateValue: 105,
        }),
        expect.anything()
      );
    });

    it('should reject new position without required fields', async () => {
      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'RENDA_FIXA',
          amount: 5000,
          date: '2024-06-01T00:00:00.000Z',
          // Missing institution, maturityDate, rateType, rateValue
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });
  });

  describe('registerAporte - New position FII (Req 3.3)', () => {
    it('should create new FII position and register aporte', async () => {
      mockFIIRepository.create.mockResolvedValue({
        id: 'new-fii-123',
        userId,
        ticker: 'HGLG11',
        shares: 50,
        averagePrice: 150.0,
        purchaseDate: new Date('2024-06-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockAporteRepository.create.mockResolvedValue({
        id: 'aporte-4',
        userId,
        assetType: 'FII',
        rendaFixaId: null,
        fiiId: 'new-fii-123',
        amount: 7500,
        shares: 50,
        pricePerShare: 150.0,
        operationType: 'NEW_POSITION',
        date: new Date('2024-06-01T00:00:00.000Z'),
        createdAt: new Date(),
      });

      const result = await aporteService.registerAporte(userId, {
        assetType: 'FII',
        shares: 50,
        pricePerShare: 150.0,
        date: '2024-06-01T00:00:00.000Z',
        ticker: 'HGLG11',
      });

      expect(result.operationType).toBe('NEW_POSITION');
      expect(result.fiiId).toBe('new-fii-123');
      expect(result.amount).toBe(7500);
      expect(mockFIIRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          ticker: 'HGLG11',
          shares: 50,
          averagePrice: 150.0,
        }),
        expect.anything()
      );
    });

    it('should reject new FII position without ticker', async () => {
      await expect(
        aporteService.registerAporte(userId, {
          assetType: 'FII',
          shares: 50,
          pricePerShare: 150.0,
          date: '2024-06-01T00:00:00.000Z',
          // Missing ticker
        })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    });
  });

  describe('registerAporte - History registration (Req 3.4)', () => {
    it('should create aporte history entry with correct fields for RF', async () => {
      const existingRendaFixa = {
        id: rfAssetId,
        userId,
        institution: 'Banco XYZ',
        investedAmount: 1000.0,
        maturityDate: new Date('2026-01-01'),
        rateType: 'CDI_PERCENTAGE',
        rateValue: 110,
        ipcaPlusRate: null,
      };
      mockRendaFixaRepository.findById.mockResolvedValue(existingRendaFixa);
      mockRendaFixaRepository.update.mockResolvedValue(existingRendaFixa);
      mockAporteRepository.create.mockResolvedValue({
        id: 'aporte-hist',
        userId,
        assetType: 'RENDA_FIXA',
        rendaFixaId: rfAssetId,
        fiiId: null,
        amount: 200,
        shares: null,
        pricePerShare: null,
        operationType: 'EXISTING_POSITION',
        date: new Date('2024-06-01T00:00:00.000Z'),
        createdAt: new Date(),
      });

      await aporteService.registerAporte(userId, {
        assetType: 'RENDA_FIXA',
        assetId: rfAssetId,
        amount: 200,
        date: '2024-06-01T00:00:00.000Z',
      });

      expect(mockAporteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          assetType: 'RENDA_FIXA',
          rendaFixaId: rfAssetId,
          amount: 200,
          operationType: 'EXISTING_POSITION',
          date: new Date('2024-06-01T00:00:00.000Z'),
        }),
        expect.anything()
      );
    });

    it('should create aporte history entry with correct fields for FII', async () => {
      const existingFII = {
        id: fiiAssetId,
        userId,
        ticker: 'MXRF11',
        shares: 100,
        averagePrice: 10.0,
        purchaseDate: new Date(),
        quotes: [],
        dividends: [],
      };
      mockFIIRepository.findById.mockResolvedValue(existingFII);
      mockFIIRepository.update.mockResolvedValue(existingFII);
      mockAporteRepository.create.mockResolvedValue({
        id: 'aporte-hist-2',
        userId,
        assetType: 'FII',
        rendaFixaId: null,
        fiiId: fiiAssetId,
        amount: 550,
        shares: 50,
        pricePerShare: 11.0,
        operationType: 'EXISTING_POSITION',
        date: new Date('2024-06-01T00:00:00.000Z'),
        createdAt: new Date(),
      });

      await aporteService.registerAporte(userId, {
        assetType: 'FII',
        assetId: fiiAssetId,
        shares: 50,
        pricePerShare: 11.0,
        date: '2024-06-01T00:00:00.000Z',
      });

      expect(mockAporteRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          assetType: 'FII',
          fiiId: fiiAssetId,
          amount: 550,
          shares: 50,
          pricePerShare: 11.0,
          operationType: 'EXISTING_POSITION',
          date: new Date('2024-06-01T00:00:00.000Z'),
        }),
        expect.anything()
      );
    });
  });

  describe('listByUser', () => {
    it('should return all aportes for the user with asset names', async () => {
      const mockAportes = [
        {
          id: 'a1',
          userId,
          assetType: 'RENDA_FIXA',
          rendaFixaId: 'rf-1',
          fiiId: null,
          amount: 1000,
          shares: null,
          pricePerShare: null,
          operationType: 'NEW_POSITION',
          date: new Date('2024-01-01'),
          createdAt: new Date(),
          fii: null,
          rendaFixa: { institution: 'Banco XYZ', rateType: 'CDI_PERCENTAGE', rateValue: 110 },
        },
        {
          id: 'a2',
          userId,
          assetType: 'FII',
          rendaFixaId: null,
          fiiId: 'fii-1',
          amount: 550,
          shares: 50,
          pricePerShare: 11.0,
          operationType: 'EXISTING_POSITION',
          date: new Date('2024-02-01'),
          createdAt: new Date(),
          fii: { ticker: 'MXRF11' },
          rendaFixa: null,
        },
      ];
      mockAporteRepository.findByUserIdWithAssets.mockResolvedValue(mockAportes);

      const result = await aporteService.listByUser(userId);

      expect(result).toHaveLength(2);
      expect(result[0].assetType).toBe('RENDA_FIXA');
      expect(result[0].assetName).toBe('Banco XYZ');
      expect(result[1].assetType).toBe('FII');
      expect(result[1].assetName).toBe('MXRF11');
      expect(mockAporteRepository.findByUserIdWithAssets).toHaveBeenCalledWith(userId);
    });

    it('should return empty array when no aportes exist', async () => {
      mockAporteRepository.findByUserIdWithAssets.mockResolvedValue([]);

      const result = await aporteService.listByUser(userId);

      expect(result).toHaveLength(0);
    });

    it('should return fallback asset name when asset is deleted', async () => {
      const mockAportes = [
        {
          id: 'a3',
          userId,
          assetType: 'FII',
          rendaFixaId: null,
          fiiId: 'deleted-fii',
          amount: 300,
          shares: 30,
          pricePerShare: 10.0,
          operationType: 'EXISTING_POSITION',
          date: new Date('2024-03-01'),
          createdAt: new Date(),
          fii: null,
          rendaFixa: null,
        },
      ];
      mockAporteRepository.findByUserIdWithAssets.mockResolvedValue(mockAportes);

      const result = await aporteService.listByUser(userId);

      expect(result).toHaveLength(1);
      expect(result[0].assetName).toBe('Ativo removido');
    });
  });

  describe('listByAsset', () => {
    it('should return aportes for a specific renda fixa asset', async () => {
      const mockAportes = [
        {
          id: 'a1',
          userId,
          assetType: 'RENDA_FIXA',
          rendaFixaId: 'rf-1',
          fiiId: null,
          amount: 1000,
          shares: null,
          pricePerShare: null,
          operationType: 'NEW_POSITION',
          date: new Date('2024-01-01'),
          createdAt: new Date(),
        },
      ];
      mockAporteRepository.findByAssetId.mockResolvedValue(mockAportes);

      const result = await aporteService.listByAsset('rf-1', 'RENDA_FIXA');

      expect(result).toHaveLength(1);
      expect(mockAporteRepository.findByAssetId).toHaveBeenCalledWith('rf-1', 'RENDA_FIXA');
    });

    it('should return aportes for a specific FII asset', async () => {
      const mockAportes = [
        {
          id: 'a2',
          userId,
          assetType: 'FII',
          rendaFixaId: null,
          fiiId: 'fii-1',
          amount: 550,
          shares: 50,
          pricePerShare: 11.0,
          operationType: 'EXISTING_POSITION',
          date: new Date('2024-02-01'),
          createdAt: new Date(),
        },
      ];
      mockAporteRepository.findByAssetId.mockResolvedValue(mockAportes);

      const result = await aporteService.listByAsset('fii-1', 'FII');

      expect(result).toHaveLength(1);
      expect(mockAporteRepository.findByAssetId).toHaveBeenCalledWith('fii-1', 'FII');
    });
  });

  describe('listUserAssets', () => {
    it('should return user FIIs and RendaFixas formatted for dropdown selection', async () => {
      mockFIIRepository.findByUserId.mockResolvedValue([
        { id: 'fii-1', userId, ticker: 'MXRF11', shares: 100, averagePrice: 10.0 },
        { id: 'fii-2', userId, ticker: 'HGLG11', shares: 50, averagePrice: 150.0 },
      ]);
      mockRendaFixaRepository.findByUserId.mockResolvedValue([
        { id: 'rf-1', userId, institution: 'Nubank', rateType: 'CDI_PERCENTAGE', rateValue: 110 },
        { id: 'rf-2', userId, institution: 'XP', rateType: 'IPCA_PLUS', rateValue: 6.5 },
      ]);

      const result = await aporteService.listUserAssets(userId);

      expect(result.fii).toHaveLength(2);
      expect(result.rendaFixa).toHaveLength(2);
      expect(result.fii[0]).toEqual({ id: 'fii-1', label: 'MXRF11' });
      expect(result.fii[1]).toEqual({ id: 'fii-2', label: 'HGLG11' });
      expect(result.rendaFixa[0]).toEqual({ id: 'rf-1', label: 'Nubank - 110% CDI' });
      expect(result.rendaFixa[1]).toEqual({ id: 'rf-2', label: 'XP - 6.5% IPCA+' });
      expect(mockFIIRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockRendaFixaRepository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return empty arrays when user has no assets', async () => {
      mockFIIRepository.findByUserId.mockResolvedValue([]);
      mockRendaFixaRepository.findByUserId.mockResolvedValue([]);

      const result = await aporteService.listUserAssets(userId);

      expect(result.fii).toEqual([]);
      expect(result.rendaFixa).toEqual([]);
    });

    it('should format Renda Fixa labels correctly for CDI_PERCENTAGE type', async () => {
      mockFIIRepository.findByUserId.mockResolvedValue([]);
      mockRendaFixaRepository.findByUserId.mockResolvedValue([
        { id: 'rf-1', userId, institution: 'Banco Inter', rateType: 'CDI_PERCENTAGE', rateValue: 105 },
      ]);

      const result = await aporteService.listUserAssets(userId);

      expect(result.rendaFixa[0].label).toBe('Banco Inter - 105% CDI');
    });

    it('should format Renda Fixa labels correctly for IPCA_PLUS type', async () => {
      mockFIIRepository.findByUserId.mockResolvedValue([]);
      mockRendaFixaRepository.findByUserId.mockResolvedValue([
        { id: 'rf-2', userId, institution: 'BTG', rateType: 'IPCA_PLUS', rateValue: 7.2 },
      ]);

      const result = await aporteService.listUserAssets(userId);

      expect(result.rendaFixa[0].label).toBe('BTG - 7.2% IPCA+');
    });
  });
});
