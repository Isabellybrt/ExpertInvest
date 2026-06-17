/**
 * AssetSummaryCard — displays total patrimony, RF total, FII total.
 * Includes variation indicators (green/red/neutral) with non-chromatic arrows.
 * Shows staleness badge when quote > 48h old.
 *
 * Validates: Requirements 8.1, 8.4, 8.5, 8.6, 4.4, 13.1, 16.2
 */

import React from 'react';

export interface AssetSummaryCardProps {
  totalPatrimony: number;
  rendaFixaTotal: number;
  fiiTotal: number;
  estimatedMonthlyDividends: number;
  isStale?: boolean;
}

/**
 * Formats a number as BRL currency string.
 */
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Renders a variation badge with appropriate color and arrow.
 * Green + ↑ for positive, Red + ↓ for negative, neutral for zero.
 * Non-chromatic indicators (arrows) guarantee accessibility without color dependence.
 * Validates: Requirements 8.4, 8.5, 8.6, 13.1
 */
export function VariationBadge({
  variationPercent,
}: {
  variationPercent: number;
}) {
  if (variationPercent > 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-green-600 font-medium text-sm"
        aria-label={`Valorização de ${variationPercent.toFixed(2)} porcento`}
      >
        <span aria-hidden="true">↑</span>
        +{variationPercent.toFixed(2)}%
      </span>
    );
  }

  if (variationPercent < 0) {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-red-600 font-medium text-sm"
        aria-label={`Desvalorização de ${Math.abs(variationPercent).toFixed(2)} porcento`}
      >
        <span aria-hidden="true">↓</span>
        {variationPercent.toFixed(2)}%
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-0.5 text-gray-500 font-medium text-sm"
      aria-label="Sem variação"
    >
      <span aria-hidden="true">→</span>
      0.00%
    </span>
  );
}

/**
 * Staleness badge: shown when data is > 48h old.
 * Validates: Requirement 4.4
 */
export function StalenessBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium"
      role="status"
      aria-label="Dados podem estar desatualizados"
    >
      <span aria-hidden="true">⚠</span>
      Desatualizado
    </span>
  );
}

export const AssetSummaryCard: React.FC<AssetSummaryCardProps> = ({
  totalPatrimony,
  rendaFixaTotal,
  fiiTotal,
  estimatedMonthlyDividends,
  isStale = false,
}) => {
  return (
    <div className="w-full rounded-xl bg-white shadow-sm border border-gray-200 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900">
          Resumo do Patrimônio
        </h2>
        {isStale && <StalenessBadge />}
      </div>

      {/* Total Patrimony */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">Patrimônio Total</p>
        <p
          className="text-2xl md:text-3xl font-bold text-gray-900"
          data-testid="total-patrimony"
        >
          {formatCurrency(totalPatrimony)}
        </p>
      </div>

      {/* Breakdown grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Renda Fixa */}
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-xs text-blue-600 font-medium mb-1">Renda Fixa</p>
          <p
            className="text-lg font-semibold text-gray-900"
            data-testid="rf-total"
          >
            {formatCurrency(rendaFixaTotal)}
          </p>
        </div>

        {/* FIIs */}
        <div className="rounded-lg bg-purple-50 p-3">
          <p className="text-xs text-purple-600 font-medium mb-1">FIIs</p>
          <p
            className="text-lg font-semibold text-gray-900"
            data-testid="fii-total"
          >
            {formatCurrency(fiiTotal)}
          </p>
        </div>

        {/* Estimated Dividends */}
        <div className="rounded-lg bg-green-50 p-3">
          <p className="text-xs text-green-600 font-medium mb-1">
            Dividendos Estimados/Mês
          </p>
          <p
            className="text-lg font-semibold text-gray-900"
            data-testid="estimated-dividends"
          >
            {formatCurrency(estimatedMonthlyDividends)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AssetSummaryCard;
