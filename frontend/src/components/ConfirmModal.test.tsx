/**
 * Unit tests for ConfirmModal component.
 * Validates: Requirements 13.2 (modal with description, confirm, cancel), 13.3 (cancel preserves state)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Excluir ativo',
    message: 'Tem certeza que deseja excluir este ativo? Esta ação não pode ser desfeita.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ConfirmModal {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal with title and message (Req 13.2)', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('Excluir ativo')).toBeInTheDocument();
    expect(
      screen.getByText('Tem certeza que deseja excluir este ativo? Esta ação não pode ser desfeita.')
    ).toBeInTheDocument();
  });

  it('renders confirm and cancel buttons (Req 13.2)', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('Confirmar')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked (Req 13.3)', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);
    screen.getByText('Cancelar').click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);
    screen.getByText('Confirmar').click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('has aria-modal and dialog role for accessibility', () => {
    render(<ConfirmModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has minimum 44x44px touch targets on buttons (Req 12.3)', () => {
    render(<ConfirmModal {...defaultProps} />);
    const confirmBtn = screen.getByText('Confirmar');
    const cancelBtn = screen.getByText('Cancelar');
    expect(confirmBtn.className).toContain('min-h-[44px]');
    expect(confirmBtn.className).toContain('min-w-[44px]');
    expect(cancelBtn.className).toContain('min-h-[44px]');
    expect(cancelBtn.className).toContain('min-w-[44px]');
  });

  it('uses custom labels when provided', () => {
    render(
      <ConfirmModal
        {...defaultProps}
        confirmLabel="Sim, excluir"
        cancelLabel="Não, manter"
      />
    );
    expect(screen.getByText('Sim, excluir')).toBeInTheDocument();
    expect(screen.getByText('Não, manter')).toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    render(<ConfirmModal {...defaultProps} isLoading={true} />);
    const confirmBtn = screen.getByText('Excluindo...');
    const cancelBtn = screen.getByText('Cancelar');
    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
  });
});
