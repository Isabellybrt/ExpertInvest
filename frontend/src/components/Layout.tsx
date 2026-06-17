/**
 * Layout — Responsive container wrapper for all application views.
 * Ensures Mobile First layout with:
 * - No horizontal scrollbar from 320px to 1920px (Req 12.1)
 * - Single column on mobile < 768px (Req 12.2)
 * - Minimum 44x44px touch targets via global CSS (Req 12.3)
 * - Minimum 16px font size on mobile (Req 12.4)
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4
 */

import React from 'react';
import { ToastContainer, ToastMessage } from './Toast';

interface LayoutProps {
  children: React.ReactNode;
  toasts?: ToastMessage[];
  onDismissToast?: (id: string) => void;
}

/**
 * Main application layout wrapper.
 * Provides consistent responsive padding, max-width container,
 * and toast notification overlay.
 */
export function Layout({ children, toasts = [], onDismissToast }: LayoutProps) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50 text-base">
      {/* Toast notifications — fixed overlay (Req 13.4, 13.5) */}
      {onDismissToast && (
        <ToastContainer toasts={toasts} onDismiss={onDismissToast} />
      )}

      {/* Main content area — responsive container */}
      <main className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export default Layout;
