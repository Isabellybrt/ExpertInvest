/**
 * DashboardView — Main dashboard container.
 * Follows Mobile First layout with progressive rendering:
 * - Numeric values render within 1 second (Req 16.2)
 * - Charts render after summary is loaded
 *
 * Validates: Requirements 8.1-8.6, 4.4, 13.1, 16.2, 12.1, 12.2
 */

import React from 'react';
import { useDashboardViewModel } from '../../viewmodels/useDashboardViewModel';
import AssetSummaryCard from './AssetSummaryCard';
import AllocationPieChart from './AllocationPieChart';

export const DashboardView: React.FC = () => {
  const {
    totalPatrimony,
    rendaFixaTotal,
    fiiTotal,
    estimatedMonthlyDividends,
    allocationData,
    isLoading,
    isSummaryLoaded,
    error,
    refreshData,
  } = useDashboardViewModel();

  // Error state with retry
  if (error && !isSummaryLoaded) {
    return (
      <div className="w-full min-h-screen p-4 md:p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl bg-white shadow-sm border border-red-200 p-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={refreshData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-w-[44px] min-h-[44px]"
              aria-label="Tentar novamente"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-4 md:p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            Dashboard
          </h1>
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px]"
            aria-label="Atualizar dados"
          >
            {isLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        {/* Summary card — renders first for fast numeric display (Req 16.2) */}
        {isSummaryLoaded ? (
          <AssetSummaryCard
            totalPatrimony={totalPatrimony}
            rendaFixaTotal={rendaFixaTotal}
            fiiTotal={fiiTotal}
            estimatedMonthlyDividends={estimatedMonthlyDividends}
          />
        ) : (
          <SummarySkeleton />
        )}

        {/* Charts section — Mobile First: single column on mobile, grid on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Allocation Pie Chart */}
          {allocationData ? (
            <AllocationPieChart
              rendaFixaPercentage={allocationData.rendaFixaPercentage}
              fiiPercentage={allocationData.fiiPercentage}
              rendaFixaTotal={allocationData.rendaFixaTotal}
              fiiTotal={allocationData.fiiTotal}
            />
          ) : (
            <ChartSkeleton title="Alocação" />
          )}

          {/* Placeholder for future charts (patrimony evolution, dividends) */}
          <div className="w-full rounded-xl bg-white shadow-sm border border-gray-200 p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Evolução Patrimonial
            </h3>
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">
              Gráfico disponível em breve
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton loader for the summary card while data loads.
 * Uses role="status" and aria-label for accessibility (screen readers).
 */
function SummarySkeleton() {
  return (
    <div
      className="w-full rounded-xl bg-white shadow-sm border border-gray-200 p-4 md:p-6 animate-pulse"
      data-testid="summary-skeleton"
      role="status"
      aria-label="Carregando resumo do patrimônio"
      aria-busy="true"
    >
      <div className="h-6 bg-gray-200 rounded w-48 mb-4" aria-hidden="true" />
      <div className="h-10 bg-gray-200 rounded w-64 mb-6" aria-hidden="true" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-20 bg-gray-100 rounded-lg" aria-hidden="true" />
        <div className="h-20 bg-gray-100 rounded-lg" aria-hidden="true" />
        <div className="h-20 bg-gray-100 rounded-lg" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * Skeleton loader for chart areas while data loads.
 * Uses role="status" and aria-label for accessibility (screen readers).
 */
function ChartSkeleton({ title }: { title: string }) {
  return (
    <div
      className="w-full rounded-xl bg-white shadow-sm border border-gray-200 p-4 md:p-6 animate-pulse"
      data-testid="chart-skeleton"
      role="status"
      aria-label={`Carregando gráfico de ${title}`}
      aria-busy="true"
    >
      <div className="h-6 bg-gray-200 rounded w-32 mb-4" aria-hidden="true" />
      <div className="h-64 bg-gray-100 rounded-lg" aria-hidden="true" />
    </div>
  );
}

export default DashboardView;
