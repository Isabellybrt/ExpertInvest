/**
 * Unit tests for useAporteViewModel.
 * Tests validation logic, registration operations, history retrieval, and toast behavior.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 13.4, 13.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAporteViewModel } from './useAporteViewModel';
import type { AporteFormData } from './useAporteViewModel';

// Mock the aporteService module
vi.mock('../services/aporteService', () => ({
  default: {
    list: vi.fn(),
    listByAsset: vi.fn(),
    create: vi.fn(),
  },
}));

import aporteService from '../services/aporteService';
import { ApiClientError } from '../services/api';

const mockedAporteService = aporteService as {
  list: ReturnType<typeof vi.fn>;
  listByAsset: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

describe('useAporteViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateForm — Renda Fixa (Req 3.1, 3.5)', () => {
    it('should return no errors for valid existing position RF aporte', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: false,
        assetId: 'asset-123',
        amount: 1000,
        date: '2024-06-15',
      });
      expect(errors).toEqual({});
    });

    it('should require date', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: false,
        assetId: 'asset-123',
        amount: 1000,
        date: '',
      });
      expect(errors.date).toBeDefined();
    });

    it('should require assetId for existing position', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: false,
        assetId: '',
        amount: 1000,
        date: '2024-06-15',
      });
      expect(errors.assetId).toBeDefined();
    });

    it('should reject amount below 0.01', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: false,
        assetId: 'asset-123',
        amount: 0,
        date: '2024-06-15',
      });
      expect(errors.amount).toContain('0,01');
    });

    it('should reject amount above 999999999.99', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: false,
        assetId: 'asset-123',
        amount: 1_000_000_000,
        date: '2024-06-15',
      });
      expect(errors.amount).toContain('999.999.999,99');
    });

    it('should require amount', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: false,
        assetId: 'asset-123',
        amount: undefined,
        date: '2024-06-15',
      });
      expect(errors.amount).toBeDefined();
    });
  });

  describe('validateForm — Renda Fixa New Position (Req 3.3)', () => {
    it('should return no errors for valid new RF position', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: true,
        amount: 5000,
        date: '2024-06-15',
        institution: 'Nubank',
        maturityDate: futureDate.toISOString().split('T')[0],
        rateType: 'CDI_PERCENTAGE',
        rateValue: 110,
      });
      expect(errors).toEqual({});
    });

    it('should require institution for new position', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: true,
        amount: 5000,
        date: '2024-06-15',
        institution: '',
        maturityDate: futureDate.toISOString().split('T')[0],
        rateType: 'CDI_PERCENTAGE',
        rateValue: 110,
      });
      expect(errors.institution).toBeDefined();
    });

    it('should reject institution longer than 100 characters', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: true,
        amount: 5000,
        date: '2024-06-15',
        institution: 'A'.repeat(101),
        maturityDate: futureDate.toISOString().split('T')[0],
        rateType: 'CDI_PERCENTAGE',
        rateValue: 110,
      });
      expect(errors.institution).toContain('100');
    });

    it('should require future maturity date', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: true,
        amount: 5000,
        date: '2024-06-15',
        institution: 'Nubank',
        maturityDate: '2020-01-01',
        rateType: 'CDI_PERCENTAGE',
        rateValue: 110,
      });
      expect(errors.maturityDate).toContain('futura');
    });

    it('should validate CDI rate between 1 and 999', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: true,
        amount: 5000,
        date: '2024-06-15',
        institution: 'Nubank',
        maturityDate: futureDate.toISOString().split('T')[0],
        rateType: 'CDI_PERCENTAGE',
        rateValue: 0,
      });
      expect(errors.rateValue).toContain('1%');
    });

    it('should validate IPCA rate between 0.01 and 99.99', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const errors = result.current.validateForm({
        assetType: 'RENDA_FIXA',
        isNewPosition: true,
        amount: 5000,
        date: '2024-06-15',
        institution: 'Nubank',
        maturityDate: futureDate.toISOString().split('T')[0],
        rateType: 'IPCA_PLUS',
        rateValue: 100,
      });
      expect(errors.rateValue).toContain('99,99');
    });
  });

  describe('validateForm — FII (Req 3.2, 3.5)', () => {
    it('should return no errors for valid existing position FII aporte', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'FII',
        isNewPosition: false,
        assetId: 'fii-123',
        shares: 10,
        pricePerShare: 100.50,
        date: '2024-06-15',
      });
      expect(errors).toEqual({});
    });

    it('should reject shares less than 1', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'FII',
        isNewPosition: false,
        assetId: 'fii-123',
        shares: 0,
        pricePerShare: 100,
        date: '2024-06-15',
      });
      expect(errors.shares).toContain('1');
    });

    it('should reject non-integer shares', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'FII',
        isNewPosition: false,
        assetId: 'fii-123',
        shares: 2.5,
        pricePerShare: 100,
        date: '2024-06-15',
      });
      expect(errors.shares).toContain('inteiro');
    });

    it('should reject pricePerShare <= 0', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'FII',
        isNewPosition: false,
        assetId: 'fii-123',
        shares: 10,
        pricePerShare: 0,
        date: '2024-06-15',
      });
      expect(errors.pricePerShare).toContain('positivo');
    });

    it('should reject negative pricePerShare', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'FII',
        isNewPosition: false,
        assetId: 'fii-123',
        shares: 10,
        pricePerShare: -5,
        date: '2024-06-15',
      });
      expect(errors.pricePerShare).toContain('positivo');
    });
  });

  describe('validateForm — FII New Position (Req 3.3)', () => {
    it('should return no errors for valid new FII position', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'FII',
        isNewPosition: true,
        shares: 50,
        pricePerShare: 10.50,
        date: '2024-06-15',
        ticker: 'MXRF11',
      });
      expect(errors).toEqual({});
    });

    it('should require ticker for new FII position', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'FII',
        isNewPosition: true,
        shares: 50,
        pricePerShare: 10.50,
        date: '2024-06-15',
        ticker: '',
      });
      expect(errors.ticker).toBeDefined();
    });

    it('should reject invalid ticker format', () => {
      const { result } = renderHook(() => useAporteViewModel());
      const errors = result.current.validateForm({
        assetType: 'FII',
        isNewPosition: true,
        shares: 50,
        pricePerShare: 10.50,
        date: '2024-06-15',
        ticker: 'abc123',
      });
      expect(errors.ticker).toContain('4 letras maiúsculas');
    });
  });

  describe('loadAportes (Req 3.4)', () => {
    it('should load aporte history', async () => {
      const mockAportes = [
        {
          id: 'a1',
          userId: 'u1',
          assetType: 'RENDA_FIXA' as const,
          rendaFixaId: 'rf1',
          fiiId: null,
          amount: 1000,
          shares: null,
          pricePerShare: null,
          operationType: 'EXISTING_POSITION' as const,
          date: '2024-06-15T00:00:00.000Z',
          createdAt: '2024-06-15T00:00:00.000Z',
        },
      ];
      mockedAporteService.list.mockResolvedValue(mockAportes);

      const { result } = renderHook(() => useAporteViewModel());

      await act(async () => {
        await result.current.loadAportes();
      });

      expect(result.current.aporteHistory).toEqual(mockAportes);
      expect(result.current.isLoading).toBe(false);
    });

    it('should show error toast on load failure', async () => {
      mockedAporteService.list.mockRejectedValue(new ApiClientError('Erro de rede', 500));

      const { result } = renderHook(() => useAporteViewModel());

      await act(async () => {
        await result.current.loadAportes();
      });

      expect(result.current.toasts.some((t) => t.type === 'error')).toBe(true);
    });
  });

  describe('loadAportesByAsset', () => {
    it('should load aportes for specific asset', async () => {
      const mockAportes = [
        {
          id: 'a2',
          userId: 'u1',
          assetType: 'FII' as const,
          rendaFixaId: null,
          fiiId: 'fii-1',
          amount: 1050,
          shares: 10,
          pricePerShare: 105,
          operationType: 'EXISTING_POSITION' as const,
          date: '2024-06-15T00:00:00.000Z',
          createdAt: '2024-06-15T00:00:00.000Z',
        },
      ];
      mockedAporteService.listByAsset.mockResolvedValue(mockAportes);

      const { result } = renderHook(() => useAporteViewModel());

      await act(async () => {
        await result.current.loadAportesByAsset('fii-1', 'FII');
      });

      expect(mockedAporteService.listByAsset).toHaveBeenCalledWith('fii-1', 'FII');
      expect(result.current.aporteHistory).toEqual(mockAportes);
    });
  });

  describe('registerAporte (Req 3.1, 3.2, 13.4, 13.5)', () => {
    it('should register RF aporte and show success toast (Req 13.4)', async () => {
      const mockResult = {
        id: 'new-aporte',
        userId: 'u1',
        assetType: 'RENDA_FIXA' as const,
        rendaFixaId: 'rf1',
        fiiId: null,
        amount: 5000,
        shares: null,
        pricePerShare: null,
        operationType: 'EXISTING_POSITION' as const,
        date: '2024-06-15T00:00:00.000Z',
        createdAt: '2024-06-15T00:00:00.000Z',
      };
      mockedAporteService.create.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useAporteViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.registerAporte({
          assetType: 'RENDA_FIXA',
          isNewPosition: false,
          assetId: 'rf1',
          amount: 5000,
          date: '2024-06-15',
        });
      });

      expect(success).toBe(true);
      expect(result.current.aporteHistory).toContainEqual(mockResult);
      expect(result.current.toasts.some((t) => t.type === 'success')).toBe(true);
    });

    it('should register FII aporte with shares and pricePerShare', async () => {
      const mockResult = {
        id: 'new-aporte-fii',
        userId: 'u1',
        assetType: 'FII' as const,
        rendaFixaId: null,
        fiiId: 'fii-1',
        amount: 1050,
        shares: 10,
        pricePerShare: 105,
        operationType: 'EXISTING_POSITION' as const,
        date: '2024-06-15T00:00:00.000Z',
        createdAt: '2024-06-15T00:00:00.000Z',
      };
      mockedAporteService.create.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useAporteViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.registerAporte({
          assetType: 'FII',
          isNewPosition: false,
          assetId: 'fii-1',
          shares: 10,
          pricePerShare: 105,
          date: '2024-06-15',
        });
      });

      expect(success).toBe(true);
      expect(mockedAporteService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          assetType: 'FII',
          assetId: 'fii-1',
          shares: 10,
          pricePerShare: 105,
        })
      );
    });

    it('should not call service when validation fails (Req 3.5)', async () => {
      const { result } = renderHook(() => useAporteViewModel());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.registerAporte({
          assetType: 'RENDA_FIXA',
          isNewPosition: false,
          assetId: '',
          amount: 0,
          date: '',
        });
      });

      expect(success).toBe(false);
      expect(mockedAporteService.create).not.toHaveBeenCalled();
      expect(Object.keys(result.current.validationErrors).length).toBeGreaterThan(0);
    });

    it('should show error toast on API failure (Req 13.5)', async () => {
      mockedAporteService.create.mockRejectedValue(
        new ApiClientError('Título não encontrado', 404)
      );

      const { result } = renderHook(() => useAporteViewModel());

      await act(async () => {
        await result.current.registerAporte({
          assetType: 'RENDA_FIXA',
          isNewPosition: false,
          assetId: 'rf1',
          amount: 1000,
          date: '2024-06-15',
        });
      });

      expect(result.current.toasts.some((t) => t.type === 'error' && t.message.includes('Título não encontrado'))).toBe(true);
    });

    it('should handle unexpected errors gracefully', async () => {
      mockedAporteService.create.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useAporteViewModel());

      await act(async () => {
        await result.current.registerAporte({
          assetType: 'RENDA_FIXA',
          isNewPosition: false,
          assetId: 'rf1',
          amount: 1000,
          date: '2024-06-15',
        });
      });

      expect(result.current.toasts.some((t) => t.type === 'error')).toBe(true);
    });

    it('should register new position RF aporte (Req 3.3)', async () => {
      const mockResult = {
        id: 'new-aporte-new-pos',
        userId: 'u1',
        assetType: 'RENDA_FIXA' as const,
        rendaFixaId: 'new-rf',
        fiiId: null,
        amount: 10000,
        shares: null,
        pricePerShare: null,
        operationType: 'NEW_POSITION' as const,
        date: '2024-06-15T00:00:00.000Z',
        createdAt: '2024-06-15T00:00:00.000Z',
      };
      mockedAporteService.create.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useAporteViewModel());
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      let success: boolean = false;
      await act(async () => {
        success = await result.current.registerAporte({
          assetType: 'RENDA_FIXA',
          isNewPosition: true,
          amount: 10000,
          date: '2024-06-15',
          institution: 'Nubank',
          maturityDate: futureDate.toISOString().split('T')[0],
          rateType: 'CDI_PERCENTAGE',
          rateValue: 110,
        });
      });

      expect(success).toBe(true);
      expect(mockedAporteService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          assetType: 'RENDA_FIXA',
          amount: 10000,
          institution: 'Nubank',
          rateType: 'CDI_PERCENTAGE',
          rateValue: 110,
        })
      );
    });

    it('should register new position FII aporte (Req 3.3)', async () => {
      const mockResult = {
        id: 'new-aporte-new-fii',
        userId: 'u1',
        assetType: 'FII' as const,
        rendaFixaId: null,
        fiiId: 'new-fii',
        amount: 525,
        shares: 50,
        pricePerShare: 10.50,
        operationType: 'NEW_POSITION' as const,
        date: '2024-06-15T00:00:00.000Z',
        createdAt: '2024-06-15T00:00:00.000Z',
      };
      mockedAporteService.create.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useAporteViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.registerAporte({
          assetType: 'FII',
          isNewPosition: true,
          shares: 50,
          pricePerShare: 10.50,
          date: '2024-06-15',
          ticker: 'MXRF11',
        });
      });

      expect(success).toBe(true);
      expect(mockedAporteService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          assetType: 'FII',
          shares: 50,
          pricePerShare: 10.50,
          ticker: 'MXRF11',
        })
      );
    });
  });

  describe('toast management', () => {
    it('should dismiss toast by id', async () => {
      mockedAporteService.create.mockResolvedValue({
        id: 'a1',
        userId: 'u1',
        assetType: 'RENDA_FIXA',
        rendaFixaId: 'rf1',
        fiiId: null,
        amount: 1000,
        shares: null,
        pricePerShare: null,
        operationType: 'EXISTING_POSITION',
        date: '2024-06-15T00:00:00.000Z',
        createdAt: '2024-06-15T00:00:00.000Z',
      });

      const { result } = renderHook(() => useAporteViewModel());

      await act(async () => {
        await result.current.registerAporte({
          assetType: 'RENDA_FIXA',
          isNewPosition: false,
          assetId: 'rf1',
          amount: 1000,
          date: '2024-06-15',
        });
      });

      const toastId = result.current.toasts[0]?.id;
      expect(toastId).toBeDefined();

      await act(async () => {
        result.current.dismissToast(toastId!);
      });

      expect(result.current.toasts).toEqual([]);
    });
  });

  describe('clearValidationErrors', () => {
    it('should clear all validation errors', async () => {
      const { result } = renderHook(() => useAporteViewModel());

      // Trigger validation errors
      await act(async () => {
        await result.current.registerAporte({
          assetType: 'RENDA_FIXA',
          isNewPosition: false,
          assetId: '',
          amount: undefined,
          date: '',
        });
      });

      expect(Object.keys(result.current.validationErrors).length).toBeGreaterThan(0);

      await act(async () => {
        result.current.clearValidationErrors();
      });

      expect(result.current.validationErrors).toEqual({});
    });
  });
});
