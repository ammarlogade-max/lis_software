import { useEffect, useState } from 'react';
import { doctorsDb, type Doctor } from '../lib/db';
import { Stethoscope, Plus, List, Save, X, Trash2, Pencil } from 'lucide-react';

const empty = {
  salutation: 'Dr.',
  name: '',
  degree: '',
  commission_basis: 'Over All',
  commission_percent: 0,
  contact_no: '',
  email: '',
  address: '',
};

// Mirrors Patho One's "Doctor Master" screen: Doctor's Name (with Dr./Dr(Mrs). prefix),
// Degree, Commission (basis dropdown + %), Contact No., E-mail Address, Address —
// with List / Cancel / Save / Exit actions.
export default function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showList, setShowList] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  async function load() {
    setDoctors(await doctorsDb.list());
  }

  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setForm({ ...empty });
    setEditingId(null);
    setShowList(false);
  }

  function startEdit(d: Doctor) {
    setForm({
      salutation: d.salutation,
      name: d.name,
      degree: d.degree,
      commission_basis: d.commission_basis || 'Over All',
      commission_percent: d.commission_percent,
      contact_no: d.contact_no || '',
      email: d.email || '',
      address: d.address || '',
    });
    setEditingId(d.id);
    setShowList(false);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.degree.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        commission_percent: Number(form.commission_percent),
        contact_no: form.contact_no || null,
        email: form.email || null,
        address: form.address || null,
        is_active: true,
      };
      if (editingId) {
        await doctorsDb.update(editingId, payload);
      } else {
        await doctorsDb.create(payload);
      }
      await load();
      setShowList(true);
    } finally {
      setSaving(false);
    }
  }

  // Doctors can be referenced by historical orders, so this deactivates
  // rather than hard-deleting the row (same reasoning as patients' soft
  // delete) — a real "delete" would either fail on the foreign key or
  // silently orphan old order history.
  async function handleDelete(id: string) {
    await doctorsDb.update(id, { is_active: false });
    await load();
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-900">Doctor Master</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowList(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border ${
              showList ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={startNew}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white"
          >
            <Plus className="w-3.5 h-3.5" /> New Doctor
          </button>
        </div>
      </div>

      {showList ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Doctor's Name</th>
                <th className="px-4 py-2">Degree</th>
                <th className="px-4 py-2">Commission</th>
                <th className="px-4 py-2">Contact No.</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {d.salutation} {d.name}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{d.degree}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {d.commission_percent}% ({d.commission_basis})
                  </td>
                  <td className="px-4 py-2 text-slate-600">{d.contact_no || '-'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => startEdit(d)} className="text-blue-600 mr-3">
                      <Pencil className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {doctors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No doctors added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6 grid grid-cols-[160px_1fr] gap-y-4 gap-x-3 items-center max-w-2xl">
          <label className="text-sm font-medium text-slate-700">
            Doctor's Name <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <select
              value={form.salutation}
              onChange={(e) => setForm({ ...form, salutation: e.target.value })}
              className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
            >
              <option>Dr.</option>
              <option>Dr. (Mrs.)</option>
              <option>Mr.</option>
              <option>Ms.</option>
            </select>
            <input
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <label className="text-sm font-medium text-slate-700">
            Degree <span className="text-red-500">*</span>
          </label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.degree}
            onChange={(e) => setForm({ ...form, degree: e.target.value })}
            placeholder="e.g. MBBS, MD (Pathology)"
          />

          <label className="text-sm font-medium text-slate-700">Commission</label>
          <div className="flex gap-2 items-center">
            <select
              value={form.commission_basis}
              onChange={(e) => setForm({ ...form, commission_basis: e.target.value })}
              className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
            >
              <option>Over All</option>
              <option>Test Wise</option>
            </select>
            <input
              type="number"
              className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.commission_percent}
              onChange={(e) => setForm({ ...form, commission_percent: Number(e.target.value) })}
            />
            <span className="text-sm text-slate-500">%</span>
          </div>

          <label className="text-sm font-medium text-slate-700">Contact No.</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.contact_no}
            onChange={(e) => setForm({ ...form, contact_no: e.target.value })}
          />

          <label className="text-sm font-medium text-slate-700">E-mail Address</label>
          <input
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <label className="text-sm font-medium text-slate-700 self-start pt-2">Address</label>
          <textarea
            rows={3}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />

          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
            <button
              onClick={() => setShowList(true)}
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
      )}
    </div>
  );
}
