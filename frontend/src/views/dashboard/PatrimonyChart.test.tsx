/**
 * Unit tests for PatrimonyChart component.
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 16.1, 16.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { PatrimonyChart, PatrimonyPoint } from './PatrimonyChart';

// Mock the API client module
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '../../services/api';

const mockedApiClient = vi.mocked(apiClient);

// Mock ResizeObserver which Recharts needs
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

describe('PatrimonyChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', async () => {
    // Use a promise that never resolves to keep the component in loading state
    mockedApiClient.get.mockReturnValue(new Promise(() => {}));

    render(<PatrimonyChart />);

    expect(
      screen.getByRole('status', { name: /carregando gráfico/i })
    ).toBeInTheDocument();
  });

  it('shows message when no data is available (0 months)', async () => {
    mockedApiClient.get.mockResolvedValue({ data: [], status: 200 });

    render(<PatrimonyChart />);

    await waitFor(() => {
      expect(
        screen.getByText(/nenhum dado disponível/i)
      ).toBeInTheDocument();
    });
  });

  it('shows message when less than 2 months of data (1 month)', async () => {
    const singlePoint: PatrimonyPoint[] = [{ month: '2024-01', value: 50000 }];
    mockedApiClient.get.mockResolvedValue({ data: singlePoint, status: 200 });

    render(<PatrimonyChart />);

    await waitFor(() => {
      expect(
        screen.getByText(/dados adicionais serão exibidos/i)
      ).toBeInTheDocument();
    });

    // Should also display the current patrimony value
    expect(screen.getByText(/patrimônio atual/i)).toBeInTheDocument();
  });

  it('renders chart title when 2+ months of data available', async () => {
    const data: PatrimonyPoint[] = [
      { month: '2024-01', value: 50000 },
      { month: '2024-02', value: 52000 },
      { month: '2024-03', value: 55000 },
    ];
    mockedApiClient.get.mockResolvedValue({ data, status: 200 });

    render(<PatrimonyChart />);

    await waitFor(() => {
      expect(screen.getByText('Evolução Patrimonial')).toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    mockedApiClient.get.mockRejectedValue(new Error('Network error'));

    render(<PatrimonyChart />);

    await waitFor(() => {
      expect(
        screen.getByText(/não foi possível carregar/i)
      ).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });

  it('passes months query param to API when provided', async () => {
    mockedApiClient.get.mockResolvedValue({ data: [], status: 200 });

    render(<PatrimonyChart months={12} />);

    await waitFor(() => {
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/dashboard/patrimony-history?months=12'
      );
    });
  });

  it('does not pass months query param when not provided', async () => {
    mockedApiClient.get.mockResolvedValue({ data: [], status: 200 });

    render(<PatrimonyChart />);

    await waitFor(() => {
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/dashboard/patrimony-history'
      );
    });
  });

  it('supports up to 60 months of history data', async () => {
    // Generate 60 months of data
    const data: PatrimonyPoint[] = Array.from({ length: 60 }, (_, i) => {
      const date = new Date(2020, i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return { month: `${year}-${month}`, value: 50000 + i * 1000 };
    });

    mockedApiClient.get.mockResolvedValue({ data, status: 200 });

    render(<PatrimonyChart months={60} />);

    await waitFor(() => {
      expect(screen.getByText('Evolução Patrimonial')).toBeInTheDocument();
    });
  });

  it('shows spinner after loading takes more than 1 second', async () => {
    vi.useFakeTimers();

    let resolvePromise: (value: { data: PatrimonyPoint[]; status: number }) => void;
    const promise = new Promise<{ data: PatrimonyPoint[]; status: number }>((resolve) => {
      resolvePromise = resolve;
    });
    mockedApiClient.get.mockReturnValue(promise);

    render(<PatrimonyChart />);

    // Spinner not visible yet
    expect(screen.queryByText('Carregando dados...')).not.toBeInTheDocument();

    // Advance past the 1s spinner delay
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getByText('Carregando dados...')).toBeInTheDocument();

    // Resolve the promise to clean up
    await act(async () => {
      resolvePromise!({ data: [], status: 200 });
    });

    vi.useRealTimers();
  });
});
