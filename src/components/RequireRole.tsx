import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rolesFor } from '../config/navigation';

// Blocks direct URL navigation to a screen the logged-in role isn't allowed
// to see, even if the Sidebar already hides the link. Falls back to letting
// the request through if the path isn't registered in NAV_ITEMS (e.g. the
// dashboard root), since rolesFor returns null for unknown paths.
export default function RequireRole() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  const allowed = rolesFor(location.pathname);
  if (allowed && !allowed.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
