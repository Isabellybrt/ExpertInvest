/**
 * Base API client with interceptors for authentication.
 * Handles 401 responses by clearing session and redirecting to login.
 */

const API_BASE_URL = '/api';

interface ApiResponse<T> {
  data: T;
  status: number;
}

interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeaders(): Record<string, string> {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const accessToken = parsed?.state?.accessToken;
        if (accessToken) {
          return { Authorization: `Bearer ${accessToken}` };
        }
      } catch {
        // Invalid JSON in storage, ignore
      }
    }
    return {};
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (response.status === 401) {
      this.handleUnauthorized();
      throw new ApiClientError('Sessão expirada. Faça login novamente.', 401);
    }

    if (!response.ok) {
      let errorData: { message?: string; errors?: Record<string, string[]> } = {};
      try {
        errorData = await response.json();
      } catch {
        // Response body is not JSON
      }
      throw new ApiClientError(
        errorData.message || 'Erro inesperado. Tente novamente.',
        response.status,
        errorData.errors
      );
    }

    // Handle empty responses (e.g., 204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return { data: undefined as unknown as T, status: response.status };
    }

    const data = await response.json() as T;
    return { data, status: response.status };
  }

  private handleUnauthorized(): void {
    // Clear stored auth state
    localStorage.removeItem('auth-storage');
    // Redirect to login
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: {
        ...this.getAuthHeaders(),
      },
    });
    return this.handleResponse<T>(response);
  }
}

export class ApiClientError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errors = errors;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export type { ApiResponse, ApiError };
