import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './layouts/AppShell';
import Login from './pages/Login';
import DashboardCards from './components/dashboard/DashboardCards';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import CollectionCentres from './pages/CollectionCentres';
import TestMaster from './pages/TestMaster';
import Packages from './pages/Packages';
import NewVisit from './pages/NewVisit';
import Visits from './pages/Visits';
import Finance from './pages/Finance';
import ReportDesigner from './pages/ReportDesigner';
import ReportSettingsPage from './pages/ReportSettings';
import Analyzers from './pages/Analyzers';
import Inventory from './pages/Inventory';
import Branches from './pages/Branches';
import Reports from './pages/Reports';
import ChangePassword from './pages/ChangePassword';
import Methods from './pages/Methods';
import SetFormula from './pages/SetFormula';
import About from './pages/About';
import Exit from './pages/Exit';
import RequireRole from './components/RequireRole';
import { AuthProvider, useAuth } from './context/AuthContext';

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireRole />}>
          <Route path="/" element={<DashboardCards />} />
          <Route path="/new-visit" element={<NewVisit />} />
          <Route path="/visits" element={<Visits />} />
          <Route path="/report-designer" element={<ReportDesigner />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/analyzers" element={<Analyzers />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="/collection-centres" element={<CollectionCentres />} />
          <Route path="/test-master" element={<TestMaster />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/branches" element={<Branches />} />
          <Route path="/report-settings" element={<ReportSettingsPage />} />
          <Route path="/page-setup" element={<ReportSettingsPage />} />
          <Route path="/email-settings" element={<ReportSettingsPage />} />
          <Route path="/pdf-export" element={<ReportSettingsPage />} />
          <Route path="/backup" element={<ReportSettingsPage />} />
          <Route path="/recover-deleted-patients" element={<ReportSettingsPage />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/methods" element={<Methods />} />
          <Route path="/set-formula" element={<SetFormula />} />
          <Route path="/about" element={<About />} />
          <Route path="/exit" element={<Exit />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
