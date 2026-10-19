import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NAV_ITEMS } from '../../config/navigation';
import {
  LayoutDashboard,
  UserPlus,
  FlaskConical,
  Users,
  Stethoscope,
  Building2,
  ClipboardList,
  Package,
  Boxes,
  FileText,
  Cpu,
  GitBranch,
  ShieldCheck,
  Printer,
  IndianRupee,
  FileBarChart,
  KeyRound,
  Info,
  LogOut,
  LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/new-visit': UserPlus,
  '/visits': FlaskConical,
  '/report-designer': Printer,
  '/finance': IndianRupee,
  '/analyzers': Cpu,
  '/patients': Users,
  '/doctors': Stethoscope,
  '/collection-centres': Building2,
  '/test-master': ClipboardList,
  '/packages': Package,
  '/inventory': Boxes,
  '/reports': FileBarChart,
  '/report-settings': FileText,
  '/branches': GitBranch,
  '/change-password': KeyRound,
  '/methods': ClipboardList,
  '/set-formula': ClipboardList,
  '/about': Info,
  '/exit': LogOut,
};

export default function Sidebar() {
  const { user } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !user || item.roles.includes(user.role));

  return (
    <aside id="app-sidebar" className="w-64 bg-slate-900 text-slate-200 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-md">
            P1
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-tight leading-none">Patho One</h1>
            <span className="text-[11px] font-medium text-slate-400">Pathology LIS Suite</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav id="sidebar-nav" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = ICON_MAP[item.to] || LayoutDashboard;
          return (
            <NavLink
              key={item.to}
              id={`nav-link-${item.to.replace('/', '') || 'dashboard'}`}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User info at bottom */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-blue-900/60 border border-blue-600/40 text-blue-300 flex items-center justify-center text-xs font-bold">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-200 truncate">{user?.fullName || 'User'}</div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="capitalize">{user?.role?.replace('_', ' ') || 'Staff'}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
