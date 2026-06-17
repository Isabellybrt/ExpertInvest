/**
 * App — Root component with React Router configuration.
 * Sets up public and protected routes.
 *
 * Routes:
 * - /login → LoginView (public)
 * - /register → RegisterView (public)
 * - / → DashboardView (protected)
 * - /renda-fixa → RendaFixaForm (protected)
 * - /fiis → FIIForm (protected)
 * - /aportes → AporteForm (protected)
 * - /export → ExportView (protected)
 * - /carteira-fiis → FIIPortfolioTable (protected)
 *
 * Validates: Requirements 14.3, 14.5, 14.6
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NavigationLayout } from './components/Navigation';
import { LoginView } from './views/auth/LoginView';
import { RegisterView } from './views/auth/RegisterView';
import { DashboardView } from './views/dashboard/DashboardView';
import { RendaFixaForm } from './views/assets/RendaFixaForm';
import { FIIForm } from './views/assets/FIIForm';
import { AporteForm } from './views/assets/AporteForm';
import { ExportView } from './views/export/ExportView';
import { FIIPortfolioTable } from './views/portfolio/FIIPortfolioTable';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginView />} />
        <Route path="/register" element={<RegisterView />} />

        {/* Protected routes with navigation layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<NavigationLayout />}>
            <Route path="/" element={<DashboardView />} />
            <Route path="/renda-fixa" element={<RendaFixaForm />} />
            <Route path="/fiis" element={<FIIForm />} />
            <Route path="/aportes" element={<AporteForm />} />
            <Route path="/export" element={<ExportView />} />
            <Route path="/carteira-fiis" element={<FIIPortfolioTable />} />
          </Route>
        </Route>

        {/* Catch-all redirects to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
