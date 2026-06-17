/**
 * ProtectedRoute — Route guard that redirects unauthenticated users to login.
 * Checks authentication via useAuthStore (Req 14.5).
 *
 * Validates: Requirements 14.5
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
