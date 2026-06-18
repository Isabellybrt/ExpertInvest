/**
 * Renda Fixa ViewModel hook following MVVM pattern.
 * Encapsulates CRUD operations, form validation, toast, and confirmation logic.
 */

import { useState, useCallback } from 'react';
import { validateRendaFixa } from '@shared';
import type { CreateRendaFixaDTO, ValidationResult } from '@shared';
import rendaFixaService from '../services/rendaFixaService';
import type { RendaFixaAsset, UpdateRendaFixaDTO } from '../services/rendaFixaService';
import { ApiClientError } from '../services/api';
import type { ToastMessage } from '../components/Toast';

interface UseRendaFixaViewModel {
  // State
  rendaFixaList: RendaFixaAsset[];
  isLoading: boolean;
  validationErrors: Record<string, string>;
  toasts: ToastMessage[];
  deleteConfirm: { isOpen: boolean; id: string; institution: string } | null;

  // Actions
  loadRendaFixa: () => Promise<void>;
  createRendaFixa: (data: CreateRendaFixaDTO) => Promise<boolean>;
  updateRendaFixa: (id: string, data: UpdateRendaFixaDTO) => Promise<boolean>;
  deleteRendaFixa: (id: string) => Promise<void>;
  requestDelete: (id: string, institution: string) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  validateForm: (data: Partial<CreateRendaFixaDTO>) => ValidationResult;
  dismissToast: (id: string) => void;
  clearValidationErrors: () => void;
}

let toastIdCounter = 0;
function generateToastId(): string {
  toastIdCounter += 1;
  return `toast-${Date.now()}-${toastIdCounter}`;
}

export function useRendaFixaViewModel(): UseRendaFixaViewModel {
  const [rendaFixaList, setRendaFixaList] = useState<RendaFixaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; institution: string } | null>(null);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const toast: ToastMessage = { id: generateToastId(), type, message };
    setToasts((prev) => [...prev, toast]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearValidationErrors = useCallback(() => {
    setValidationErrors({});
  }, []);

  const validateForm = useCallback((data: Partial<CreateRendaFixaDTO>): ValidationResult => {
    const result = validateRendaFixa(data);
    if (!result.success) {
      setValidationErrors(result.errors);
    } else {
      setValidationErrors({});
    }
    return result;
  }, []);

  const loadRendaFixa = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await rendaFixaService.list();
      setRendaFixaList(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        addToast('error', err.message);
      } else {
        addToast('error', 'Erro ao carregar títulos. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const createRendaFixa = useCallback(async (data: CreateRendaFixaDTO): Promise<boolean> => {
    const validation = validateRendaFixa(data);
    if (!validation.success) {
      setValidationErrors(validation.errors);
      return false;
    }

    setIsLoading(true);
    setValidationErrors({});

    try {
      const newAsset = await rendaFixaService.create(data);
      setRendaFixaList((prev) => [...prev, newAsset]);
      addToast('success', `Título "${newAsset.institution}" cadastrado com sucesso.`);
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.errors) {
          const entries = Object.entries(err.errors).map(([key, msgs]) => [key, msgs[0]] as const);
          setValidationErrors(Object.fromEntries(entries) as Record<string, string>);
        }
        addToast('error', err.message);
      } else {
        addToast('error', 'Erro inesperado ao cadastrar título. Tente novamente.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const updateRendaFixa = useCallback(async (id: string, data: UpdateRendaFixaDTO): Promise<boolean> => {
    const fullData = data as CreateRendaFixaDTO;
    const validation = validateRendaFixa(fullData);
    if (!validation.success) {
      setValidationErrors(validation.errors);
      return false;
    }

    setIsLoading(true);
    setValidationErrors({});

    try {
      const updatedAsset = await rendaFixaService.update(id, data);
      setRendaFixaList((prev) =>
        prev.map((item) => (item.id === id ? updatedAsset : item))
      );
      addToast('success', `Título "${updatedAsset.institution}" atualizado com sucesso.`);
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.errors) {
          const entries = Object.entries(err.errors).map(([key, msgs]) => [key, msgs[0]] as const);
          setValidationErrors(Object.fromEntries(entries) as Record<string, string>);
        }
        addToast('error', err.message);
      } else {
        addToast('error', 'Erro inesperado ao atualizar título. Tente novamente.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const requestDelete = useCallback((id: string, institution: string) => {
    setDeleteConfirm({ isOpen: true, id, institution });
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const { id, institution } = deleteConfirm;

    setIsLoading(true);
    try {
      await rendaFixaService.delete(id);
      setRendaFixaList((prev) => prev.filter((item) => item.id !== id));
      addToast('success', `Título "${institution}" excluído com sucesso.`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        addToast('error', err.message);
      } else {
        addToast('error', 'Erro inesperado ao excluir título. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, addToast]);

  const deleteRendaFixa = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      await rendaFixaService.delete(id);
      setRendaFixaList((prev) => prev.filter((item) => item.id !== id));
      addToast('success', 'Título excluído com sucesso.');
    } catch (err) {
      if (err instanceof ApiClientError) {
        addToast('error', err.message);
      } else {
        addToast('error', 'Erro inesperado ao excluir título. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  return {
    rendaFixaList,
    isLoading,
    validationErrors,
    toasts,
    deleteConfirm,
    loadRendaFixa,
    createRendaFixa,
    updateRendaFixa,
    deleteRendaFixa,
    requestDelete,
    cancelDelete,
    confirmDelete,
    validateForm,
    dismissToast,
    clearValidationErrors,
  };
}

export type { UseRendaFixaViewModel };
