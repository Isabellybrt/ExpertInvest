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

  async loginWithGoogle(): Promise<void> {
    // Redirect to backend Google OAuth endpoint
    window.location.href = '/api/auth/google';
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
