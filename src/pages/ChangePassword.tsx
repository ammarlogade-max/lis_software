import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { KeyRound } from 'lucide-react';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user?.email) throw new Error('Could not verify the signed-in account.');

      // Re-authenticate with the current password before allowing a change —
      // Supabase's updateUser() does not check this on its own, so we
      // explicitly verify it first rather than let "Current Password" be a
      // field that's shown but silently ignored.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });
      if (reauthErr) throw new Error('Current password is incorrect.');

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-sm">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound className="w-5 h-5 text-blue-600" />
        <h1 className="text-lg font-bold text-slate-900">Change Password</h1>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 grid gap-3">
        <label className="text-sm text-slate-600">Current Password</label>
        <input type="password" required className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />

        <label className="text-sm text-slate-600">New Password (min. 8 characters)</label>
        <input type="password" required minLength={8} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />

        <label className="text-sm text-slate-600">Retype New Password</label>
        <input type="password" required className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Password changed successfully.</p>}

        <button disabled={saving} className="bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? 'Changing…' : 'Change'}
        </button>
      </form>
    </div>
  );
}
