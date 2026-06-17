/**
 * Dividend evolution bar chart component.
 * Displays historical dividends (12 months) + projected dividends (6 months)
 * using Recharts with distinct visual patterns for projections (reduced opacity).
 *
 * Auto-updates when new proventos are registered (no page reload needed).
 * Shows empty state when no dividend data is available.
 * Shows FII breakdown: ticker, shares, last dividend, projected value.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 6.1, 6.2, 6.3, 6.4
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import dashboardService from '../../services/dashboardService';
import type { DividendPoint } from '../../services/dashboardService';
import { ApiClientError } from '../../services/api';

/**
 * FII breakdown item for detailed dividend view.
 * Validates: Requirements 6.1, 6.2
 */
export interface FIIDividendBreakdown {
  ticker: string;
  shares: number;
  lastDividendPerShare: number;
  projectedValue: number;
}

export interface DividendChartProps {
  /** Optional callback to fetch FII breakdown data */
  fiiBreakdown?: FIIDividendBreakdown[];
  /** Trigger for auto-refresh when new proventos are registered */
  refreshTrigger?: number;
}

/**
 * Format month string (YYYY-MM) to display format (MMM/YY).
 */
function formatMonthLabel(month: string): string {
  const parts = month.split('-');
  const year = parts[0] ?? '';
  const monthNum = parts[1] ?? '01';
  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const idx = parseInt(monthNum, 10) - 1;
  const shortYear = year.slice(2);
  return `${monthNames[idx]}/${shortYear}`;
}

/**
 * Format currency value to BRL display.
 */
function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Custom tooltip for the bar chart.
 */
function DividendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: DividendPoint & { formattedMonth: string } }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]!;
  const isProjection = data.payload.isProjection;

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-sm text-gray-600">
        {formatBRL(data.value)}
        {isProjection && (
          <span className="ml-1 text-xs text-amber-600">(projeção)</span>
        )}
      </p>
    </div>
  );
}

/**
 * Custom legend showing the distinction between historical and projected data.
 */
function DividendLegend() {
  return (
    <div className="mt-2 flex items-center justify-center gap-4 text-xs text-gray-600 sm:text-sm">
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 rounded-sm bg-emerald-500" />
        <span>Recebido</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 rounded-sm bg-emerald-500 opacity-40" />
        <span>Projeção</span>
      </div>
    </div>
  );
}

export function DividendChart({ fiiBreakdown, refreshTrigger }: DividendChartProps) {
  const [dividendData, setDividendData] = useState<DividendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchDividends = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await dashboardService.getDividends();
      if (!isMounted.current) return;
      setDividendData(data);
    } catch (err) {
      if (!isMounted.current) return;
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Erro ao carregar dados de dividendos.');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial load and auto-update on refreshTrigger change (Req 10.3)
  useEffect(() => {
    isMounted.current = true;
    fetchDividends();
    return () => {
      isMounted.current = false;
    };
  }, [fetchDividends, refreshTrigger]);

  // Prepare chart data with formatted month labels
  const chartData = dividendData.map((point) => ({
    ...point,
    formattedMonth: formatMonthLabel(point.month),
  }));

  // Check if there's any actual dividend data (all values zero = empty)
  const hasData = dividendData.some((point) => point.value > 0);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-white p-4 sm:h-80">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-500" />
          <p className="text-sm text-gray-500">Carregando dividendos...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4 sm:h-80">
        <div className="text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchDividends}
            className="mt-2 rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Empty state (Req 10.4)
  if (!hasData) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
          Evolução de Dividendos
        </h3>
        <div className="mt-6 flex h-48 flex-col items-center justify-center text-center sm:h-56">
          <svg
            className="h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
          <p className="mt-3 text-sm text-gray-500">
            Não há dados de dividendos disponíveis.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Os dividendos serão exibidos conforme proventos forem registrados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <h3 className="text-base font-semibold text-gray-900 sm:text-lg">
        Evolução de Dividendos
      </h3>
      <p className="mt-1 text-xs text-gray-500 sm:text-sm">
        Histórico (12 meses) e projeção (6 meses) em R$
      </p>

      {/* Chart (Req 10.1, 10.2, 10.5) */}
      <div className="mt-4 h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="formattedMonth"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
              tickFormatter={(value: number) =>
                value >= 1000
                  ? `R$${(value / 1000).toFixed(1)}k`
                  : `R$${value.toFixed(0)}`
              }
              width={60}
            />
            <Tooltip content={<DividendTooltip />} />
            <Legend content={<DividendLegend />} />
            <Bar dataKey="value" name="Dividendos" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill="#10b981"
                  fillOpacity={entry.isProjection ? 0.4 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DividendLegend />

      {/* FII Breakdown (Req 6.1, 6.2) */}
      {fiiBreakdown && fiiBreakdown.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h4 className="text-sm font-medium text-gray-700">
            Detalhamento por FII
          </h4>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Ticker</th>
                  <th className="pb-2 pr-4 font-medium">Cotas</th>
                  <th className="pb-2 pr-4 font-medium">Último Provento</th>
                  <th className="pb-2 font-medium">Projeção Mensal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fiiBreakdown.map((fii) => (
                  <tr key={fii.ticker}>
                    <td className="py-2 pr-4 font-medium text-gray-900">
                      {fii.ticker}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {fii.shares}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {fii.lastDividendPerShare > 0
                        ? formatBRL(fii.lastDividendPerShare)
                        : (
                          <span className="text-xs text-amber-600">
                            Indisponível
                          </span>
                        )}
                    </td>
                    <td className="py-2 text-gray-900">
                      {fii.projectedValue > 0
                        ? formatBRL(fii.projectedValue)
                        : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DividendChart;
