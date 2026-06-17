/**
 * Tests for DividendChart component.
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DividendChart } from './DividendChart';
import type { FIIDividendBreakdown } from './DividendChart';
import type { DividendPoint } from '../../services/dashboardService';

// Mock dashboardService
vi.mock('../../services/dashboardService', () => ({
  default: {
    getDividends: vi.fn(),
  },
}));

// Mock Recharts to avoid rendering issues in test environment
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="bar">{children}</div>
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: () => <div data-testid="cell" />,
  Legend: ({ content }: { content?: unknown }) => {
    // content can be a React element (JSX) — just render it directly
    if (content && typeof content === 'object') {
      return <>{content}</>;
    }
    return <div data-testid="legend" />;
  },
}));

import dashboardService from '../../services/dashboardService';

const mockGetDividends = dashboardService.getDividends as ReturnType<typeof vi.fn>;

function createMockDividendData(): DividendPoint[] {
  const now = new Date();
  const points: DividendPoint[] = [];

  // 12 months historical
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    points.push({ month, value: 150.0 + i * 10, isProjection: false });
  }

  // 6 months projected
  for (let i = 1; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    points.push({ month, value: 180.0, isProjection: true });
  }

  return points;
}

function createEmptyDividendData(): DividendPoint[] {
  const now = new Date();
  const points: DividendPoint[] = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    points.push({ month, value: 0, isProjection: false });
  }

  for (let i = 1; i <= 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    points.push({ month, value: 0, isProjection: true });
  }

  return points;
}

describe('DividendChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGetDividends.mockReturnValue(new Promise(() => {})); // Never resolves
    render(<DividendChart />);

    expect(screen.getByText('Carregando dividendos...')).toBeInTheDocument();
  });

  it('shows empty state when no dividend data (Req 10.4)', async () => {
    mockGetDividends.mockResolvedValue(createEmptyDividendData());
    render(<DividendChart />);

    await waitFor(() => {
      expect(
        screen.getByText('Não há dados de dividendos disponíveis.')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('Os dividendos serão exibidos conforme proventos forem registrados.')
    ).toBeInTheDocument();
  });

  it('renders chart with data when dividend history exists (Req 10.1, 10.2, 10.5)', async () => {
    mockGetDividends.mockResolvedValue(createMockDividendData());
    render(<DividendChart />);

    await waitFor(() => {
      expect(screen.getByText('Evolução de Dividendos')).toBeInTheDocument();
    });

    // Verify chart elements are rendered
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();

    // Verify legend items show historical vs projection distinction
    expect(screen.getAllByText('Recebido').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Projeção').length).toBeGreaterThan(0);
  });

  it('shows error state with retry button on API failure', async () => {
    mockGetDividends.mockRejectedValue(new Error('Network error'));
    render(<DividendChart />);

    await waitFor(() => {
      expect(
        screen.getByText('Erro ao carregar dados de dividendos.')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });

  it('auto-refreshes when refreshTrigger changes (Req 10.3)', async () => {
    mockGetDividends.mockResolvedValue(createMockDividendData());

    const { rerender } = render(<DividendChart refreshTrigger={1} />);

    await waitFor(() => {
      expect(mockGetDividends).toHaveBeenCalledTimes(1);
    });

    // Change trigger to simulate new provento registered
    rerender(<DividendChart refreshTrigger={2} />);

    await waitFor(() => {
      expect(mockGetDividends).toHaveBeenCalledTimes(2);
    });
  });

  it('shows FII breakdown table when fiiBreakdown is provided (Req 6.1, 6.2)', async () => {
    mockGetDividends.mockResolvedValue(createMockDividendData());

    const breakdown: FIIDividendBreakdown[] = [
      {
        ticker: 'MXRF11',
        shares: 100,
        lastDividendPerShare: 0.1,
        projectedValue: 10.0,
      },
      {
        ticker: 'HGLG11',
        shares: 50,
        lastDividendPerShare: 1.5,
        projectedValue: 75.0,
      },
    ];

    render(<DividendChart fiiBreakdown={breakdown} />);

    await waitFor(() => {
      expect(screen.getByText('Detalhamento por FII')).toBeInTheDocument();
    });

    expect(screen.getByText('MXRF11')).toBeInTheDocument();
    expect(screen.getByText('HGLG11')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('shows "Indisponível" for FII with no dividend data (Req 6.4)', async () => {
    mockGetDividends.mockResolvedValue(createMockDividendData());

    const breakdown: FIIDividendBreakdown[] = [
      {
        ticker: 'XPML11',
        shares: 30,
        lastDividendPerShare: 0,
        projectedValue: 0,
      },
    ];

    render(<DividendChart fiiBreakdown={breakdown} />);

    await waitFor(() => {
      expect(screen.getByText('Indisponível')).toBeInTheDocument();
    });
  });

  it('displays subtitle mentioning 12 months history and 6 months projection', async () => {
    mockGetDividends.mockResolvedValue(createMockDividendData());
    render(<DividendChart />);

    await waitFor(() => {
      expect(
        screen.getByText('Histórico (12 meses) e projeção (6 meses) em R$')
      ).toBeInTheDocument();
    });
  });
});
