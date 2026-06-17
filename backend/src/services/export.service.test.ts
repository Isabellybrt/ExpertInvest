import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService, ExportTimeoutError } from './export.service.js';

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

describe('ExportService', () => {
  let exportService: ExportService;
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    exportService = new ExportService(
      mockRendaFixaRepo as any,
      mockFiiRepo as any,
      mockAporteRepo as any,
      mockMarketIndexRepo as any,
      mockCalculationService as any
    );
  });

  const setupMockData = () => {
    const rfAsset = {
      id: 'rf-1',
      userId,
      institution: 'Banco XYZ',
      investedAmount: 10000,
      maturityDate: new Date('2026-01-01'),
      rateType: 'CDI_PERCENTAGE' as const,
      rateValue: 110,
      ipcaPlusRate: null,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
    };

    const fiiAsset = {
      id: 'fii-1',
      userId,
      ticker: 'MXRF11',
      shares: 100,
      averagePrice: 10.50,
      purchaseDate: new Date('2024-02-01'),
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
      quotes: [{ id: 'q-1', fiiId: 'fii-1', price: 11.00, sourceDate: new Date(), updatedAt: new Date() }],
      dividends: [{ id: 'd-1', fiiId: 'fii-1', dividendPerShare: 0.10, dividendYield: 0.91, paymentDate: new Date(), updatedAt: new Date() }],
    };

    const aportes = [
      {
        id: 'ap-1',
        userId,
        assetType: 'RENDA_FIXA' as const,
        rendaFixaId: 'rf-1',
        fiiId: null,
        amount: 10000,
        shares: null,
        pricePerShare: null,
        operationType: 'NEW_POSITION' as const,
        date: new Date('2024-01-15'),
        createdAt: new Date('2024-01-15'),
      },
      {
        id: 'ap-2',
        userId,
        assetType: 'FII' as const,
        rendaFixaId: null,
        fiiId: 'fii-1',
        amount: 1050,
        shares: 100,
        pricePerShare: 10.50,
        operationType: 'NEW_POSITION' as const,
        date: new Date('2024-02-01'),
        createdAt: new Date('2024-02-01'),
      },
    ];

    mockAporteRepo.findByUserId.mockResolvedValue(aportes);
    mockRendaFixaRepo.findByUserId.mockResolvedValue([rfAsset]);
    mockFiiRepo.findByUserId.mockResolvedValue([fiiAsset]);
    mockMarketIndexRepo.getLatest.mockImplementation((type: string) => {
      if (type === 'CDI') return Promise.resolve({ value: 0.000489, date: new Date() });
      if (type === 'IPCA') return Promise.resolve({ value: 0.04, date: new Date() });
      return Promise.resolve(null);
    });
    mockCalculationService.calculateRendaFixaProjection.mockReturnValue({
      projectedBalance: 10523.45,
      grossReturn: 523.45,
      dailyRate: 0.000538,
      businessDays: 250,
    });

    return { rfAsset, fiiAsset, aportes };
  };

  describe('getExportRows', () => {
    it('should return correct rows for portfolio with RF and FII aportes', async () => {
      setupMockData();

      const rows = await exportService.getExportRows(userId);

      expect(rows).toHaveLength(2);

      // RF aporte row
      expect(rows[0]).toEqual({
        date: '2024-01-15',
        assetName: 'Banco XYZ',
        assetType: 'Renda_Fixa',
        investedAmount: '10000.00',
        shares: '',
        currentBalance: '10523.45',
      });

      // FII aporte row
      expect(rows[1]).toEqual({
        date: '2024-02-01',
        assetName: 'MXRF11',
        assetType: 'FII',
        investedAmount: '1050.00',
        shares: '100',
        currentBalance: '1100.00',
      });
    });

    it('should return empty array for user with no aportes', async () => {
      mockAporteRepo.findByUserId.mockResolvedValue([]);
      mockRendaFixaRepo.findByUserId.mockResolvedValue([]);
      mockFiiRepo.findByUserId.mockResolvedValue([]);
      mockMarketIndexRepo.getLatest.mockResolvedValue(null);

      const rows = await exportService.getExportRows(userId);

      expect(rows).toHaveLength(0);
    });

    it('should use averagePrice as fallback when FII has no quotes', async () => {
      const fiiNoQuotes = {
        id: 'fii-2',
        userId,
        ticker: 'HGLG11',
        shares: 50,
        averagePrice: 160.00,
        purchaseDate: new Date('2024-03-01'),
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date('2024-03-01'),
        quotes: [],
        dividends: [],
      };

      const aporte = {
        id: 'ap-3',
        userId,
        assetType: 'FII' as const,
        rendaFixaId: null,
        fiiId: 'fii-2',
        amount: 8000,
        shares: 50,
        pricePerShare: 160.00,
        operationType: 'NEW_POSITION' as const,
        date: new Date('2024-03-01'),
        createdAt: new Date('2024-03-01'),
      };

      mockAporteRepo.findByUserId.mockResolvedValue([aporte]);
      mockRendaFixaRepo.findByUserId.mockResolvedValue([]);
      mockFiiRepo.findByUserId.mockResolvedValue([fiiNoQuotes]);
      mockMarketIndexRepo.getLatest.mockResolvedValue(null);

      const rows = await exportService.getExportRows(userId);

      expect(rows[0]!.currentBalance).toBe('8000.00'); // 50 * 160.00
      expect(rows[0]!.assetName).toBe('HGLG11');
    });
  });

  describe('generateCSV', () => {
    it('should generate valid CSV buffer with correct headers and data', async () => {
      setupMockData();

      const buffer = await exportService.generateCSV(userId);

      expect(buffer).toBeInstanceOf(Buffer);
      const csvContent = buffer.toString('utf-8');

      // Check headers
      expect(csvContent).toContain('date');
      expect(csvContent).toContain('asset name');
      expect(csvContent).toContain('type');
      expect(csvContent).toContain('invested amount');
      expect(csvContent).toContain('shares');
      expect(csvContent).toContain('current balance');

      // Check data rows
      expect(csvContent).toContain('2024-01-15');
      expect(csvContent).toContain('Banco XYZ');
      expect(csvContent).toContain('Renda_Fixa');
      expect(csvContent).toContain('10000.00');
      expect(csvContent).toContain('10523.45');

      expect(csvContent).toContain('2024-02-01');
      expect(csvContent).toContain('MXRF11');
      expect(csvContent).toContain('FII');
      expect(csvContent).toContain('1050.00');
      expect(csvContent).toContain('100');
      expect(csvContent).toContain('1100.00');
    });

    it('should generate empty CSV (header only) for user with no data', async () => {
      mockAporteRepo.findByUserId.mockResolvedValue([]);
      mockRendaFixaRepo.findByUserId.mockResolvedValue([]);
      mockFiiRepo.findByUserId.mockResolvedValue([]);
      mockMarketIndexRepo.getLatest.mockResolvedValue(null);

      const buffer = await exportService.generateCSV(userId);
      const csvContent = buffer.toString('utf-8');

      expect(csvContent).toContain('date');
      // Only header, no data lines beyond the header
      const lines = csvContent.trim().split('\n');
      expect(lines).toHaveLength(1);
    });
  });

  describe('generateExcel', () => {
    it('should generate valid Excel buffer', async () => {
      setupMockData();

      const buffer = await exportService.generateExcel(userId);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should generate Excel with correct data by parsing workbook', async () => {
      setupMockData();

      const buffer = await exportService.generateExcel(userId);

      // Parse the generated Excel to verify content
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.default.Workbook();
      await workbook.xlsx.load(buffer as any);

      const worksheet = workbook.getWorksheet('Portfolio');
      expect(worksheet).toBeDefined();

      // Check header row
      const headerRow = worksheet!.getRow(1);
      expect(headerRow.getCell(1).value).toBe('date');
      expect(headerRow.getCell(2).value).toBe('asset name');
      expect(headerRow.getCell(3).value).toBe('type');
      expect(headerRow.getCell(4).value).toBe('invested amount');
      expect(headerRow.getCell(5).value).toBe('shares');
      expect(headerRow.getCell(6).value).toBe('current balance');

      // Check data rows (header + 2 data rows)
      expect(worksheet!.rowCount).toBe(3);

      const row1 = worksheet!.getRow(2);
      expect(row1.getCell(1).value).toBe('2024-01-15');
      expect(row1.getCell(2).value).toBe('Banco XYZ');
      expect(row1.getCell(3).value).toBe('Renda_Fixa');
      expect(row1.getCell(4).value).toBe('10000.00');
      expect(row1.getCell(5).value).toBe('');
      expect(row1.getCell(6).value).toBe('10523.45');

      const row2 = worksheet!.getRow(3);
      expect(row2.getCell(1).value).toBe('2024-02-01');
      expect(row2.getCell(2).value).toBe('MXRF11');
      expect(row2.getCell(3).value).toBe('FII');
      expect(row2.getCell(4).value).toBe('1050.00');
      expect(row2.getCell(5).value).toBe('100');
      expect(row2.getCell(6).value).toBe('1100.00');
    });
  });

  describe('timeout handling', () => {
    it('should throw ExportTimeoutError if operation exceeds 30 seconds', async () => {
      // Mock a slow operation that never resolves within the timeout
      mockAporteRepo.findByUserId.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve([]), 35_000))
      );
      mockRendaFixaRepo.findByUserId.mockResolvedValue([]);
      mockFiiRepo.findByUserId.mockResolvedValue([]);
      mockMarketIndexRepo.getLatest.mockResolvedValue(null);

      await expect(exportService.generateCSV(userId)).rejects.toThrow(ExportTimeoutError);
    }, 35_000);
  });

  describe('date formatting', () => {
    it('should format dates in ISO 8601 YYYY-MM-DD format', async () => {
      const aporte = {
        id: 'ap-4',
        userId,
        assetType: 'RENDA_FIXA' as const,
        rendaFixaId: 'rf-1',
        fiiId: null,
        amount: 5000,
        shares: null,
        pricePerShare: null,
        operationType: 'EXISTING_POSITION' as const,
        date: new Date('2024-12-05T14:30:00Z'),
        createdAt: new Date('2024-12-05'),
      };

      const rfAsset = {
        id: 'rf-1',
        userId,
        institution: 'Banco ABC',
        investedAmount: 5000,
        maturityDate: new Date('2026-06-01'),
        rateType: 'CDI_PERCENTAGE' as const,
        rateValue: 100,
        ipcaPlusRate: null,
        createdAt: new Date('2024-12-05'),
        updatedAt: new Date('2024-12-05'),
      };

      mockAporteRepo.findByUserId.mockResolvedValue([aporte]);
      mockRendaFixaRepo.findByUserId.mockResolvedValue([rfAsset]);
      mockFiiRepo.findByUserId.mockResolvedValue([]);
      mockMarketIndexRepo.getLatest.mockResolvedValue(null);
      mockCalculationService.calculateRendaFixaProjection.mockReturnValue({
        projectedBalance: 5100.00,
        grossReturn: 100.00,
        dailyRate: 0.0004,
        businessDays: 50,
      });

      const rows = await exportService.getExportRows(userId);

      // Verify date is in YYYY-MM-DD format
      expect(rows[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('decimal precision', () => {
    it('should format investedAmount and currentBalance with exactly 2 decimal places', async () => {
      const aporte = {
        id: 'ap-5',
        userId,
        assetType: 'RENDA_FIXA' as const,
        rendaFixaId: 'rf-2',
        fiiId: null,
        amount: 1234.5,
        shares: null,
        pricePerShare: null,
        operationType: 'NEW_POSITION' as const,
        date: new Date('2024-06-15'),
        createdAt: new Date('2024-06-15'),
      };

      const rfAsset = {
        id: 'rf-2',
        userId,
        institution: 'Corretora ABC',
        investedAmount: 1234.5,
        maturityDate: new Date('2025-12-31'),
        rateType: 'CDI_PERCENTAGE' as const,
        rateValue: 105,
        ipcaPlusRate: null,
        createdAt: new Date('2024-06-15'),
        updatedAt: new Date('2024-06-15'),
      };

      mockAporteRepo.findByUserId.mockResolvedValue([aporte]);
      mockRendaFixaRepo.findByUserId.mockResolvedValue([rfAsset]);
      mockFiiRepo.findByUserId.mockResolvedValue([]);
      mockMarketIndexRepo.getLatest.mockResolvedValue(null);
      mockCalculationService.calculateRendaFixaProjection.mockReturnValue({
        projectedBalance: 1300.1,
        grossReturn: 65.6,
        dailyRate: 0.0005,
        businessDays: 100,
      });

      const rows = await exportService.getExportRows(userId);

      expect(rows[0]!.investedAmount).toBe('1234.50');
      expect(rows[0]!.currentBalance).toBe('1300.10');
    });
  });
});
