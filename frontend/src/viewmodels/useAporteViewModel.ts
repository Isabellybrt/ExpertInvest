/**
 * Aporte ViewModel hook following MVVM pattern.
 * Encapsulates aporte registration, validation, history retrieval, and UI state.
 * Handles both new position and existing position flows.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 13.4, 13.5
 */

import { useState, useCallback } from 'react';
import aporteService from '../services/aporteService';
import type { AporteResult, CreateAporteDTO } from '../services/aporteService';
import { ApiClientError } from '../services/api';
import type { ToastMessage } from '../components/Toast';

export interface AporteValidationErrors {
  assetType?: string;
  assetId?: string;
  amount?: string;
  shares?: string;
  pricePerShare?: string;
  date?: string;
  // New position fields
  institution?: string;
  maturityDate?: string;
  rateType?: string;
  rateValue?: string;
  ticker?: string;
}

export interface AporteFormData {
  assetType: 'RENDA_FIXA' | 'FII';
  isNewPosition: boolean;
  assetId?: string;
  amount?: number;
  shares?: number;
  pricePerShare?: number;
  date: string;
  // New position — Renda Fixa
  institution?: string;
  maturityDate?: string;
  rateType?: 'CDI_PERCENTAGE' | 'IPCA_PLUS';
  rateValue?: number;
  // New position — FII
  ticker?: string;
}

export interface UseAporteViewModel {
  // State
  aporteHistory: AporteResult[];
  isLoading: boolean;
  validationErrors: AporteValidationErrors;
  toasts: ToastMessage[];

  // Actions
  loadAportes: () => Promise<void>;
  loadAportesByAsset: (assetId: string, assetType: 'RENDA_FIXA' | 'FII') => Promise<void>;
  registerAporte: (data: AporteFormData) => Promise<boolean>;
  deleteAporte: (id: string) => Promise<boolean>;
  validateForm: (data: AporteFormData) => AporteValidationErrors;
  dismissToast: (id: string) => void;
  clearValidationErrors: () => void;
}

let toastIdCounter = 0;
function generateToastId(): string {
  toastIdCounter += 1;
  return `aporte-toast-${Date.now()}-${toastIdCounter}`;
}

export function useAporteViewModel(): UseAporteViewModel {
  const [aporteHistory, setAporteHistory] = useState<AporteResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<AporteValidationErrors>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

  const validateForm = useCallback((data: AporteFormData): AporteValidationErrors => {
    const errors: AporteValidationErrors = {};

    // Date is always required
    if (!data.date || data.date.trim() === '') {
      errors.date = 'Data do aporte é obrigatória';
    }

    // Existing position requires assetId
    if (!data.isNewPosition && (!data.assetId || data.assetId.trim() === '')) {
      errors.assetId = 'Selecione um ativo existente';
    }

    if (data.assetType === 'RENDA_FIXA') {
      // Amount validation (Req 3.1, 3.5)
      if (data.amount === undefined || data.amount === null || isNaN(data.amount)) {
        errors.amount = 'Valor do aporte é obrigatório';
      } else if (data.amount < 0.01) {
        errors.amount = 'Valor deve ser no mínimo R$ 0,01';
      } else if (data.amount > 999_999_999.99) {
        errors.amount = 'Valor deve ser no máximo R$ 999.999.999,99';
      }

      // New position fields (Req 3.3)
      if (data.isNewPosition) {
        if (!data.institution || data.institution.trim() === '') {
          errors.institution = 'Instituição é obrigatória';
        } else if (data.institution.length > 100) {
          errors.institution = 'Instituição deve ter no máximo 100 caracteres';
        }

        if (!data.maturityDate || data.maturityDate.trim() === '') {
          errors.maturityDate = 'Data de vencimento é obrigatória';
        } else if (new Date(data.maturityDate) <= new Date()) {
          errors.maturityDate = 'Data de vencimento deve ser futura';
        }

        if (!data.rateType) {
          errors.rateType = 'Tipo de taxa é obrigatório';
        }

        if (data.rateValue === undefined || data.rateValue === null || isNaN(data.rateValue)) {
          errors.rateValue = 'Valor da taxa é obrigatório';
        } else if (data.rateType === 'CDI_PERCENTAGE') {
          if (data.rateValue < 1 || data.rateValue > 999) {
            errors.rateValue = 'Taxa CDI deve ser entre 1% e 999%';
          }
        } else if (data.rateType === 'IPCA_PLUS') {
          if (data.rateValue < 0.01 || data.rateValue > 99.99) {
            errors.rateValue = 'Taxa IPCA+ deve ser entre 0,01% e 99,99%';
          }
        }
      }
    } else if (data.assetType === 'FII') {
      // Shares validation (Req 3.2, 3.5)
      if (data.shares === undefined || data.shares === null || isNaN(data.shares)) {
        errors.shares = 'Quantidade de cotas é obrigatória';
      } else if (!Number.isInteger(data.shares)) {
        errors.shares = 'Quantidade de cotas deve ser um número inteiro';
      } else if (data.shares < 1) {
        errors.shares = 'Quantidade de cotas deve ser no mínimo 1';
      }

      // Price per share validation (Req 3.2, 3.5)
      if (data.pricePerShare === undefined || data.pricePerShare === null || isNaN(data.pricePerShare)) {
        errors.pricePerShare = 'Preço por cota é obrigatório';
      } else if (data.pricePerShare <= 0) {
        errors.pricePerShare = 'Preço por cota deve ser positivo';
      }

      // New position fields (Req 3.3)
      if (data.isNewPosition) {
        if (!data.ticker || data.ticker.trim() === '') {
          errors.ticker = 'Ticker é obrigatório';
        } else if (!/^[A-Z]{4}\d{2}$/.test(data.ticker)) {
          errors.ticker = 'Ticker deve seguir formato: 4 letras maiúsculas + 2 dígitos (ex: MXRF11)';
        }
      }
    }

    setValidationErrors(errors);
    return errors;
  }, []);

  const loadAportes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await aporteService.list();
      setAporteHistory(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        addToast('error', err.message);
      } else {
        addToast('error', 'Erro ao carregar histórico de aportes. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const loadAportesByAsset = useCallback(async (assetId: string, assetType: 'RENDA_FIXA' | 'FII') => {
    setIsLoading(true);
    try {
      const data = await aporteService.listByAsset(assetId, assetType);
      setAporteHistory(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        addToast('error', err.message);
      } else {
        addToast('error', 'Erro ao carregar aportes do ativo. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const registerAporte = useCallback(async (formData: AporteFormData): Promise<boolean> => {
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      return false;
    }

    setIsLoading(true);
    setValidationErrors({});

    try {
      let dto: CreateAporteDTO;

      if (formData.assetType === 'RENDA_FIXA') {
        dto = {
          assetType: 'RENDA_FIXA',
          assetId: formData.isNewPosition ? undefined : formData.assetId,
          amount: formData.amount!,
          date: new Date(formData.date).toISOString(),
          ...(formData.isNewPosition && {
            institution: formData.institution,
            maturityDate: new Date(formData.maturityDate!).toISOString(),
            rateType: formData.rateType,
            rateValue: formData.rateValue,
          }),
        };
      } else {
        dto = {
          assetType: 'FII',
          assetId: formData.isNewPosition ? undefined : formData.assetId,
          shares: formData.shares!,
          pricePerShare: formData.pricePerShare!,
          date: new Date(formData.date).toISOString(),
          ...(formData.isNewPosition && {
            ticker: formData.ticker,
          }),
        };
      }

      const result = await aporteService.create(dto);
      setAporteHistory((prev) => [result, ...prev]);
      addToast('success', 'Aporte registrado com sucesso!');
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.errors) {
          const fieldErrors: AporteValidationErrors = {};
          for (const [key, msgs] of Object.entries(err.errors)) {
            (fieldErrors as any)[key] = msgs[0];
          }
          setValidationErrors(fieldErrors);
        }
        addToast('error', err.message || 'Erro ao registrar aporte. Tente novamente.');
      } else {
        addToast('error', 'Erro inesperado. Tente novamente.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [validateForm, addToast]);

  const deleteAporte = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await aporteService.delete(id);
      setAporteHistory((prev) => prev.filter((a) => a.id !== id));
      addToast('success', 'Aporte removido com sucesso!');
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) {
        addToast('error', err.message || 'Erro ao remover aporte. Tente novamente.');
      } else {
        addToast('error', 'Erro inesperado. Tente novamente.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  return {
    aporteHistory,
    isLoading,
    validationErrors,
    toasts,
    loadAportes,
    loadAportesByAsset,
    registerAporte,
    deleteAporte,
    validateForm,
    dismissToast,
    clearValidationErrors,
  };
}

export type { AporteResult, CreateAporteDTO };
