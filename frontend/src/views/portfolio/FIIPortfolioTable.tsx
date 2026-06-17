/**
 * FIIPortfolioTable — Read-only portfolio table displaying FII positions with
 * calculated dividend metrics. Follows MVVM pattern using useFIIPortfolioViewModel.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.1, 7.1, 7.2, 7.3
 */

import { useEffect } from 'react';
import { useFIIPortfolioViewModel } from '../../viewmodels/useFIIPortfolioViewModel';

/**
 * Format a numeric value as Brazilian Real (BRL) currency.
 * Uses pt-BR locale: R$ 1.234,56
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function FIIPortfolioTable() {
  const { portfolioItems, isLoading, error, loadPortfolio, retry } =
    useFIIPortfolioViewModel();

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full min-h-screen p-4 md:p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div
            className="rounded-xl bg-white shadow-sm border border-gray-200 p-6 flex items-center justify-center"
            role="status"
            aria-label="Carregando portfólio de FIIs"
            aria-busy="true"
          >
            <svg
              className="animate-spin h-8 w-8 text-blue-600"
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
            <span className="ml-3 text-gray-600">Carregando portfólio...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state with retry button
  if (error) {
    return (
      <div className="w-full min-h-screen p-4 md:p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-xl bg-white shadow-sm border border-red-200 p-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={retry}
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

  // Empty state
  if (portfolioItems.length === 0) {
    return (
      <div className="w-full min-h-screen p-4 md:p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
            Carteira de FIIs
          </h1>
          <div className="rounded-xl bg-white shadow-sm border border-gray-200 p-6 text-center">
            <p className="text-gray-500">
              Você ainda não possui FIIs cadastrados. Registre seu primeiro fundo
              imobiliário para acompanhar seu portfólio aqui.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Table with portfolio data
  return (
    <div className="w-full min-h-screen p-4 md:p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
          Carteira de FIIs
        </h1>

        <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Ticker
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Cotas
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Preço Médio
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Dividendo Último Mês
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-700">
                    Rendimento Projetado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {portfolioItems.map((item) => (
                  <tr key={item.ticker} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.ticker}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.shares}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatCurrency(item.averagePrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatCurrency(item.lastMonthDividend)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatCurrency(item.projectedMonthlyYield)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FIIPortfolioTable;
