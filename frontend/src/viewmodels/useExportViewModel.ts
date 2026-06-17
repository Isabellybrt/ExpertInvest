/**
 * Export ViewModel hook following MVVM pattern.
 * Encapsulates export logic, loading state, format selection, and toast notifications.
 * Validates: Requirements 15.1, 15.3, 15.4, 13.4, 13.5
 */

import { useState, useCallback } from 'react';
import exportService from '../services/exportService';
import type { ExportFormat } from '../services/exportService';
import { ApiClientError } from '../services/api';
import type { ToastMessage } from '../components/Toast';

export interface UseExportViewModel {
  // State
  isExporting: boolean;
  selectedFormat: ExportFormat;
  toasts: ToastMessage[];

  // Actions
  setSelectedFormat: (format: ExportFormat) => void;
  exportData: () => Promise<void>;
  exportToCSV: () => Promise<void>;
  exportToExcel: () => Promise<void>;
  dismissToast: (id: string) => void;
}

let toastIdCounter = 0;
function generateToastId(): string {
  toastIdCounter += 1;
  return `export-toast-${Date.now()}-${toastIdCounter}`;
}

export function useExportViewModel(): UseExportViewModel {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const toast: ToastMessage = { id: generateToastId(), type, message };
    setToasts((prev) => [...prev, toast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const performExport = useCallback(async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      await exportService.exportData(format);
      addToast('success', `Exportação em ${format === 'csv' ? 'CSV' : 'Excel'} concluída com sucesso!`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        addToast('error', err.message);
      } else {
        addToast('error', 'Erro inesperado ao exportar. Tente novamente.');
      }
    } finally {
      setIsExporting(false);
    }
  }, [addToast]);

  const exportData = useCallback(async () => {
    await performExport(selectedFormat);
  }, [selectedFormat, performExport]);

  const exportToCSV = useCallback(async () => {
    setSelectedFormat('csv');
    await performExport('csv');
  }, [performExport]);

  const exportToExcel = useCallback(async () => {
    setSelectedFormat('excel');
    await performExport('excel');
  }, [performExport]);

  return {
    isExporting,
    selectedFormat,
    toasts,
    setSelectedFormat,
    exportData,
    exportToCSV,
    exportToExcel,
    dismissToast,
  };
}
