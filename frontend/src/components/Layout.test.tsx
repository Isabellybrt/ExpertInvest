/**
 * Unit tests for Layout component — responsive wrapper.
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 13.4, 13.5
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Layout } from './Layout';
import { ToastMessage } from './Toast';

describe('Layout', () => {
  it('renders children content', () => {
    render(
      <Layout>
        <p>Hello World</p>
      </Layout>
    );
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('applies overflow-x-hidden to prevent horizontal scrollbar (Req 12.1)', () => {
    const { container } = render(
      <Layout>
        <p>Content</p>
      </Layout>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('overflow-x-hidden');
  });

  it('applies min-h-screen for full viewport height', () => {
    const { container } = render(
      <Layout>
        <p>Content</p>
      </Layout>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('min-h-screen');
  });

  it('applies text-base for minimum 16px font size (Req 12.4)', () => {
    const { container } = render(
      <Layout>
        <p>Content</p>
      </Layout>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('text-base');
  });

  it('uses responsive padding (px-4 on mobile, md:px-6 on tablet)', () => {
    const { container } = render(
      <Layout>
        <p>Content</p>
      </Layout>
    );
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main!.className).toContain('px-4');
    expect(main!.className).toContain('md:px-6');
  });

  it('constrains content width with max-w-7xl', () => {
    const { container } = render(
      <Layout>
        <p>Content</p>
      </Layout>
    );
    const main = container.querySelector('main');
    expect(main!.className).toContain('max-w-7xl');
  });

  it('renders ToastContainer when onDismissToast is provided', () => {
    const toasts: ToastMessage[] = [
      { id: '1', type: 'success', message: 'Operação concluída' },
    ];
    const onDismiss = vi.fn();

    render(
      <Layout toasts={toasts} onDismissToast={onDismiss}>
        <p>Content</p>
      </Layout>
    );

    expect(screen.getByText('Operação concluída')).toBeInTheDocument();
  });

  it('does not render ToastContainer when onDismissToast is not provided', () => {
    const toasts: ToastMessage[] = [
      { id: '1', type: 'success', message: 'Should not show' },
    ];

    render(
      <Layout toasts={toasts}>
        <p>Content</p>
      </Layout>
    );

    expect(screen.queryByText('Should not show')).not.toBeInTheDocument();
  });
});
