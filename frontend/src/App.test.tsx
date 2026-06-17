import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NavigationLayout } from './components/Navigation';
import { LoginView } from './views/auth/LoginView';
import { RegisterView } from './views/auth/RegisterView';
import { DashboardView } from './views/dashboard/DashboardView';
import { RendaFixaForm } from './views/assets/RendaFixaForm';
import { FIIForm } from './views/assets/FIIForm';
import { AporteForm } from './views/assets/AporteForm';
import { ExportView } from './views/export/ExportView';

// Mock the auth store
const mockIsAuthenticated = vi.fn(() => false);

vi.mock('./stores/authStore', () => ({
  useAuthStore: (selector: any) => {
    const state = {
      isAuthenticated: mockIsAuthenticated(),
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
      updateTokens: vi.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

// Mock view components to isolate routing tests
vi.mock('./views/auth/LoginView', () => ({
  LoginView: () => <div data-testid="login-view">Login</div>,
}));

vi.mock('./views/auth/RegisterView', () => ({
  RegisterView: () => <div data-testid="register-view">Register</div>,
}));

vi.mock('./views/dashboard/DashboardView', () => ({
  DashboardView: () => <div data-testid="dashboard-view">Dashboard</div>,
}));

vi.mock('./views/assets/RendaFixaForm', () => ({
  RendaFixaForm: () => <div data-testid="renda-fixa-view">RendaFixa</div>,
}));

vi.mock('./views/assets/FIIForm', () => ({
  FIIForm: () => <div data-testid="fii-view">FII</div>,
}));

vi.mock('./views/assets/AporteForm', () => ({
  AporteForm: () => <div data-testid="aporte-view">Aporte</div>,
}));

vi.mock('./views/export/ExportView', () => ({
  ExportView: () => <div data-testid="export-view">Export</div>,
}));

// Mock the auth viewmodel for Navigation logout button
vi.mock('./viewmodels/useAuthViewModel', () => ({
  useAuthViewModel: () => ({
    isLoading: false,
    error: null,
    validationErrors: {},
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    loginWithGoogle: vi.fn(),
    validateLoginForm: vi.fn(),
    validateRegisterForm: vi.fn(),
    clearError: vi.fn(),
  }),
}));

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route path="/register" element={<RegisterView />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<NavigationLayout />}>
          <Route path="/" element={<DashboardView />} />
          <Route path="/renda-fixa" element={<RendaFixaForm />} />
          <Route path="/fiis" element={<FIIForm />} />
          <Route path="/aportes" element={<AporteForm />} />
          <Route path="/export" element={<ExportView />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

describe('App routing (unauthenticated)', () => {
  it('renders login view on /login route', () => {
    mockIsAuthenticated.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('login-view')).toBeInTheDocument();
  });

  it('renders register view on /register route', () => {
    mockIsAuthenticated.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('register-view')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login from protected routes (Req 14.5)', () => {
    mockIsAuthenticated.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('login-view')).toBeInTheDocument();
  });

  it('redirects unknown routes to / (then to login when unauthenticated)', () => {
    mockIsAuthenticated.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/unknown-page']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('login-view')).toBeInTheDocument();
  });
});

describe('App routing (authenticated)', () => {
  it('renders dashboard view on / when authenticated', () => {
    mockIsAuthenticated.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
  });

  it('renders renda fixa view on /renda-fixa when authenticated', () => {
    mockIsAuthenticated.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={['/renda-fixa']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('renda-fixa-view')).toBeInTheDocument();
  });

  it('renders FII view on /fiis when authenticated', () => {
    mockIsAuthenticated.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={['/fiis']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('fii-view')).toBeInTheDocument();
  });

  it('renders aporte view on /aportes when authenticated', () => {
    mockIsAuthenticated.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={['/aportes']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('aporte-view')).toBeInTheDocument();
  });

  it('renders export view on /export when authenticated', () => {
    mockIsAuthenticated.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={['/export']}>
        <AppRoutes />
      </MemoryRouter>
    );
    expect(screen.getByTestId('export-view')).toBeInTheDocument();
  });
});
