/**
 * Patrimony Evolution Line Chart component.
 * Renders a line chart showing patrimony value over time with monthly granularity.
 * Fetches data from GET /api/dashboard/patrimony-history.
 * Supports 1-60 months of history.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 16.1, 16.3
 */

import { useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiClient } from '../../services/api';

export interface PatrimonyPoint {
  month: string; // YYYY-MM
  value: number;
}

interface PatrimonyChartProps {
  /** Optional: number of months to request (1-60). Defaults to all available. */
  months?: number;
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Formats a BRL value for display on the Y-axis.
 */
function formatBRL(value: number): string {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(1)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
}

/**
 * Formats month label for X-axis (YYYY-MM → MM/YY).
 */
function formatMonthLabel(month: string): string {
  const parts = month.split('-');
  const year = parts[0] ?? '';
  const m = parts[1] ?? '';
  return `${m}/${year.slice(2)}`;
}

/**
 * Custom tooltip for the line chart.
 */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length || !label) {
    return null;
  }

  const value = payload[0]?.value ?? 0;
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

  const parts = label.split('-');
  const year = parts[0] ?? '';
  const month = parts[1] ?? '';
  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const monthName = monthNames[parseInt(month, 10) - 1] || month;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
      <p className="text-sm font-medium text-gray-600">
        {monthName} {year}
      </p>
      <p className="text-base font-bold text-blue-600">{formattedValue}</p>
    </div>
  );
}

export function PatrimonyChart({ months }: PatrimonyChartProps) {
  const [data, setData] = useState<PatrimonyPoint[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [showSpinner, setShowSpinner] = useState(false);
  const loadStartTime = useRef<number>(0);
  const spinnerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoadingState('loading');
      loadStartTime.current = Date.now();

      // Show spinner if loading takes longer than expected (approaching 3s limit)
      spinnerTimeout.current = setTimeout(() => {
        if (!cancelled) {
          setShowSpinner(true);
        }
      }, 1000);

      try {
        const queryParam = months ? `?months=${months}` : '';
        const response = await apiClient.get<PatrimonyPoint[]>(
          `/dashboard/patrimony-history${queryParam}`
        );

        if (!cancelled) {
          setData(response.data);
          setLoadingState('success');
        }
      } catch {
        if (!cancelled) {
          setLoadingState('error');
        }
      } finally {
        if (!cancelled) {
          setShowSpinner(false);
          if (spinnerTimeout.current) {
            clearTimeout(spinnerTimeout.current);
          }
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
      if (spinnerTimeout.current) {
        clearTimeout(spinnerTimeout.current);
      }
    };
  }, [months]);

  // Loading state with spinner
  if (loadingState === 'loading' || loadingState === 'idle') {
    return (
      <div
        className="flex h-64 w-full items-center justify-center rounded-lg border border-gray-200 bg-white sm:h-80"
        role="status"
        aria-label="Carregando gráfico de evolução patrimonial"
      >
        {showSpinner ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
              aria-hidden="true"
            />
            <span className="text-sm text-gray-500">Carregando dados...</span>
          </div>
        ) : (
          <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" aria-hidden="true" />
        )}
      </div>
    );
  }

  // Error state
  if (loadingState === 'error') {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white sm:h-80">
        <p className="text-sm text-red-600">
          Não foi possível carregar os dados do gráfico.
        </p>
        <button
          type="button"
          onClick={() => setLoadingState('idle')}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Message when < 2 months of data available
  if (data.length < 2) {
    return (
      <div className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:h-80">
        <svg
          className="h-12 w-12 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
        <p className="text-center text-sm text-gray-500">
          {data.length === 0
            ? 'Nenhum dado disponível. Cadastre seus ativos para visualizar a evolução patrimonial.'
            : 'Dados adicionais serão exibidos conforme novos meses forem registrados.'}
        </p>
        {data.length === 1 && (
          <p className="text-center text-xs text-gray-400">
            Patrimônio atual:{' '}
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(data[0]?.value ?? 0)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-4 text-base font-semibold text-gray-900 sm:text-lg">
        Evolução Patrimonial
      </h3>
      <div className="h-56 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthLabel}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatBRL}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3, fill: '#2563eb' }}
              activeDot={{ r: 5, fill: '#1d4ed8' }}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PatrimonyChart;
