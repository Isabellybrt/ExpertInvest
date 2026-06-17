/**
 * Navigation — Responsive navigation component.
 * Desktop: sidebar on the left.
 * Mobile (<768px): bottom navigation bar.
 *
 * Includes links to Dashboard, Renda Fixa, FIIs, Aportes, Exportar, and Logout button.
 * Logout clears session and redirects to /login within 2 seconds (Req 14.6).
 *
 * Validates: Requirements 12.1, 12.2, 12.3, 14.6
 */

import { NavLink, Outlet } from 'react-router-dom';
import { useAuthViewModel } from '../viewmodels/useAuthViewModel';
import { ToastContainer, ToastMessage } from './Toast';

interface NavigationLayoutProps {
  toasts?: ToastMessage[];
  onDismissToast?: (id: string) => void;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon },
  { to: '/renda-fixa', label: 'Renda Fixa', icon: RendaFixaIcon },
  { to: '/fiis', label: 'FIIs', icon: FIIsIcon },
  { to: '/aportes', label: 'Aportes', icon: AportesIcon },
  { to: '/export', label: 'Exportar', icon: ExportIcon },
];

export function NavigationLayout({ toasts = [], onDismissToast }: NavigationLayoutProps) {
  const { logout, isLoading } = useAuthViewModel();

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50 text-base">
      {/* Toast notifications */}
      {onDismissToast && (
        <ToastContainer toasts={toasts} onDismiss={onDismissToast} />
      )}

      {/* Desktop sidebar - hidden on mobile */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-gray-200 bg-white md:flex"
        aria-label="Navegação principal"
      >
        <div className="flex h-14 items-center border-b border-gray-200 px-4">
          <span className="text-lg font-bold text-gray-900">ExpertInvest</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={logout}
            disabled={isLoading}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 min-h-[44px] disabled:opacity-50"
            aria-label="Sair da conta"
          >
            <LogoutIcon className="h-5 w-5 flex-shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content area — shifted right on desktop */}
      <main className="w-full pb-20 md:pb-0 md:pl-56">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-6 lg:px-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-gray-200 bg-white md:hidden"
        aria-label="Navegação principal"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-[44px] min-h-[44px] text-xs font-medium transition-colors ${
                isActive
                  ? 'text-blue-700'
                  : 'text-gray-500 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={logout}
          disabled={isLoading}
          className="flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-[44px] min-h-[44px] text-xs font-medium text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
          aria-label="Sair da conta"
        >
          <LogoutIcon className="h-5 w-5" />
          <span>Sair</span>
        </button>
      </nav>
    </div>
  );
}

/* --- Icons (SVG inline for zero-dependency) --- */

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function RendaFixaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

function FIIsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
    </svg>
  );
}

function AportesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ExportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}

export default NavigationLayout;
