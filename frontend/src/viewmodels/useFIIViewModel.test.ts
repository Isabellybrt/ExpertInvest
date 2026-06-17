/**
 * Unit tests for useFIIViewModel.
 * Tests validation logic, CRUD operations, toast and modal behavior.
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 13.2, 13.4, 13.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFIIViewModel } from './useFIIViewModel';

// Mock the fiiService module
vi.mock('../services/fiiService', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2) });

import fiiService from '../services/fiiService';
import { ApiClientError } from '../services/api';

const mockedFiiService = fiiService as {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('useFIIViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateTicker', () => {
    it('should accept valid ticker format (4 uppercase letters + 2 digits)', () => {
      const { result } = renderHook(() => useFIIViewModel());
      expect(result.current.validateTicker('MXRF11')).toBe(true);
      expect(result.current.validateTicker('HGLG11')).toBe(true);
      expect(result.current.validateTicker('XPML11')).toBe(true);
      expect(result.current.validateTicker('ABCD01')).toBe(true);
    });

    it('should reject invalid ticker formats', () => {
      const { result } = renderHook(() => useFIIViewModel());
      expect(result.current.validateTicker('MXR11')).toBe(false);    // 3 letters
      expect(result.current.validateTicker('MXRFF1')).toBe(false);   // 5 letters + 1 digit
      expect(result.current.validateTicker('mxrf11')).toBe(false);   // lowercase
      expect(result.current.validateTicker('MXRF1')).toBe(false);    // 1 digit
      expect(result.current.validateTicker('MXRF111')).toBe(false);  // 3 digits
      expect(result.current.validateTicker('')).toBe(false);          // empty
      expect(result.current.validateTicker('1234AB')).toBe(false);   // numbers first
    });
  });

  describe('validateForm', () => {
    it('should return no errors for valid data', () => {
      const { result } = renderHook(() => useFIIViewModel());
      const errors = result.current.validateForm({
        ticker: 'MXRF11',
        shares: 100,
        averagePrice: 10.5,
        purchaseDate: '2024-01-15T00:00:00.000Z',
      });
      expect(errors).toEqual({});
    });

    it('should return error for empty ticker', () => {
      const { result } = renderHook(() => useFIIViewModel());
      const errors = result.current.validateForm({
        ticker: '',
        shares: 100,
        averagePrice: 10.5,
        purchaseDate: '2024-01-15T00:00:00.000Z',
      });
      expect(errors.ticker).toBeDefined();
    });

    it('should return error for invalid ticker format', () => {
      const { result } = renderHook(() => useFIIViewModel());
      const errors = result.current.validateForm({
        ticker: 'abc123',
        shares: 100,
        averagePrice: 10.5,
        purchaseDate: '2024-01-15T00:00:00.000Z',
      });
      expect(errors.ticker).toContain('4 letras maiúsculas + 2 dígitos');
    });

    it('should return error for shares less than 1', () => {
      const { result } = renderHook(() => useFIIViewModel());
      const errors = result.current.validateForm({
        ticker: 'MXRF11',
        shares: 0,
        averagePrice: 10.5,
        purchaseDate: '2024-01-15T00:00:00.000Z',
      });
      expect(errors.shares).toBeDefined();
    });

    it('should return error for non-integer shares', () => {
      const { result } = renderHook(() => useFIIViewModel());
      const errors = result.current.validateForm({
        ticker: 'MXRF11',
        shares: 1.5,
        averagePrice: 10.5,
        purchaseDate: '2024-01-15T00:00:00.000Z',
      });
      expect(errors.shares).toContain('inteiro');
    });

    it('should return error for averagePrice <= 0', () => {
      const { result } = renderHook(() => useFIIViewModel());
      const errors = result.current.validateForm({
        ticker: 'MXRF11',
        shares: 100,
        averagePrice: 0,
        purchaseDate: '2024-01-15T00:00:00.000Z',
      });
      expect(errors.averagePrice).toBeDefined();
    });

    it('should return error for negative averagePrice', () => {
      const { result } = renderHook(() => useFIIViewModel());
      const errors = result.current.validateForm({
        ticker: 'MXRF11',
        shares: 100,
        averagePrice: -5,
        purchaseDate: '2024-01-15T00:00:00.000Z',
      });
      expect(errors.averagePrice).toContain('positivo');
    });

    it('should return error for empty purchaseDate', () => {
      const { result } = renderHook(() => useFIIViewModel());
      const errors = result.current.validateForm({
        ticker: 'MXRF11',
        shares: 100,
        averagePrice: 10.5,
        purchaseDate: '',
      });
      expect(errors.purchaseDate).toBeDefined();
    });

    it('should return multiple errors when multiple fields are invalid', () => {
      const { result } = renderHook(() => useFIIViewModel());
      const errors = result.current.validateForm({
        ticker: '',
        shares: 0,
        averagePrice: -1,
        purchaseDate: '',
      });
      expect(Object.keys(errors).length).toBe(4);
    });
  });

  describe('loadFIIs', () => {
    it('should load FIIs from the service', async () => {
      const mockFIIs = [
        { id: '1', ticker: 'MXRF11', shares: 100, averagePrice: 10.5, purchaseDate: '2024-01-15', createdAt: '', updatedAt: '' },
      ];
      mockedFiiService.list.mockResolvedValue(mockFIIs);

      const { result } = renderHook(() => useFIIViewModel());

      await act(async () => {
        await result.current.loadFIIs();
      });

      expect(result.current.fiiList).toEqual(mockFIIs);
      expect(result.current.isLoading).toBe(false);
    });

    it('should set error on load failure', async () => {
      mockedFiiService.list.mockRejectedValue(new ApiClientError('Erro de rede', 500));

      const { result } = renderHook(() => useFIIViewModel());

      await act(async () => {
        await result.current.loadFIIs();
      });

      expect(result.current.error).toBe('Erro de rede');
      expect(result.current.fiiList).toEqual([]);
    });
  });

  describe('createFII', () => {
    it('should create FII and add to list on success (Req 2.5)', async () => {
      const createdFII = {
        id: 'new-id',
        ticker: 'HGLG11',
        shares: 50,
        averagePrice: 160.0,
        purchaseDate: '2024-03-01T00:00:00.000Z',
        createdAt: '2024-03-01',
        updatedAt: '2024-03-01',
      };
      mockedFiiService.create.mockResolvedValue(createdFII);

      const { result } = renderHook(() => useFIIViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.createFII({
          ticker: 'HGLG11',
          shares: 50,
          averagePrice: 160.0,
          purchaseDate: '2024-03-01T00:00:00.000Z',
        });
      });

      expect(success).toBe(true);
      expect(result.current.fiiList).toContainEqual(createdFII);
      expect(result.current.toasts.some((t) => t.type === 'success')).toBe(true);
    });

    it('should not call service when validation fails', async () => {
      const { result } = renderHook(() => useFIIViewModel());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.createFII({
          ticker: 'invalid',
          shares: 0,
          averagePrice: -1,
          purchaseDate: '',
        });
      });

      expect(success).toBe(false);
      expect(mockedFiiService.create).not.toHaveBeenCalled();
      expect(Object.keys(result.current.validationErrors).length).toBeGreaterThan(0);
    });

    it('should show error toast on API failure (Req 13.5)', async () => {
      mockedFiiService.create.mockRejectedValue(new ApiClientError('Ticker duplicado', 409));

      const { result } = renderHook(() => useFIIViewModel());

      await act(async () => {
        await result.current.createFII({
          ticker: 'MXRF11',
          shares: 100,
          averagePrice: 10.5,
          purchaseDate: '2024-01-15T00:00:00.000Z',
        });
      });

      expect(result.current.toasts.some((t) => t.type === 'error')).toBe(true);
    });
  });

  describe('deleteFII with confirmation modal (Req 13.2)', () => {
    it('should open confirmation modal on delete request', async () => {
      const { result } = renderHook(() => useFIIViewModel());

      await act(async () => {
        result.current.requestDelete('fii-1');
      });

      expect(result.current.confirmModal.isOpen).toBe(true);
      expect(result.current.confirmModal.fiiId).toBe('fii-1');
    });

    it('should close modal on cancel without deleting', async () => {
      const { result } = renderHook(() => useFIIViewModel());

      await act(async () => {
        result.current.requestDelete('fii-1');
      });

      await act(async () => {
        result.current.cancelDelete();
      });

      expect(result.current.confirmModal.isOpen).toBe(false);
      expect(mockedFiiService.delete).not.toHaveBeenCalled();
    });

    it('should delete FII on confirm and show success toast', async () => {
      mockedFiiService.list.mockResolvedValue([
        { id: 'fii-1', ticker: 'MXRF11', shares: 100, averagePrice: 10.5, purchaseDate: '2024-01-15', createdAt: '', updatedAt: '' },
      ]);
      mockedFiiService.delete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFIIViewModel());

      await act(async () => {
        await result.current.loadFIIs();
      });

      await act(async () => {
        result.current.requestDelete('fii-1');
      });

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockedFiiService.delete).toHaveBeenCalledWith('fii-1');
      expect(result.current.fiiList).toEqual([]);
      expect(result.current.toasts.some((t) => t.type === 'success')).toBe(true);
    });
  });

  describe('toast management', () => {
    it('should dismiss toast by id', async () => {
      mockedFiiService.create.mockResolvedValue({
        id: '1', ticker: 'MXRF11', shares: 100, averagePrice: 10.5,
        purchaseDate: '2024-01-15T00:00:00.000Z', createdAt: '', updatedAt: '',
      });

      const { result } = renderHook(() => useFIIViewModel());

      await act(async () => {
        await result.current.createFII({
          ticker: 'MXRF11',
          shares: 100,
          averagePrice: 10.5,
          purchaseDate: '2024-01-15T00:00:00.000Z',
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
});
