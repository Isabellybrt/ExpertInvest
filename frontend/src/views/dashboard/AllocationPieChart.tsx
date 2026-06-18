/**
 * AllocationPieChart — Donut chart showing RF% vs FII% allocation.
 * Uses Recharts PieChart with a donut layout.
 * Handles single-class portfolios (100% one class) per Req 8.3.
 *
 * Validates: Requirements 8.2, 8.3
 */

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export interface AllocationPieChartProps {
  rendaFixaPercentage: number;
  fiiPercentage: number;
  rendaFixaTotal: number;
  fiiTotal: number;
}

const COLORS = {
  rendaFixa: '#3B82F6', // blue-500
  fii: '#8B5CF6',       // purple-500
};

interface ChartEntry {
  name: string;
  value: number;
  total: number;
  color: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartEntry }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const entry = payload[0]?.payload;
    if (!entry) return null;
    return (
      <div className="bg-white shadow-lg rounded-lg p-3 border border-gray-200">
        <p className="font-medium text-sm text-gray-900">{entry.name}</p>
        <p className="text-sm text-gray-600">
          {entry.value.toFixed(2)}% — {formatCurrency(entry.total)}
        </p>
      </div>
    );
  }
  return null;
};

export const AllocationPieChart: React.FC<AllocationPieChartProps> = ({
  rendaFixaPercentage,
  fiiPercentage,
  rendaFixaTotal,
  fiiTotal,
}) => {
  const data: ChartEntry[] = [];

  if (rendaFixaPercentage > 0) {
    data.push({
      name: 'Renda Fixa',
      value: rendaFixaPercentage,
      total: rendaFixaTotal,
      color: COLORS.rendaFixa,
    });
  }

  if (fiiPercentage > 0) {
    data.push({
      name: 'FIIs',
      value: fiiPercentage,
      total: fiiTotal,
      color: COLORS.fii,
    });
  }

  // No data fallback
  if (data.length === 0) {
    return (
      <div
        className="w-full rounded-xl bg-white shadow-sm border border-gray-200 p-4 md:p-6"
        data-testid="allocation-chart-empty"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Alocação</h3>
        <p className="text-sm text-gray-500 text-center py-8">
          Nenhum ativo cadastrado para exibir alocação.
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-xl bg-white shadow-sm border border-gray-200 p-4 md:p-6"
      data-testid="allocation-chart"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Alocação</h3>

      <div className="w-full h-64 md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              aria-label="Gráfico de alocação de ativos"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke={entry.color}
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value: string) => (
                <span className="text-sm text-gray-700">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Percentage labels below chart */}
      <div className="flex justify-center gap-6 mt-2">
        {rendaFixaPercentage > 0 && (
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.rendaFixa }}
              aria-hidden="true"
            />
            <span className="text-sm text-gray-700">
              RF: {rendaFixaPercentage.toFixed(2)}%
            </span>
          </div>
        )}
        {fiiPercentage > 0 && (
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS.fii }}
              aria-hidden="true"
            />
            <span className="text-sm text-gray-700">
              FII: {fiiPercentage.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllocationPieChart;
