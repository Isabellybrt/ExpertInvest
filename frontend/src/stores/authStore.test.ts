import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.getState().clearAuth();
    localStorage.clear();
  });

  it('should start with unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it('should set auth state on setAuth', () => {
    const user = { id: '1', email: 'test@example.com', name: 'Test User' };
    const tokens = { accessToken: 'access-123', refreshToken: 'refresh-456' };

    useAuthStore.getState().setAuth(user, tokens);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(user);
    expect(state.accessToken).toBe('access-123');
    expect(state.refreshToken).toBe('refresh-456');
  });

  it('should clear auth state on clearAuth', () => {
    const user = { id: '1', email: 'test@example.com' };
    const tokens = { accessToken: 'access-123', refreshToken: 'refresh-456' };

    useAuthStore.getState().setAuth(user, tokens);
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
  });

  it('should update tokens without changing user', () => {
    const user = { id: '1', email: 'test@example.com', name: 'User' };
    const tokens = { accessToken: 'old-access', refreshToken: 'old-refresh' };

    useAuthStore.getState().setAuth(user, tokens);

    const newTokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
    useAuthStore.getState().updateTokens(newTokens);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
    expect(state.isAuthenticated).toBe(true);
  });
});
