import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/navigation/Sidebar';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Activity, Menu } from 'lucide-react';
import { useState } from 'react';

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Laboratory Dashboard', subtitle: 'Overview of visits, specimens, testing queue & revenue' },
  '/new-visit': { title: 'Patient Registration & Billing', subtitle: 'Book new diagnostic visits, assign tests and calculate billing' },
  '/visits': { title: 'Visits & Diagnostic Results', subtitle: 'Specimen scan-in, manual/analyzer result entry & report printing' },
  '/patients': { title: 'Patient Master Directory', subtitle: 'Manage registered patients, MRNs, demographics and medical histories' },
  '/doctors': { title: 'Referring Doctors Master', subtitle: 'Manage consultant doctors, specializations and commission structures' },
  '/collection-centres': { title: 'Collection Centres & Agents', subtitle: 'Manage peripheral collection hubs, logistics and referral sharing' },
  '/test-master': { title: 'Test & Parameter Master', subtitle: 'Configure test groups, dynamic parameter rows, units and normal reference ranges' },
  '/packages': { title: 'Diagnostic Packages', subtitle: 'Bundle test groups into discounted health checkup packages' },
  '/report-settings': { title: 'Report Branding & Header/Footer', subtitle: 'Configure laboratory letterhead, ISO/CLIA numbers and pathologist signature' },
  '/analyzers': { title: 'Analyzer Gateway & LIS Serial Link', subtitle: 'Manage ASTM E1381/E1394 serial ports and test code mapping' },
  '/inventory': { title: 'Reagents & Consumables Inventory', subtitle: 'Track vacutainer tubes, chemicals, diluents, stock levels and reorder alerts' },
  '/branches': { title: 'Branch Management', subtitle: 'Configure multi-branch diagnostic network locations' },
  '/methods': { title: 'Method Master', subtitle: 'Configure laboratory test methods and interpretations' },
  '/set-formula': { title: 'Set Test Formula', subtitle: 'Configure parameter formulas and decimal formatting using ID row references' },
  '/about': { title: 'About Patho One', subtitle: 'Pathology Laboratory Management System' },
  '/exit': { title: 'Exit', subtitle: 'Close the laboratory application session' },
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const pageMeta = TITLES[location.pathname] ?? { title: 'Pathology LIS', subtitle: 'Diagnostic Laboratory System' };
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div id="app-shell" className="flex min-h-screen w-full overflow-hidden bg-slate-100 text-slate-800">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <button type="button" className="fixed inset-0 z-30 bg-slate-950/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header id="app-header" className="min-h-16 bg-white border-b border-slate-200 px-3 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
          <div className="min-w-0 flex items-center gap-2">
            <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 md:hidden" aria-label="Open navigation">
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight truncate">{pageMeta.title}</h1>
            <p className="text-xs text-slate-500 truncate hidden sm:block">{pageMeta.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Today's Date */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{today}</span>
            </div>

            {/* System Status Ping */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium">System Online</span>
            </div>

            {/* User Profile & Sign Out */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-800">{user?.fullName || 'User'}</div>
                <div className="text-[11px] text-slate-500 capitalize">{user?.role?.replace('_', ' ') || 'Staff'}</div>
              </div>
              <button
                id="sign-out-btn"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors"
                title="Sign out of Pathology LIS"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main id="main-content-scroll" className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <div className="max-w-7xl mx-auto min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
