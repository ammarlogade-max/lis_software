import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

type AppRole = 'admin' | 'front_desk' | 'lab_technician' | 'pathologist' | 'accountant';

type AuthUser = {
  id: string;
  fullName: string;
  role: AppRole;
  branchId: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(session: Session): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, branch_id, is_active')
    .eq('id', session.user.id)
    .single();

  if (error || !data) return null;
  if (!data.is_active) return null; // deactivated staff account — treat as logged out

  return {
    id: data.id,
    fullName: data.full_name || session.user.email || 'Unknown',
    role: data.role as AppRole,
    branchId: data.branch_id,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session) {
        const profile = await loadProfile(data.session);
        if (!cancelled) setUser(profile);
      }
      if (!cancelled) setLoading(false);
    });

    // Keep `user` in sync with token refreshes / sign-outs from other tabs,
    // and re-load the profile whenever a new session appears.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setUser(null);
        return;
      }
      const profile = await loadProfile(session);
      setUser(profile);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Sign-in did not return a session.');

    const profile = await loadProfile(data.session);
    if (!profile) {
      await supabase.auth.signOut();
      throw new Error('No active staff profile found for this account. Contact an administrator.');
    }
    setUser(profile);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
