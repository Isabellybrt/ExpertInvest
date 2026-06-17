/**
 * Export View component — allows user to select format (CSV/Excel) and trigger export.
 * Shows loading state during generation, error toast on failure, and triggers file download on success.
 * Mobile First with Tailwind CSS.
 * Validates: Requirements 15.1, 15.3, 15.4, 13.4, 13.5
 */

import { useExportViewModel } from '../../viewmodels/useExportViewModel';
import { ToastContainer } from '../../components/Toast';
import type { ExportFormat } from '../../services/exportService';

export function ExportView() {
  const {
    isExporting,
    selectedFormat,
    toasts,
    setSelectedFormat,
    exportData,
    dismissToast,
  } = useExportViewModel();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900 sm:text-2xl">
        Exportar Dados
      </h1>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-sm text-gray-600">
          Exporte o histórico completo da sua carteira de investimentos.
        </p>

        {/* Format selector */}
        <fieldset className="mb-6">
          <legend className="mb-2 text-sm font-medium text-gray-700">
            Formato do arquivo
          </legend>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <FormatOption
              value="csv"
              label="CSV"
              description="Compatível com planilhas"
              selected={selectedFormat === 'csv'}
              onSelect={setSelectedFormat}
              disabled={isExporting}
            />
            <FormatOption
              value="excel"
              label="Excel"
              description="Arquivo .xlsx formatado"
              selected={selectedFormat === 'excel'}
              onSelect={setSelectedFormat}
              disabled={isExporting}
            />
          </div>
        </fieldset>

        {/* Export button */}
        <button
          type="button"
          onClick={exportData}
          disabled={isExporting}
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
          aria-busy={isExporting}
        >
          {isExporting ? (
            <>
              <LoadingSpinner />
              <span>Gerando arquivo...</span>
            </>
          ) : (
            <>
              <DownloadIcon />
              <span>Exportar</span>
            </>
          )}
        </button>
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

interface FormatOptionProps {
  value: ExportFormat;
  label: string;
  description: string;
  selected: boolean;
  onSelect: (format: ExportFormat) => void;
  disabled: boolean;
}

function FormatOption({ value, label, description, selected, onSelect, disabled }: FormatOptionProps) {
  return (
    <label
      className={`flex min-h-[44px] flex-1 cursor-pointer items-center gap-3 rounded-md border-2 px-4 py-3 transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <input
        type="radio"
        name="export-format"
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
        disabled={disabled}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
      />
      <div>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{description}</span>
      </div>
    </label>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

export default ExportView;
