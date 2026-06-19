/**
 * Auth ViewModel hook following MVVM pattern.
 * Encapsulates login, register, logout logic and form validation.
 */

import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import authService from '../services/authService';
import type { LoginRequest, RegisterRequest } from '../services/authService';
import { ApiClientError } from '../services/api';

interface ValidationErrors {
  email?: string;
  password?: string;
  name?: string;
}

interface UseAuthViewModel {
  // State
  isLoading: boolean;
  error: string | null;
  validationErrors: ValidationErrors;

  // Actions
  login: (data: LoginRequest) => Promise<boolean>;
  register: (data: RegisterRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  loginWithGoogle: () => void;
  validateLoginForm: (data: Partial<LoginRequest>) => ValidationErrors;
  validateRegisterForm: (data: Partial<RegisterRequest>) => ValidationErrors;
  clearError: () => void;
}

// Password: min 8, max 128 chars, at least one uppercase, one lowercase, one digit
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
// Basic email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useAuthViewModel(): UseAuthViewModel {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const { setAuth, clearAuth } = useAuthStore();

  const validateLoginForm = useCallback((data: Partial<LoginRequest>): ValidationErrors => {
    const errors: ValidationErrors = {};

    if (!data.email || data.email.trim() === '') {
      errors.email = 'E-mail é obrigatório';
    } else if (!EMAIL_REGEX.test(data.email)) {
      errors.email = 'E-mail inválido';
    }

    if (!data.password || data.password.trim() === '') {
      errors.password = 'Senha é obrigatória';
    }

    return errors;
  }, []);

  const validateRegisterForm = useCallback((data: Partial<RegisterRequest>): ValidationErrors => {
    const errors: ValidationErrors = {};

    if (!data.email || data.email.trim() === '') {
      errors.email = 'E-mail é obrigatório';
    } else if (!EMAIL_REGEX.test(data.email)) {
      errors.email = 'E-mail inválido';
    }

    if (!data.password || data.password.trim() === '') {
      errors.password = 'Senha é obrigatória';
    } else if (data.password.length < 8) {
      errors.password = 'Senha deve ter no mínimo 8 caracteres';
    } else if (data.password.length > 128) {
      errors.password = 'Senha deve ter no máximo 128 caracteres';
    } else if (!PASSWORD_REGEX.test(data.password)) {
      errors.password = 'Senha deve conter ao menos uma letra maiúscula, uma minúscula e um dígito';
    }

    return errors;
  }, []);

  const login = useCallback(async (data: LoginRequest): Promise<boolean> => {
    const errors = validateLoginForm(data);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return false;
    }

    setIsLoading(true);
    setError(null);
    setValidationErrors({});

    try {
      const result = await authService.login(data);
      setAuth(result.user, result.tokens);
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) {
        // Generic error message - do not reveal which field is wrong (Req 14.2)
        setError('Credenciais inválidas. Verifique seu e-mail e senha.');
      } else {
        setError('Erro inesperado. Tente novamente.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [setAuth, validateLoginForm]);

  const register = useCallback(async (data: RegisterRequest): Promise<boolean> => {
    const errors = validateRegisterForm(data);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return false;
    }

    setIsLoading(true);
    setError(null);
    setValidationErrors({});

    try {
      const result = await authService.register(data);
      setAuth(result.user, result.tokens);
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setError('Este e-mail já está cadastrado.');
        } else {
          setError(err.message || 'Erro ao criar conta. Tente novamente.');
        }
      } else {
        setError('Erro inesperado. Tente novamente.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [setAuth, validateRegisterForm]);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      clearAuth();
      setIsLoading(false);
      window.location.href = '/login';
    }
  }, [clearAuth]);

  const loginWithGoogle = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authService.loginWithGoogle();
      setAuth(result.user, result.tokens);
    } catch (err: any) {
      setError(err.message || 'Falha ao entrar com Google. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [setAuth]);

  const clearError = useCallback((): void => {
    setError(null);
    setValidationErrors({});
  }, []);

  return {
    isLoading,
    error,
    validationErrors,
    login,
    register,
    logout,
    loginWithGoogle,
    validateLoginForm,
    validateRegisterForm,
    clearError,
  };
}

export type { UseAuthViewModel, ValidationErrors };
