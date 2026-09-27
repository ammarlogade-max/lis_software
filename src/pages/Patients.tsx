import { useEffect, useState } from 'react';
import { patientsDb, type Patient } from '../lib/db';
import { Users, Search, Pencil, Trash2, X, Save } from 'lucide-react';

// Patients Master — search/browse/edit/delete. Patient *creation* happens on
// the New Visit / Billing screen (matching Patho One's flow, where Patient
// Master is really the New Visit form); this is the searchable master list.
export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);

  async function load(q?: string) {
    setPatients(await patientsDb.list(q));
  }
  useEffect(() => {
    load();
  }, []);

  // Server-side search (via patientsDb.list) rather than filtering the
  // already-loaded page, so search actually reaches beyond the first 200
  // patients the list query caps at.
  useEffect(() => {
    const timeout = setTimeout(() => load(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await patientsDb.update(editing.id, {
        full_name: editing.full_name,
        phone: editing.phone,
        address: editing.address,
        city: editing.city,
      });
      setEditing(null);
      await load(search);
    } finally {
      setSaving(false);
    }
  }

  // Soft-delete only — matches Patho One's "Recover Deleted Patient Entry"
  // tool, which only makes sense if delete never actually destroys the row.
  async function handleDelete(id: string) {
    await patientsDb.softDelete(id);
    await load(search);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-900">Patients Master</h1>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Lab ID, name, or mobile..."
            className="pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg w-72"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2">MRN</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Gender / Age</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">City</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{p.mrn}</td>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {p.title} {p.full_name}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {p.gender} / {p.age_years ?? '-'}y
                </td>
                <td className="px-4 py-2 text-slate-600">{p.phone || '-'}</td>
                <td className="px-4 py-2 text-slate-600">{p.city || '-'}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setEditing(p)} className="text-blue-600 mr-3">
                    <Pencil className="w-4 h-4 inline" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600">
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No matching patients.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200 p-6 w-full max-w-lg grid grid-cols-[120px_1fr] gap-3 items-center">
            <h2 className="col-span-2 text-base font-bold text-slate-900 mb-2">Edit Patient — {editing.mrn}</h2>
            <label className="text-sm text-slate-700">Name</label>
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={editing.full_name}
              onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
            />
            <label className="text-sm text-slate-700">Phone</label>
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={editing.phone || ''}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
            />
            <label className="text-sm text-slate-700">Address</label>
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={editing.address || ''}
              onChange={(e) => setEditing({ ...editing, address: e.target.value })}
            />
            <label className="text-sm text-slate-700">City</label>
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={editing.city || ''}
              onChange={(e) => setEditing({ ...editing, city: e.target.value })}
            />
            <div className="col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
              <button
                onClick={() => setEditing(null)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
