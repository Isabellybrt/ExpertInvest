/**
 * Unit tests for FIIPortfolioTable component.
 * Tests rendering states (loading, error, empty, data), column headers,
 * currency formatting, and read-only behavior.
 *
 * Validates: Requirements 1.2, 1.4, 1.6, 7.1, 7.2, 7.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FIIPortfolioTable } from '../FIIPortfolioTable';

// Mock the viewmodel hook
vi.mock('../../../viewmodels/useFIIPortfolioViewModel', () => ({
  useFIIPortfolioViewModel: vi.fn(),
}));

import { useFIIPortfolioViewModel } from '../../../viewmodels/useFIIPortfolioViewModel';

const mockedUseViewModel = useFIIPortfolioViewModel as ReturnType<typeof vi.fn>;

describe('FIIPortfolioTable', () => {
  const mockLoadPortfolio = vi.fn();
  const mockRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('displays loading state while fetching', () => {
      mockedUseViewModel.mockReturnValue({
        portfolioItems: [],
        isLoading: true,
        error: null,
        loadPortfolio: mockLoadPortfolio,
        retry: mockRetry,
      });

      render(<FIIPortfolioTable />);

      expect(screen.getByText('Carregando portfólio...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Error state', () => {
    it('shows error state with retry button on failure', () => {
      mockedUseViewModel.mockReturnValue({
        portfolioItems: [],
        isLoading: false,
        error: 'Não foi possível carregar os dados do portfólio. Tente novamente.',
        loadPortfolio: mockLoadPortfolio,
        retry: mockRetry,
      });

      render(<FIIPortfolioTable />);

      expect(
        screen.getByText('Não foi possível carregar os dados do portfólio. Tente novamente.')
      ).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /tentar novamente/i });
      expect(retryButton).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no items returned', () => {
      mockedUseViewModel.mockReturnValue({
        portfolioItems: [],
        isLoading: false,
        error: null,
        loadPortfolio: mockLoadPortfolio,
        retry: mockRetry,
      });

      render(<FIIPortfolioTable />);

      expect(
        screen.getByText(/Você ainda não possui FIIs cadastrados/i)
      ).toBeInTheDocument();
    });
  });

  describe('Table rendering', () => {
    const mockPortfolioItems = [
      {
        ticker: 'HGLG11',
        shares: 50,
        averagePrice: 160.75,
        lastMonthDividend: 8.5,
        projectedMonthlyYield: 8.5,
      },
      {
        ticker: 'MXRF11',
        shares: 100,
        averagePrice: 10.25,
        lastMonthDividend: 1.0,
        projectedMonthlyYield: 1.0,
      },
    ];

    beforeEach(() => {
      mockedUseViewModel.mockReturnValue({
        portfolioItems: mockPortfolioItems,
        isLoading: false,
        error: null,
        loadPortfolio: mockLoadPortfolio,
        retry: mockRetry,
      });
    });

    it('renders table with correct column headers', () => {
      render(<FIIPortfolioTable />);

      expect(screen.getByText('Ticker')).toBeInTheDocument();
      expect(screen.getByText('Cotas')).toBeInTheDocument();
      expect(screen.getByText('Preço Médio')).toBeInTheDocument();
      expect(screen.getByText('Dividendo Último Mês')).toBeInTheDocument();
      expect(screen.getByText('Rendimento Projetado')).toBeInTheDocument();
    });

    it('formats monetary values in pt-BR locale', () => {
      render(<FIIPortfolioTable />);

      // The Intl.NumberFormat with pt-BR locale uses non-breaking space (\u00a0) between R$ and the number.
      // Use regex to match the formatted output regardless of whitespace type.
      // averagePrice 160.75 → R$ 160,75
      expect(screen.getByText(/R\$\s*160,75/)).toBeInTheDocument();

      // lastMonthDividend 8.5 → R$ 8,50
      // There are two cells with 8.50 (lastMonthDividend and projectedMonthlyYield for HGLG11)
      expect(screen.getAllByText(/R\$\s*8,50/).length).toBeGreaterThanOrEqual(1);

      // averagePrice 10.25 → R$ 10,25
      expect(screen.getByText(/R\$\s*10,25/)).toBeInTheDocument();

      // lastMonthDividend 1.0 → R$ 1,00
      expect(screen.getAllByText(/R\$\s*1,00/).length).toBeGreaterThanOrEqual(1);
    });

    it('no edit/delete buttons are rendered (read-only)', () => {
      render(<FIIPortfolioTable />);

      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /deletar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /remover/i })).not.toBeInTheDocument();

      // Verify no input fields exist (read-only text only)
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });
  });
});
