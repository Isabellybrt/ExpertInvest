/**
 * Unit tests for useRendaFixaViewModel.
 * Tests form validation, CRUD actions, toast notifications, and delete confirmation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRendaFixaViewModel } from './useRendaFixaViewModel';

// Mock the rendaFixaService
vi.mock('../services/rendaFixaService', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the api module for ApiClientError
vi.mock('../services/api', () => ({
  ApiClientError: class ApiClientError extends Error {
    status: number;
    errors?: Record<string, string[]>;
    constructor(message: string, status: number, errors?: Record<string, string[]>) {
      super(message);
      this.name = 'ApiClientError';
      this.status = status;
      this.errors = errors;
    }
  },
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import rendaFixaService from '../services/rendaFixaService';
import { ApiClientError } from '../services/api';

const mockedService = rendaFixaService as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('useRendaFixaViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedService.list.mockResolvedValue([]);
  });

  describe('validateForm', () => {
    it('should return success for valid data', () => {
      const { result } = renderHook(() => useRendaFixaViewModel());

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      let validation: { success: boolean; errors: Record<string, string> };
      act(() => {
        validation = result.current.validateForm({
          institution: 'Banco Inter',
          investedAmount: 10000,
          maturityDate: futureDate.toISOString(),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 110,
        });
      });

      expect(validation!.success).toBe(true);
      expect(validation!.errors).toEqual({});
      expect(result.current.validationErrors).toEqual({});
    });

    it('should reject empty institution', () => {
      const { result } = renderHook(() => useRendaFixaViewModel());

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      let validation: { success: boolean; errors: Record<string, string> };
      act(() => {
        validation = result.current.validateForm({
          institution: '',
          investedAmount: 10000,
          maturityDate: futureDate.toISOString(),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 110,
        });
      });

      expect(validation!.success).toBe(false);
      expect(validation!.errors.institution).toBeDefined();
      expect(result.current.validationErrors.institution).toBeDefined();
    });

    it('should reject investedAmount <= 0', () => {
      const { result } = renderHook(() => useRendaFixaViewModel());

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      let validation: { success: boolean; errors: Record<string, string> };
      act(() => {
        validation = result.current.validateForm({
          institution: 'Banco',
          investedAmount: 0,
          maturityDate: futureDate.toISOString(),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 110,
        });
      });

      expect(validation!.success).toBe(false);
      expect(validation!.errors.investedAmount).toBeDefined();
    });

    it('should reject past maturity date', () => {
      const { result } = renderHook(() => useRendaFixaViewModel());

      const pastDate = new Date('2020-01-01');

      let validation: { success: boolean; errors: Record<string, string> };
      act(() => {
        validation = result.current.validateForm({
          institution: 'Banco',
          investedAmount: 10000,
          maturityDate: pastDate.toISOString(),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 110,
        });
      });

      expect(validation!.success).toBe(false);
      expect(validation!.errors.maturityDate).toBeDefined();
    });

    it('should reject CDI rate outside valid range (< 1)', () => {
      const { result } = renderHook(() => useRendaFixaViewModel());

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      let validation: { success: boolean; errors: Record<string, string> };
      act(() => {
        validation = result.current.validateForm({
          institution: 'Banco',
          investedAmount: 10000,
          maturityDate: futureDate.toISOString(),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 0.5,
        });
      });

      expect(validation!.success).toBe(false);
    });

    it('should reject IPCA+ rate outside valid range (> 99.99)', () => {
      const { result } = renderHook(() => useRendaFixaViewModel());

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      let validation: { success: boolean; errors: Record<string, string> };
      act(() => {
        validation = result.current.validateForm({
          institution: 'Banco',
          investedAmount: 10000,
          maturityDate: futureDate.toISOString(),
          rateType: 'IPCA_PLUS',
          rateValue: 100,
        });
      });

      expect(validation!.success).toBe(false);
    });
  });

  describe('createRendaFixa', () => {
    it('should create asset and add success toast', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const newAsset = {
        id: '1',
        userId: 'u1',
        institution: 'Banco Inter',
        investedAmount: 10000,
        maturityDate: futureDate.toISOString(),
        rateType: 'CDI_PERCENTAGE' as const,
        rateValue: 110,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockedService.create.mockResolvedValue(newAsset);

      const { result } = renderHook(() => useRendaFixaViewModel());

      let success: boolean;
      await act(async () => {
        success = await result.current.createRendaFixa({
          institution: 'Banco Inter',
          investedAmount: 10000,
          maturityDate: futureDate.toISOString(),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 110,
        });
      });

      expect(success!).toBe(true);
      expect(result.current.rendaFixaList).toHaveLength(1);
      expect(result.current.rendaFixaList[0].institution).toBe('Banco Inter');
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe('success');
    });

    it('should not call API when validation fails', async () => {
      const { result } = renderHook(() => useRendaFixaViewModel());

      let success: boolean;
      await act(async () => {
        success = await result.current.createRendaFixa({
          institution: '',
          investedAmount: 0,
          maturityDate: '',
          rateType: 'CDI_PERCENTAGE',
          rateValue: 0,
        });
      });

      expect(success!).toBe(false);
      expect(mockedService.create).not.toHaveBeenCalled();
      expect(Object.keys(result.current.validationErrors).length).toBeGreaterThan(0);
    });

    it('should add error toast when API call fails', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      mockedService.create.mockRejectedValue(
        new ApiClientError('Erro no servidor', 500)
      );

      const { result } = renderHook(() => useRendaFixaViewModel());

      let success: boolean;
      await act(async () => {
        success = await result.current.createRendaFixa({
          institution: 'Banco Inter',
          investedAmount: 10000,
          maturityDate: futureDate.toISOString(),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 110,
        });
      });

      expect(success!).toBe(false);
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe('error');
      expect(result.current.toasts[0].message).toBe('Erro no servidor');
    });
  });

  describe('updateRendaFixa', () => {
    it('should update asset and add success toast', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const existingAsset = {
        id: '1',
        userId: 'u1',
        institution: 'Banco Original',
        investedAmount: 5000,
        maturityDate: futureDate.toISOString(),
        rateType: 'CDI_PERCENTAGE' as const,
        rateValue: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedAsset = { ...existingAsset, institution: 'Banco Atualizado', investedAmount: 15000 };

      mockedService.list.mockResolvedValue([existingAsset]);
      mockedService.update.mockResolvedValue(updatedAsset);

      const { result } = renderHook(() => useRendaFixaViewModel());

      // Load existing assets
      await act(async () => {
        await result.current.loadRendaFixa();
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.updateRendaFixa('1', {
          institution: 'Banco Atualizado',
          investedAmount: 15000,
          maturityDate: futureDate.toISOString(),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 100,
        });
      });

      expect(success!).toBe(true);
      expect(result.current.rendaFixaList[0].institution).toBe('Banco Atualizado');
      expect(result.current.toasts.some((t) => t.type === 'success')).toBe(true);
    });
  });

  describe('delete confirmation flow', () => {
    it('should open confirmation modal on requestDelete', () => {
      const { result } = renderHook(() => useRendaFixaViewModel());

      act(() => {
        result.current.requestDelete('1', 'Banco Inter');
      });

      expect(result.current.deleteConfirm).toEqual({
        isOpen: true,
        id: '1',
        institution: 'Banco Inter',
      });
    });

    it('should close modal on cancelDelete without deleting', () => {
      const { result } = renderHook(() => useRendaFixaViewModel());

      act(() => {
        result.current.requestDelete('1', 'Banco Inter');
      });

      act(() => {
        result.current.cancelDelete();
      });

      expect(result.current.deleteConfirm).toBeNull();
      expect(mockedService.delete).not.toHaveBeenCalled();
    });

    it('should delete asset on confirmDelete and add success toast', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const asset = {
        id: '1',
        userId: 'u1',
        institution: 'Banco Inter',
        investedAmount: 10000,
        maturityDate: futureDate.toISOString(),
        rateType: 'CDI_PERCENTAGE' as const,
        rateValue: 110,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockedService.list.mockResolvedValue([asset]);
      mockedService.delete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRendaFixaViewModel());

      await act(async () => {
        await result.current.loadRendaFixa();
      });

      expect(result.current.rendaFixaList).toHaveLength(1);

      act(() => {
        result.current.requestDelete('1', 'Banco Inter');
      });

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockedService.delete).toHaveBeenCalledWith('1');
      expect(result.current.rendaFixaList).toHaveLength(0);
      expect(result.current.deleteConfirm).toBeNull();
      expect(result.current.toasts.some((t) => t.type === 'success')).toBe(true);
    });
  });

  describe('dismissToast', () => {
    it('should remove toast by id', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const newAsset = {
        id: '1',
        userId: 'u1',
        institution: 'Banco Inter',
        investedAmount: 10000,
        maturityDate: futureDate.toISOString(),
        rateType: 'CDI_PERCENTAGE' as const,
        rateValue: 110,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockedService.create.mockResolvedValue(newAsset);

      const { result } = renderHook(() => useRendaFixaViewModel());

      await act(async () => {
        await result.current.createRendaFixa({
          institution: 'Banco Inter',
          investedAmount: 10000,
          maturityDate: futureDate.toISOString(),
          rateType: 'CDI_PERCENTAGE',
          rateValue: 110,
        });
      });

      expect(result.current.toasts).toHaveLength(1);
      const toastId = result.current.toasts[0].id;

      act(() => {
        result.current.dismissToast(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });

  describe('loadRendaFixa', () => {
    it('should load list from API', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const assets = [
        {
          id: '1',
          userId: 'u1',
          institution: 'Banco Inter',
          investedAmount: 10000,
          maturityDate: futureDate.toISOString(),
          rateType: 'CDI_PERCENTAGE' as const,
          rateValue: 110,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockedService.list.mockResolvedValue(assets);

      const { result } = renderHook(() => useRendaFixaViewModel());

      await act(async () => {
        await result.current.loadRendaFixa();
      });

      expect(result.current.rendaFixaList).toHaveLength(1);
      expect(result.current.rendaFixaList[0].institution).toBe('Banco Inter');
    });

    it('should add error toast when load fails', async () => {
      mockedService.list.mockRejectedValue(
        new ApiClientError('Falha ao carregar', 500)
      );

      const { result } = renderHook(() => useRendaFixaViewModel());

      await act(async () => {
        await result.current.loadRendaFixa();
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe('error');
    });
  });
});
