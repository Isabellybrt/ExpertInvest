/**
 * Reusable Toast notification component.
 * - Success: green, auto-dismiss in 5 seconds (Req 13.4)
 * - Error: red, persistent until manual dismiss (Req 13.5)
 */

import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (toast.type === 'success') {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss(toast.id), 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.type, onDismiss]);

  const bgColor = toast.type === 'success' ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400';
  const textColor = toast.type === 'success' ? 'text-green-800' : 'text-red-800';
  const iconColor = toast.type === 'success' ? 'text-green-400' : 'text-red-400';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-3 rounded-md border-l-4 p-4 shadow-md transition-opacity duration-300 ${bgColor} ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {toast.type === 'success' ? (
        <svg className={`h-5 w-5 flex-shrink-0 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className={`h-5 w-5 flex-shrink-0 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )}
      <p className={`flex-1 text-sm font-medium ${textColor}`}>{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className={`min-h-[44px] min-w-[44px] rounded-md p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          toast.type === 'success' ? 'hover:bg-green-100 focus:ring-green-500' : 'hover:bg-red-100 focus:ring-red-500'
        }`}
        aria-label="Fechar notificação"
      >
        <svg className={`h-5 w-5 ${iconColor}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default Toast;
