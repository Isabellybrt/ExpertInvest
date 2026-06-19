/**
 * Authentication service for API calls.
 * Handles login, registration, logout, and token refresh.
 */

import { apiClient, ApiClientError } from './api';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

const authService = {
  async login(data: LoginRequest): Promise<AuthResult> {
    const response = await apiClient.post<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/login', data);
    return {
      user: response.data.user,
      tokens: {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      },
    };
  },

  async register(data: RegisterRequest): Promise<AuthResult> {
    const response = await apiClient.post<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/register', data);
    return {
      user: response.data.user,
      tokens: {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      },
    };
  },

  async loginWithGoogle(): Promise<AuthResult> {
    return new Promise((resolve, reject) => {
      const clientId = (window as any).__GOOGLE_CLIENT_ID__;
      if (!clientId) {
        reject(new Error('Google OAuth não está configurado. Defina VITE_GOOGLE_CLIENT_ID.'));
        return;
      }

      // Load Google Identity Services if not already loaded
      if (!(window as any).google?.accounts?.id) {
        reject(new Error('Google Identity Services não carregado. Recarregue a página.'));
        return;
      }

      (window as any).google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          try {
            const apiResponse = await apiClient.post<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/google', { token: response.credential });
            resolve({
              user: apiResponse.data.user,
              tokens: {
                accessToken: apiResponse.data.accessToken,
                refreshToken: apiResponse.data.refreshToken,
              },
            });
          } catch (error) {
            reject(error);
          }
        },
      });

      (window as any).google.accounts.id.prompt();
    });
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Even if logout API fails, we still clear local state
      if (error instanceof ApiClientError && error.status !== 401) {
        console.error('Logout API error:', error.message);
      }
    }
  },

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const response = await apiClient.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken });
    return {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
    };
  },
};

export default authService;
