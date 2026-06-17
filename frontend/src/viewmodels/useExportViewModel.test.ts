/**
 * Unit tests for useExportViewModel.
 * Tests export operations, loading states, format selection, and toast behavior.
 * Validates: Requirements 15.1, 15.3, 15.4, 13.4, 13.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExportViewModel } from './useExportViewModel';

// Mock the exportService module
vi.mock('../services/exportService', () => ({
  default: {
    exportData: vi.fn(),
  },
}));

import exportService from '../services/exportService';
import { ApiClientError } from '../services/api';

const mockedExportService = exportService as {
  exportData: ReturnType<typeof vi.fn>;
};

describe('useExportViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with isExporting false', () => {
      const { result } = renderHook(() => useExportViewModel());
      expect(result.current.isExporting).toBe(false);
    });

    it('should default to CSV format', () => {
      const { result } = renderHook(() => useExportViewModel());
      expect(result.current.selectedFormat).toBe('csv');
    });

    it('should start with no toasts', () => {
      const { result } = renderHook(() => useExportViewModel());
      expect(result.current.toasts).toEqual([]);
    });
  });

  describe('setSelectedFormat', () => {
    it('should update format to excel', () => {
      const { result } = renderHook(() => useExportViewModel());

      act(() => {
        result.current.setSelectedFormat('excel');
      });

      expect(result.current.selectedFormat).toBe('excel');
    });

    it('should update format to csv', () => {
      const { result } = renderHook(() => useExportViewModel());

      act(() => {
        result.current.setSelectedFormat('excel');
      });

      act(() => {
        result.current.setSelectedFormat('csv');
      });

      expect(result.current.selectedFormat).toBe('csv');
    });
  });

  describe('exportData — success (Req 15.1, 15.3, 13.4)', () => {
    it('should export CSV and show success toast', async () => {
      mockedExportService.exportData.mockResolvedValue(undefined);

      const { result } = renderHook(() => useExportViewModel());

      await act(async () => {
        await result.current.exportData();
      });

      expect(mockedExportService.exportData).toHaveBeenCalledWith('csv');
      expect(result.current.isExporting).toBe(false);
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe('success');
      expect(result.current.toasts[0].message).toContain('CSV');
    });

    it('should export Excel and show success toast', async () => {
      mockedExportService.exportData.mockResolvedValue(undefined);

      const { result } = renderHook(() => useExportViewModel());

      act(() => {
        result.current.setSelectedFormat('excel');
      });

      await act(async () => {
        await result.current.exportData();
      });

      expect(mockedExportService.exportData).toHaveBeenCalledWith('excel');
      expect(result.current.toasts[0].type).toBe('success');
      expect(result.current.toasts[0].message).toContain('Excel');
    });
  });

  describe('exportData — loading state (Req 15.3)', () => {
    it('should set isExporting to true during export', async () => {
      let resolveExport: () => void;
      const exportPromise = new Promise<void>((resolve) => {
        resolveExport = resolve;
      });
      mockedExportService.exportData.mockReturnValue(exportPromise);

      const { result } = renderHook(() => useExportViewModel());

      let exportDataPromise: Promise<void>;
      act(() => {
        exportDataPromise = result.current.exportData();
      });

      // During export, isExporting should be true
      expect(result.current.isExporting).toBe(true);

      await act(async () => {
        resolveExport!();
        await exportDataPromise;
      });

      // After export, isExporting should be false
      expect(result.current.isExporting).toBe(false);
    });
  });

  describe('exportData — failure (Req 15.4, 13.5)', () => {
    it('should show error toast on ApiClientError', async () => {
      mockedExportService.exportData.mockRejectedValue(
        new ApiClientError('A exportação excedeu o tempo limite de 30 segundos. Tente novamente.', 408)
      );

      const { result } = renderHook(() => useExportViewModel());

      await act(async () => {
        await result.current.exportData();
      });

      expect(result.current.isExporting).toBe(false);
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe('error');
      expect(result.current.toasts[0].message).toContain('30 segundos');
    });

    it('should show generic error toast on unexpected error', async () => {
      mockedExportService.exportData.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useExportViewModel());

      await act(async () => {
        await result.current.exportData();
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].type).toBe('error');
      expect(result.current.toasts[0].message).toContain('Tente novamente');
    });

    it('should show error for server error (500)', async () => {
      mockedExportService.exportData.mockRejectedValue(
        new ApiClientError('Erro ao gerar arquivo de exportação.', 500)
      );

      const { result } = renderHook(() => useExportViewModel());

      await act(async () => {
        await result.current.exportData();
      });

      expect(result.current.toasts[0].type).toBe('error');
      expect(result.current.toasts[0].message).toContain('exportação');
    });
  });

  describe('exportToCSV (Req 15.1)', () => {
    it('should call exportData with csv format', async () => {
      mockedExportService.exportData.mockResolvedValue(undefined);

      const { result } = renderHook(() => useExportViewModel());

      // Change format to excel first
      act(() => {
        result.current.setSelectedFormat('excel');
      });

      await act(async () => {
        await result.current.exportToCSV();
      });

      expect(mockedExportService.exportData).toHaveBeenCalledWith('csv');
      expect(result.current.toasts[0].type).toBe('success');
    });
  });

  describe('exportToExcel (Req 15.1)', () => {
    it('should call exportData with excel format', async () => {
      mockedExportService.exportData.mockResolvedValue(undefined);

      const { result } = renderHook(() => useExportViewModel());

      await act(async () => {
        await result.current.exportToExcel();
      });

      expect(mockedExportService.exportData).toHaveBeenCalledWith('excel');
      expect(result.current.toasts[0].type).toBe('success');
    });
  });

  describe('toast management (Req 13.4, 13.5)', () => {
    it('should dismiss toast by id', async () => {
      mockedExportService.exportData.mockResolvedValue(undefined);

      const { result } = renderHook(() => useExportViewModel());

      await act(async () => {
        await result.current.exportData();
      });

      expect(result.current.toasts).toHaveLength(1);
      const toastId = result.current.toasts[0].id;

      act(() => {
        result.current.dismissToast(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should accumulate multiple toasts', async () => {
      mockedExportService.exportData
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new ApiClientError('Erro', 500));

      const { result } = renderHook(() => useExportViewModel());

      await act(async () => {
        await result.current.exportData();
      });

      await act(async () => {
        await result.current.exportData();
      });

      expect(result.current.toasts).toHaveLength(2);
      expect(result.current.toasts[0].type).toBe('success');
      expect(result.current.toasts[1].type).toBe('error');
    });

    it('should not fail when dismissing non-existent toast id', () => {
      const { result } = renderHook(() => useExportViewModel());

      act(() => {
        result.current.dismissToast('non-existent-id');
      });

      expect(result.current.toasts).toHaveLength(0);
    });
  });
});
