/**
 * Unit tests for Toast component.
 * Validates: Requirements 13.4 (success: green, 5s auto-dismiss), 13.5 (error: red, manual dismiss)
 */

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Toast, ToastContainer, ToastMessage } from './Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Success toast (Req 13.4)', () => {
    it('renders with green styling', () => {
      const toast: ToastMessage = { id: '1', type: 'success', message: 'Sucesso!' };
      const onDismiss = vi.fn();

      const { container } = render(<Toast toast={toast} onDismiss={onDismiss} />);
      const element = container.querySelector('[role="alert"]');
      expect(element!.className).toContain('bg-green-50');
      expect(element!.className).toContain('border-green-400');
    });

    it('auto-dismisses after 5 seconds', () => {
      const toast: ToastMessage = { id: '1', type: 'success', message: 'Sucesso!' };
      const onDismiss = vi.fn();

      render(<Toast toast={toast} onDismiss={onDismiss} />);

      // Not dismissed before 5 seconds
      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(onDismiss).not.toHaveBeenCalled();

      // Dismissed after 5 seconds + fade out (300ms)
      act(() => {
        vi.advanceTimersByTime(301);
      });
      expect(onDismiss).toHaveBeenCalledWith('1');
    });

    it('has minimum 44x44px touch target on dismiss button (Req 12.3)', () => {
      const toast: ToastMessage = { id: '1', type: 'success', message: 'Sucesso!' };
      const onDismiss = vi.fn();

      render(<Toast toast={toast} onDismiss={onDismiss} />);
      const dismissButton = screen.getByLabelText('Fechar notificação');
      expect(dismissButton.className).toContain('min-h-[44px]');
      expect(dismissButton.className).toContain('min-w-[44px]');
    });
  });

  describe('Error toast (Req 13.5)', () => {
    it('renders with red styling', () => {
      const toast: ToastMessage = { id: '2', type: 'error', message: 'Erro!' };
      const onDismiss = vi.fn();

      const { container } = render(<Toast toast={toast} onDismiss={onDismiss} />);
      const element = container.querySelector('[role="alert"]');
      expect(element!.className).toContain('bg-red-50');
      expect(element!.className).toContain('border-red-400');
    });

    it('does NOT auto-dismiss (persistent until manual dismiss)', () => {
      const toast: ToastMessage = { id: '2', type: 'error', message: 'Erro!' };
      const onDismiss = vi.fn();

      render(<Toast toast={toast} onDismiss={onDismiss} />);

      // Even after 10 seconds, should NOT auto-dismiss
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('dismisses when user clicks the close button', () => {
      const toast: ToastMessage = { id: '2', type: 'error', message: 'Erro!' };
      const onDismiss = vi.fn();

      render(<Toast toast={toast} onDismiss={onDismiss} />);
      const dismissButton = screen.getByLabelText('Fechar notificação');
      dismissButton.click();
      expect(onDismiss).toHaveBeenCalledWith('2');
    });
  });
});

describe('ToastContainer', () => {
  it('renders nothing when toasts array is empty', () => {
    const { container } = render(
      <ToastContainer toasts={[]} onDismiss={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders multiple toasts', () => {
    const toasts: ToastMessage[] = [
      { id: '1', type: 'success', message: 'Sucesso 1' },
      { id: '2', type: 'error', message: 'Erro 1' },
    ];

    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);
    expect(screen.getByText('Sucesso 1')).toBeInTheDocument();
    expect(screen.getByText('Erro 1')).toBeInTheDocument();
  });
});
