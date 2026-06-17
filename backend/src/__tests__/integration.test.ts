import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AporteService } from '../services/aporte.service.js';
import { DashboardService } from '../services/dashboard.service.js';
import { ExportService } from '../services/export.service.js';
import { AuthService, AuthError } from '../services/auth.service.js';
import { CalculationService } from '../services/calculation.service.js';
import { isSessionExpired } from '../middleware/auth.middleware.js';

// Mock withTransaction to execute callback directly (no real DB)
vi.mock('../repositories/index.js', () => ({
  withTransaction: async (fn: any) => fn({}),
}));

// Mock bcrypt and jwt for AuthService
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
    verify: vi.fn().mockReturnValue({ userId: 'user-1', email: 'user@test.com', sessionId: 'session-1' }),
  },
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: vi.fn(),
  })),
}));

/**
 * Integration tests verifying service-to-service interactions.
 * These tests mock repositories but exercise real service logic end-to-end.
 *
 * Validates: Requirements 14.1, 14.3, 14.5, 3.1, 3.2, 15.1
 */
describe('Integration Tests: Critical Flows', () => {
  // === Shared mock repositories ===
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

  const mockMarketIndexRepository = {
    getLatest: vi.fn(),
    upsert: vi.fn(),
  };

  const mockUserRepository = {
    create: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findSession: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    updateSessionActivity: vi.fn(),
    updateLoginAttempts: vi.fn(),
  };

  const mockCronService = {
    getCachedQuote: vi.fn().mockReturnValue(null),
    getCachedDividend: vi.fn().mockReturnValue(null),
    scheduleQuoteUpdate: vi.fn(),
    executeQuoteUpdate: vi.fn(),
    getLastExecution: vi.fn(),
  };

  const userId = 'user-integration-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===================================================================
  // Flow 1: Login → Dashboard access → Asset creation → Dashboard update
  // Validates: Requirements 14.1, 14.3, 3.1
  // ===================================================================
  describe('Flow 1: Login → Dashboard → Asset creation → Dashboard update', () => {
    it('should allow an authenticated user to create a Renda Fixa asset and see it reflected in the dashboard', async () => {
      // --- Step 1: Simulate successful login (AuthService) ---
      // Mock user found with valid password
      mockUserRepository.findByEmail.mockResolvedValue({
        id: userId,
        email: 'user@test.com',
        name: 'Test User',
        passwordHash: 'hashed-password',
        googleId: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      mockUserRepository.createSession.mockResolvedValue({
        id: 'session-1',
        userId,
        token: 'mock-session-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastActivity: new Date(),
      });

      // Set env vars for AuthService
      process.env.JWT_SECRET = 'test-secret';
      process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

      const authService = new AuthService(mockUserRepository as any);
      const loginResult = await authService.login('user@test.com', 'Password1');

      expect(loginResult.accessToken).toBeDefined();
      expect(loginResult.user.id).toBe(userId);

      // --- Step 2: Access Dashboard (initially empty) ---
      const calculationService = new CalculationService();
      const dashboardService = new DashboardService({
        calculationService,
        cronService: mockCronService as any,
        fiiRepository: mockFIIRepository as any,
        rendaFixaRepository: mockRendaFixaRepository as any,
        marketIndexRepository: mockMarketIndexRepository as any,
      });

      mockRendaFixaRepository.findByUserId.mockResolvedValue([]);
      mockFIIRepository.findByUserId.mockResolvedValue([]);
      mockMarketIndexRepository.getLatest.mockResolvedValue({ value: 0.0004 });

      const emptySummary = await dashboardService.getSummary(userId);
      expect(emptySummary.totalPatrimony).toBe(0);

      // --- Step 3: Create Renda Fixa asset via AporteService ---
      const aporteService = new AporteService(
        mockAporteRepository as any,
        mockRendaFixaRepository as any,
        mockFIIRepository as any
      );

      const newRFId = 'rf-new-001';
      mockRendaFixaRepository.create.mockResolvedValue({
        id: newRFId,
        userId,
        institution: 'Banco Inter',
        investedAmount: 10000,
        maturityDate: new Date('2027-01-01'),
        rateType: 'CDI_PERCENTAGE',
        rateValue: 110,
        ipcaPlusRate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockAporteRepository.create.mockResolvedValue({
        id: 'aporte-new-1',
        userId,
        assetType: 'RENDA_FIXA',
        rendaFixaId: newRFId,
        fiiId: null,
        amount: 10000,
        shares: null,
        pricePerShare: null,
        operationType: 'NEW_POSITION',
        date: new Date('2024-06-01T00:00:00.000Z'),
        createdAt: new Date(),
      });

      const aporteResult = await aporteService.registerAporte(userId, {
        assetType: 'RENDA_FIXA',
        amount: 10000,
        date: '2024-06-01T00:00:00.000Z',
        institution: 'Banco Inter',
        maturityDate: '2027-01-01T00:00:00.000Z',
        rateType: 'CDI_PERCENTAGE',
        rateValue: 110,
      });

      expect(aporteResult.operationType).toBe('NEW_POSITION');
      expect(aporteResult.amount).toBe(10000);

      // --- Step 4: Dashboard reflects the new asset ---
      mockRendaFixaRepository.findByUserId.mockResolvedValue([
        {
          id: newRFId,
          userId,
          institution: 'Banco Inter',
          investedAmount: 10000,
          maturityDate: new Date('2027-01-01'),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 110,
          ipcaPlusRate: null,
          createdAt: new Date('2024-06-01'),
          updatedAt: new Date(),
        },
      ]);

      const updatedSummary = await dashboardService.getSummary(userId);
      expect(updatedSummary.totalPatrimony).toBeGreaterThan(0);
      expect(updatedSummary.rendaFixaTotal).toBeGreaterThanOrEqual(10000);
      expect(updatedSummary.rendaFixaPercentage).toBe(100);
      expect(updatedSummary.fiiPercentage).toBe(0);
    });
  });

  // ===================================================================
  // Flow 2: Aporte registration with balance/average price update
  // Validates: Requirements 3.1, 3.2
  // ===================================================================
  describe('Flow 2: Aporte with balance and average price updates', () => {
    let aporteService: AporteService;

    beforeEach(() => {
      aporteService = new AporteService(
        mockAporteRepository as any,
        mockRendaFixaRepository as any,
        mockFIIRepository as any
      );
    });

    it('should increase Renda Fixa balance when aporte is registered (Req 3.1)', async () => {
      const rfId = '11111111-1111-1111-1111-111111111111';
      const initialBalance = 5000;
      const aporteAmount = 2000;

      // Existing RF position
      mockRendaFixaRepository.findById.mockResolvedValue({
        id: rfId,
        userId,
        institution: 'Nubank',
        investedAmount: initialBalance,
        maturityDate: new Date('2026-06-01'),
        rateType: 'CDI_PERCENTAGE',
        rateValue: 100,
        ipcaPlusRate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRendaFixaRepository.update.mockResolvedValue({
        id: rfId,
        investedAmount: initialBalance + aporteAmount,
      });

      mockAporteRepository.create.mockResolvedValue({
        id: 'aporte-rf-01',
        userId,
        assetType: 'RENDA_FIXA',
        rendaFixaId: rfId,
        fiiId: null,
        amount: aporteAmount,
        shares: null,
        pricePerShare: null,
        operationType: 'EXISTING_POSITION',
        date: new Date('2024-07-01T00:00:00.000Z'),
        createdAt: new Date(),
      });

      const result = await aporteService.registerAporte(userId, {
        assetType: 'RENDA_FIXA',
        assetId: rfId,
        amount: aporteAmount,
        date: '2024-07-01T00:00:00.000Z',
      });

      // Verify balance was updated to old + new
      expect(mockRendaFixaRepository.update).toHaveBeenCalledWith(
        rfId,
        { investedAmount: initialBalance + aporteAmount },
        expect.anything()
      );
      expect(result.amount).toBe(aporteAmount);
      expect(result.operationType).toBe('EXISTING_POSITION');
    });

    it('should recalculate FII average price on aporte (Req 3.2)', async () => {
      const fiiId = '22222222-2222-2222-2222-222222222222';
      const existingShares = 200;
      const existingAvgPrice = 12.50;
      const newShares = 100;
      const newPrice = 15.00;

      // Expected: (200*12.50 + 100*15.00) / (200+100) = (2500 + 1500) / 300 = 13.333...
      const expectedNewAvg = (existingShares * existingAvgPrice + newShares * newPrice) / (existingShares + newShares);

      mockFIIRepository.findById.mockResolvedValue({
        id: fiiId,
        userId,
        ticker: 'HGLG11',
        shares: existingShares,
        averagePrice: existingAvgPrice,
        purchaseDate: new Date('2024-01-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
        quotes: [],
        dividends: [],
      });

      mockFIIRepository.update.mockResolvedValue({
        id: fiiId,
        shares: existingShares + newShares,
        averagePrice: expectedNewAvg,
      });

      mockAporteRepository.create.mockResolvedValue({
        id: 'aporte-fii-01',
        userId,
        assetType: 'FII',
        rendaFixaId: null,
        fiiId,
        amount: newShares * newPrice,
        shares: newShares,
        pricePerShare: newPrice,
        operationType: 'EXISTING_POSITION',
        date: new Date('2024-07-01T00:00:00.000Z'),
        createdAt: new Date(),
      });

      const result = await aporteService.registerAporte(userId, {
        assetType: 'FII',
        assetId: fiiId,
        shares: newShares,
        pricePerShare: newPrice,
        date: '2024-07-01T00:00:00.000Z',
      });

      // Verify average price recalculation
      expect(mockFIIRepository.update).toHaveBeenCalledWith(
        fiiId,
        {
          shares: existingShares + newShares,
          averagePrice: expect.closeTo(expectedNewAvg, 4),
        },
        expect.anything()
      );
      expect(result.shares).toBe(newShares);
      expect(result.pricePerShare).toBe(newPrice);
      expect(result.amount).toBe(newShares * newPrice);
    });
  });

  // ===================================================================
  // Flow 3: Export generation with real data
  // Validates: Requirement 15.1
  // ===================================================================
  describe('Flow 3: Export generation with both RF and FII aportes', () => {
    it('should generate correct export rows for a user with both RF and FII positions', async () => {
      const rfId = 'rf-export-001';
      const fiiId = 'fii-export-001';

      // Mock aportes data - user has both RF and FII aportes
      mockAporteRepository.findByUserId.mockResolvedValue([
        {
          id: 'aporte-e1',
          userId,
          assetType: 'RENDA_FIXA',
          rendaFixaId: rfId,
          fiiId: null,
          amount: 5000,
          shares: null,
          pricePerShare: null,
          operationType: 'NEW_POSITION',
          date: new Date('2024-03-15'),
          createdAt: new Date(),
        },
        {
          id: 'aporte-e2',
          userId,
          assetType: 'FII',
          rendaFixaId: null,
          fiiId,
          amount: 1500,
          shares: 10,
          pricePerShare: 150,
          operationType: 'NEW_POSITION',
          date: new Date('2024-04-20'),
          createdAt: new Date(),
        },
      ]);

      // Mock RF positions
      mockRendaFixaRepository.findByUserId.mockResolvedValue([
        {
          id: rfId,
          userId,
          institution: 'XP Investimentos',
          investedAmount: 5000,
          maturityDate: new Date('2026-03-15'),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 105,
          ipcaPlusRate: null,
          createdAt: new Date('2024-03-15'),
          updatedAt: new Date(),
        },
      ]);

      // Mock FII positions with a quote
      mockFIIRepository.findByUserId.mockResolvedValue([
        {
          id: fiiId,
          userId,
          ticker: 'XPML11',
          shares: 10,
          averagePrice: 150,
          purchaseDate: new Date('2024-04-20'),
          createdAt: new Date('2024-04-20'),
          updatedAt: new Date(),
          quotes: [{ price: 155, updatedAt: new Date() }],
          dividends: [],
        },
      ]);

      // Mock market indexes
      mockMarketIndexRepository.getLatest
        .mockResolvedValueOnce({ value: 0.0004 })  // CDI
        .mockResolvedValueOnce({ value: 0.045 });  // IPCA

      const calculationService = new CalculationService();
      const exportService = new ExportService(
        mockRendaFixaRepository as any,
        mockFIIRepository as any,
        mockAporteRepository as any,
        mockMarketIndexRepository as any,
        calculationService
      );

      const rows = await exportService.getExportRows(userId);

      // Should have 2 rows (one per aporte)
      expect(rows).toHaveLength(2);

      // First row: Renda Fixa aporte
      const rfRow = rows[0];
      expect(rfRow.date).toBe('2024-03-15');
      expect(rfRow.assetName).toBe('XP Investimentos');
      expect(rfRow.assetType).toBe('Renda_Fixa');
      expect(rfRow.investedAmount).toBe('5000.00');
      expect(rfRow.shares).toBe('');
      // currentBalance should be >= investedAmount (projection)
      expect(parseFloat(rfRow.currentBalance)).toBeGreaterThanOrEqual(5000);

      // Second row: FII aporte
      const fiiRow = rows[1];
      expect(fiiRow.date).toBe('2024-04-20');
      expect(fiiRow.assetName).toBe('XPML11');
      expect(fiiRow.assetType).toBe('FII');
      expect(fiiRow.investedAmount).toBe('1500.00');
      expect(fiiRow.shares).toBe('10');
      // currentBalance = 10 shares * 155 (latest quote price) = 1550
      expect(fiiRow.currentBalance).toBe('1550.00');
    });
  });

  // ===================================================================
  // Flow 4: Session expiration redirect
  // Validates: Requirement 14.5 (session inactivity > 30 min)
  // ===================================================================
  describe('Flow 4: Session expiration after 30 minutes of inactivity', () => {
    it('should reject a session that has been inactive for more than 30 minutes', () => {
      // Session last active 31 minutes ago
      const lastActivity = new Date(Date.now() - 31 * 60 * 1000);
      expect(isSessionExpired(lastActivity)).toBe(true);
    });

    it('should accept a session that has been inactive for less than 30 minutes', () => {
      // Session last active 10 minutes ago
      const lastActivity = new Date(Date.now() - 10 * 60 * 1000);
      expect(isSessionExpired(lastActivity)).toBe(false);
    });

    it('should accept a session that is exactly at the 30-minute boundary', () => {
      // Session last active exactly 30 minutes ago (boundary)
      const lastActivity = new Date(Date.now() - 30 * 60 * 1000);
      // At exactly 30 min the comparison is > not >=, so it should NOT be expired
      expect(isSessionExpired(lastActivity)).toBe(false);
    });

    it('should reject expired session via AuthService.validateSession', async () => {
      process.env.JWT_SECRET = 'test-secret';
      process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

      // Session with lastActivity 35 minutes ago
      const expiredLastActivity = new Date(Date.now() - 35 * 60 * 1000);

      mockUserRepository.findSession.mockResolvedValue({
        id: 'session-expired',
        userId,
        token: 'mock-session-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastActivity: expiredLastActivity,
        user: { id: userId, email: 'user@test.com', name: 'Test User' },
      });
      mockUserRepository.deleteSession.mockResolvedValue(undefined);

      const authService = new AuthService(mockUserRepository as any);

      await expect(authService.validateSession('mock-jwt-token')).rejects.toThrow(AuthError);
      await expect(authService.validateSession('mock-jwt-token')).rejects.toMatchObject({
        code: 'SESSION_EXPIRED',
      });
    });

    it('should accept valid session via AuthService.validateSession and update activity', async () => {
      process.env.JWT_SECRET = 'test-secret';
      process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

      // Session with lastActivity 5 minutes ago (valid)
      const recentActivity = new Date(Date.now() - 5 * 60 * 1000);

      mockUserRepository.findSession.mockResolvedValue({
        id: 'session-valid',
        userId,
        token: 'mock-session-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastActivity: recentActivity,
        user: { id: userId, email: 'user@test.com', name: 'Test User' },
      });
      mockUserRepository.updateSessionActivity.mockResolvedValue(undefined);

      const authService = new AuthService(mockUserRepository as any);
      const session = await authService.validateSession('mock-jwt-token');

      expect(session.userId).toBe(userId);
      expect(session.email).toBe('user@test.com');
      // Verify activity was updated
      expect(mockUserRepository.updateSessionActivity).toHaveBeenCalledWith('session-valid');
    });
  });
});
