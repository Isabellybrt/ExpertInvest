/**
 * Export service layer — handles API communication for data export operations.
 * Uses the shared apiClient for authenticated requests.
 * Supports CSV and Excel format generation with file download.
 * Validates: Requirements 15.1, 15.3, 15.4
 */

import { ApiClientError } from './api';

export type ExportFormat = 'csv' | 'excel';

const API_BASE_URL = '/api';

function getAuthHeaders(): Record<string, string> {
  const stored = localStorage.getItem('auth-storage');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const accessToken = parsed?.state?.accessToken;
      if (accessToken) {
        return { Authorization: `Bearer ${accessToken}` };
      }
    } catch {
      // Invalid JSON in storage, ignore
    }
  }
  return {};
}

const exportService = {
  /**
   * Requests the backend to generate an export file and triggers a browser download.
   * POST /api/export/csv or POST /api/export/excel
   * Returns a Blob that is then downloaded as a file.
   */
  async exportData(format: ExportFormat): Promise<void> {
    const endpoint = format === 'csv' ? '/export/csv' : '/export/excel';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        localStorage.removeItem('auth-storage');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        throw new ApiClientError('Sessão expirada. Faça login novamente.', 401);
      }

      if (!response.ok) {
        let errorMessage = 'Erro ao gerar arquivo de exportação.';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Response body is not JSON
        }
        throw new ApiClientError(errorMessage, response.status);
      }

      const blob = await response.blob();
      const extension = format === 'csv' ? 'csv' : 'xlsx';
      const filename = `exportacao_carteira_${new Date().toISOString().split('T')[0]}.${extension}`;

      downloadBlob(blob, filename);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof ApiClientError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiClientError(
          'A exportação excedeu o tempo limite de 30 segundos. Tente novamente.',
          408
        );
      }
      throw new ApiClientError(
        'Erro inesperado ao exportar dados. Tente novamente.',
        500
      );
    }
  },
};

/**
 * Creates a temporary anchor element to trigger a file download from a Blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default exportService;
