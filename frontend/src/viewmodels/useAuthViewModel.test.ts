import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthViewModel } from './useAuthViewModel';
import { useAuthStore } from '../stores/authStore';

// Mock the auth service
vi.mock('../services/authService', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
    refreshToken: vi.fn(),
  },
}));

// Mock the api module to get ApiClientError
vi.mock('../services/api', () => ({
  apiClient: {},
  ApiClientError: class ApiClientError extends Error {
    status: number;
    errors?: Record<string, string[]>;
    constructor(message: string, status: number, errors?: Record<string, string[]>) {
      super(message);
      this.name = 'ApiClientError';
      this.status = status;
      this.errors = errors;
    }
  },
}));

import authService from '../services/authService';
import { ApiClientError } from '../services/api';

describe('useAuthViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateLoginForm', () => {
    it('should return error for empty email', () => {
      const { result } = renderHook(() => useAuthViewModel());
      const errors = result.current.validateLoginForm({ email: '', password: 'test' });
      expect(errors.email).toBe('E-mail é obrigatório');
    });

    it('should return error for invalid email format', () => {
      const { result } = renderHook(() => useAuthViewModel());
      const errors = result.current.validateLoginForm({ email: 'invalid', password: 'test' });
      expect(errors.email).toBe('E-mail inválido');
    });

    it('should return error for empty password', () => {
      const { result } = renderHook(() => useAuthViewModel());
      const errors = result.current.validateLoginForm({ email: 'test@example.com', password: '' });
      expect(errors.password).toBe('Senha é obrigatória');
    });

    it('should return no errors for valid login form', () => {
      const { result } = renderHook(() => useAuthViewModel());
      const errors = result.current.validateLoginForm({ email: 'test@example.com', password: 'Test123!' });
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('validateRegisterForm', () => {
    it('should return error for password shorter than 8 characters', () => {
      const { result } = renderHook(() => useAuthViewModel());
      const errors = result.current.validateRegisterForm({ email: 'test@example.com', password: 'Ab1' });
      expect(errors.password).toBe('Senha deve ter no mínimo 8 caracteres');
    });

    it('should return error for password longer than 128 characters', () => {
      const { result } = renderHook(() => useAuthViewModel());
      const longPassword = 'Aa1' + 'x'.repeat(126);
      const errors = result.current.validateRegisterForm({ email: 'test@example.com', password: longPassword });
      expect(errors.password).toBe('Senha deve ter no máximo 128 caracteres');
    });

    it('should return error for password without uppercase', () => {
      const { result } = renderHook(() => useAuthViewModel());
      const errors = result.current.validateRegisterForm({ email: 'test@example.com', password: 'abcdefg1' });
      expect(errors.password).toBe('Senha deve conter ao menos uma letra maiúscula, uma minúscula e um dígito');
    });

    it('should return error for password without lowercase', () => {
      const { result } = renderHook(() => useAuthViewModel());
      const errors = result.current.validateRegisterForm({ email: 'test@example.com', password: 'ABCDEFG1' });
      expect(errors.password).toBe('Senha deve conter ao menos uma letra maiúscula, uma minúscula e um dígito');
    });

    it('should return error for password without digit', () => {
      const { result } = renderHook(() => useAuthViewModel());
      const errors = result.current.validateRegisterForm({ email: 'test@example.com', password: 'Abcdefgh' });
      expect(errors.password).toBe('Senha deve conter ao menos uma letra maiúscula, uma minúscula e um dígito');
    });

    it('should return no errors for valid registration form', () => {
      const { result } = renderHook(() => useAuthViewModel());
      const errors = result.current.validateRegisterForm({ email: 'test@example.com', password: 'ValidPass1' });
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('login', () => {
    it('should set validation errors for invalid form and not call API', async () => {
      const { result } = renderHook(() => useAuthViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.login({ email: '', password: '' });
      });

      expect(success).toBe(false);
      expect(result.current.validationErrors.email).toBe('E-mail é obrigatório');
      expect(result.current.validationErrors.password).toBe('Senha é obrigatória');
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should call authService.login and set auth state on success', async () => {
      const mockResult = {
        user: { id: '1', email: 'test@example.com', name: 'Test' },
        tokens: { accessToken: 'token-1', refreshToken: 'refresh-1' },
      };
      vi.mocked(authService.login).mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useAuthViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.login({ email: 'test@example.com', password: 'Test1234' });
      });

      expect(success).toBe(true);
      expect(authService.login).toHaveBeenCalledWith({ email: 'test@example.com', password: 'Test1234' });

      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user).toEqual(mockResult.user);
    });

    it('should show generic error message on failed login (Req 14.2)', async () => {
      vi.mocked(authService.login).mockRejectedValueOnce(
        new ApiClientError('Invalid credentials', 401)
      );

      const { result } = renderHook(() => useAuthViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.login({ email: 'test@example.com', password: 'Wrong1234' });
      });

      expect(success).toBe(false);
      // Generic message - must not reveal which field is incorrect
      expect(result.current.error).toBe('Credenciais inválidas. Verifique seu e-mail e senha.');
    });

    it('should show generic error on unexpected errors', async () => {
      vi.mocked(authService.login).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAuthViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.login({ email: 'test@example.com', password: 'Test1234' });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Erro inesperado. Tente novamente.');
    });
  });

  describe('register', () => {
    it('should set validation errors for weak password', async () => {
      const { result } = renderHook(() => useAuthViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.register({ email: 'test@example.com', password: 'weak' });
      });

      expect(success).toBe(false);
      expect(result.current.validationErrors.password).toBeDefined();
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('should call authService.register and set auth on success', async () => {
      const mockResult = {
        user: { id: '2', email: 'new@example.com', name: 'New User' },
        tokens: { accessToken: 'new-token', refreshToken: 'new-refresh' },
      };
      vi.mocked(authService.register).mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useAuthViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.register({ email: 'new@example.com', password: 'StrongPass1', name: 'New User' });
      });

      expect(success).toBe(true);
      expect(authService.register).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'StrongPass1',
        name: 'New User',
      });

      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user).toEqual(mockResult.user);
    });

    it('should show conflict error for duplicate email (409)', async () => {
      vi.mocked(authService.register).mockRejectedValueOnce(
        new ApiClientError('Email already exists', 409)
      );

      const { result } = renderHook(() => useAuthViewModel());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.register({ email: 'existing@example.com', password: 'ValidPass1' });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Este e-mail já está cadastrado.');
    });
  });

  describe('logout', () => {
    it('should call authService.logout and clear auth state', async () => {
      // First, authenticate
      const user = { id: '1', email: 'test@example.com' };
      const tokens = { accessToken: 'token', refreshToken: 'refresh' };
      useAuthStore.getState().setAuth(user, tokens);

      vi.mocked(authService.logout).mockResolvedValueOnce(undefined);

      // Mock window.location
      const locationHref = vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: '/',
      } as Location);

      const { result } = renderHook(() => useAuthViewModel());

      await act(async () => {
        await result.current.logout();
      });

      expect(authService.logout).toHaveBeenCalled();
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeNull();

      locationHref.mockRestore();
    });
  });

  describe('clearError', () => {
    it('should clear error and validation errors', async () => {
      vi.mocked(authService.login).mockRejectedValueOnce(
        new ApiClientError('fail', 401)
      );

      const { result } = renderHook(() => useAuthViewModel());

      await act(async () => {
        await result.current.login({ email: 'test@example.com', password: 'Test1234' });
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.validationErrors).toEqual({});
    });
  });
});
