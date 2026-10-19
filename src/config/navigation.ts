// Single source of truth for which roles can see/reach which screens.
// Used by both the Sidebar (to hide links) and RequireRole (to actually
// block direct URL navigation) — see components/navigation/Sidebar.tsx
// and components/RequireRole.tsx.
export const NAV_ITEMS: { label: string; to: string; roles: string[] }[] = [
  { label: 'Dashboard', to: '/', roles: ['admin', 'front_desk', 'lab_technician', 'pathologist', 'accountant'] },
  { label: 'New Visit / Billing', to: '/new-visit', roles: ['admin', 'front_desk'] },
  { label: 'Visits & Results', to: '/visits', roles: ['admin', 'front_desk', 'lab_technician', 'pathologist'] },
  { label: 'Report Print Designer', to: '/report-designer', roles: ['admin', 'lab_technician', 'pathologist', 'front_desk'] },
  { label: 'Finance & Cashier (DCR)', to: '/finance', roles: ['admin', 'front_desk', 'accountant'] },
  { label: 'Analyzers & Live Stream', to: '/analyzers', roles: ['admin', 'lab_technician'] },
  { label: 'Patients Master', to: '/patients', roles: ['admin', 'front_desk', 'accountant'] },
  { label: 'Referring Doctors', to: '/doctors', roles: ['admin', 'front_desk'] },
  { label: 'Collection Centres', to: '/collection-centres', roles: ['admin', 'front_desk', 'accountant'] },
  { label: 'Test Master', to: '/test-master', roles: ['admin', 'lab_technician'] },
  { label: 'Packages', to: '/packages', roles: ['admin', 'front_desk'] },
  { label: 'Inventory', to: '/inventory', roles: ['admin', 'lab_technician'] },
  { label: 'Reports', to: '/reports', roles: ['admin', 'front_desk', 'accountant', 'pathologist'] },
  { label: 'Report Settings', to: '/report-settings', roles: ['admin'] },
  { label: 'Branches', to: '/branches', roles: ['admin'] },
  { label: 'Change Password', to: '/change-password', roles: ['admin', 'front_desk', 'lab_technician', 'pathologist', 'accountant'] },
  { label: 'Method Master', to: '/methods', roles: ['admin', 'lab_technician'] },
  { label: 'Set Formula', to: '/set-formula', roles: ['admin', 'lab_technician'] },
  { label: 'About', to: '/about', roles: ['admin', 'front_desk', 'lab_technician', 'pathologist', 'accountant'] },
  { label: 'Exit', to: '/exit', roles: ['admin', 'front_desk', 'lab_technician', 'pathologist', 'accountant'] },
];

export function rolesFor(path: string): string[] | null {
  return NAV_ITEMS.find((i) => i.to === path)?.roles ?? null;
}
