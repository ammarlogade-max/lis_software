import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Exit() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    void logout().then(() => {
      window.close();
      navigate('/login', { replace: true });
    });
  }, [logout, navigate]);

  return <div className="p-8 text-sm text-slate-500">Signing out...</div>;
}
