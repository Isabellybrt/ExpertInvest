/**
 * FII ViewModel hook following MVVM pattern.
 * Encapsulates FII CRUD operations, validation, and UI state.
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 13.2, 13.4, 13.5
 */

import { useState, useCallback } from 'react';
import fiiService from '../services/fiiService';
import type { FIIAsset, CreateFIIDTO, UpdateFIIDTO } from '../services/fiiService';
import { ApiClientError } from '../services/api';

const TICKER_REGEX = /^[A-Z]{4}\d{2}$/;

export interface FIIValidationErrors {
  ticker?: string;
  shares?: string;
  averagePrice?: string;
  purchaseDate?: string;
}

export interface UseFIIViewModel {
  // State
  fiiList: FIIAsset[];
  isLoading: boolean;
  error: string | null;
  validationErrors: FIIValidationErrors;
  toasts: Array<{ id: string; type: 'success' | 'error'; message: string }>;
  confirmModal: { isOpen: boolean; fiiId: string | null };

  // Actions
  loadFIIs: () => Promise<void>;
  createFII: (data: CreateFIIDTO) => Promise<boolean>;
  updateFII: (id: string, data: UpdateFIIDTO) => Promise<boolean>;
  deleteFII: (id: string) => Promise<void>;
  requestDelete: (id: string) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  validateForm: (data: Partial<CreateFIIDTO>) => FIIValidationErrors;
  validateTicker: (ticker: string) => boolean;
  dismissToast: (id: string) => void;
  clearError: () => void;
}

export function useFIIViewModel(): UseFIIViewModel {
  const [fiiList, setFiiList] = useState<FIIAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<FIIValidationErrors>({});
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error'; message: string }>>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; fiiId: string | null }>({
    isOpen: false,
    fiiId: null,
  });

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const validateTicker = useCallback((ticker: string): boolean => {
    return TICKER_REGEX.test(ticker);
  }, []);

  const validateForm = useCallback((data: Partial<CreateFIIDTO>): FIIValidationErrors => {
    const errors: FIIValidationErrors = {};

    if (!data.ticker || data.ticker.trim() === '') {
      errors.ticker = 'Ticker é obrigatório';
    } else if (!TICKER_REGEX.test(data.ticker)) {
      errors.ticker = 'Ticker deve seguir formato: 4 letras maiúsculas + 2 dígitos (ex: MXRF11)';
    }

    if (data.shares === undefined || data.shares === null) {
      errors.shares = 'Quantidade de cotas é obrigatória';
    } else if (!Number.isInteger(data.shares)) {
      errors.shares = 'Quantidade de cotas deve ser um número inteiro';
    } else if (data.shares < 1) {
      errors.shares = 'Quantidade de cotas deve ser no mínimo 1';
    }

    if (data.averagePrice === undefined || data.averagePrice === null) {
      errors.averagePrice = 'Preço médio é obrigatório';
    } else if (data.averagePrice <= 0) {
      errors.averagePrice = 'Preço médio deve ser positivo';
    }

    if (!data.purchaseDate || data.purchaseDate.trim() === '') {
      errors.purchaseDate = 'Data de compra é obrigatória';
    }

    return errors;
  }, []);

  const loadFIIs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fiiService.list();
      setFiiList(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Erro ao carregar FIIs. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createFII = useCallback(async (data: CreateFIIDTO): Promise<boolean> => {
    const errors = validateForm(data);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return false;
    }

    setIsLoading(true);
    setError(null);
    setValidationErrors({});

    try {
      const created = await fiiService.create(data);
      setFiiList((prev) => [...prev, created]);
      addToast('success', `FII ${created.ticker} cadastrado com sucesso!`);
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) {
        addToast('error', err.message || 'Erro ao cadastrar FII. Tente novamente.');
      } else {
        addToast('error', 'Erro inesperado. Tente novamente.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, addToast]);

  const updateFII = useCallback(async (id: string, data: UpdateFIIDTO): Promise<boolean> => {
    const errors = validateForm(data as Partial<CreateFIIDTO>);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return false;
    }

    setIsLoading(true);
    setError(null);
    setValidationErrors({});

    try {
      const updated = await fiiService.update(id, data);
      setFiiList((prev) => prev.map((fii) => (fii.id === id ? updated : fii)));
      addToast('success', `FII ${updated.ticker} atualizado com sucesso!`);
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) {
        addToast('error', err.message || 'Erro ao atualizar FII. Tente novamente.');
      } else {
        addToast('error', 'Erro inesperado. Tente novamente.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, addToast]);

  const requestDelete = useCallback((id: string) => {
    setConfirmModal({ isOpen: true, fiiId: id });
  }, []);

  const cancelDelete = useCallback(() => {
    setConfirmModal({ isOpen: false, fiiId: null });
  }, []);

  const confirmDelete = useCallback(async () => {
    const id = confirmModal.fiiId;
    if (!id) return;

    setConfirmModal({ isOpen: false, fiiId: null });
    setIsLoading(true);

    try {
      await fiiService.delete(id);
      setFiiList((prev) => prev.filter((fii) => fii.id !== id));
      addToast('success', 'FII removido com sucesso!');
    } catch (err) {
      if (err instanceof ApiClientError) {
        addToast('error', err.message || 'Erro ao remover FII. Tente novamente.');
      } else {
        addToast('error', 'Erro inesperado. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [confirmModal.fiiId, addToast]);

  const deleteFII = useCallback(async (id: string) => {
    requestDelete(id);
  }, [requestDelete]);

  const clearError = useCallback(() => {
    setError(null);
    setValidationErrors({});
  }, []);

  return {
    fiiList,
    isLoading,
    error,
    validationErrors,
    toasts,
    confirmModal,
    loadFIIs,
    createFII,
    updateFII,
    deleteFII,
    requestDelete,
    confirmDelete,
    cancelDelete,
    validateForm,
    validateTicker,
    dismissToast,
    clearError,
  };
}

export type { FIIAsset, CreateFIIDTO, UpdateFIIDTO };
