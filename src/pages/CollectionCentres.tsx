import { useEffect, useState } from 'react';
import { centresDb, type CollectionCentre as Centre } from '../lib/db';
import { Building2, Plus, List, Save, X, Trash2, Pencil } from 'lucide-react';

// Mirrors Patho One's "Collection Centre Master" — used to drive the
// Agentwise / Agent-Collection Centrewise report.
export default function CollectionCentres() {
  const [centres, setCentres] = useState<Centre[]>([]);
  const [showList, setShowList] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [commission, setCommission] = useState(0);
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setCentres(await centresDb.list());
  }
  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setName('');
    setCommission(0);
    setContact('');
    setEditingId(null);
    setShowList(false);
  }
  function startEdit(c: Centre) {
    setName(c.name);
    setCommission(c.commission_percent);
    setContact(c.contact_no || '');
    setEditingId(c.id);
    setShowList(false);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name, commission_percent: Number(commission), contact_no: contact || null, is_active: true };
      if (editingId) await centresDb.update(editingId, payload);
      else await centresDb.create(payload);
      await load();
      setShowList(true);
    } finally {
      setSaving(false);
    }
  }

  // Deactivate rather than hard-delete — a centre can be referenced by
  // historical orders (Agentwise report needs it to still resolve).
  async function handleDelete(id: string) {
    await centresDb.update(id, { is_active: false });
    await load();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-900">Collection Centre Master</h1>
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
          <button onClick={startNew} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white">
            <Plus className="w-3.5 h-3.5" /> New Centre
          </button>
        </div>
      </div>

      {showList ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Centre Name</th>
                <th className="px-4 py-2">Commission %</th>
                <th className="px-4 py-2">Contact No.</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {centres.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-2 text-slate-600">{c.commission_percent}%</td>
                  <td className="px-4 py-2 text-slate-600">{c.contact_no || '-'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => startEdit(c)} className="text-blue-600 mr-3">
                      <Pencil className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {centres.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No collection centres added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6 grid grid-cols-[160px_1fr] gap-y-4 gap-x-3 items-center max-w-lg">
          <label className="text-sm font-medium text-slate-700">
            Centre Name <span className="text-red-500">*</span>
          </label>
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />

          <label className="text-sm font-medium text-slate-700">Commission %</label>
          <input
            type="number"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={commission}
            onChange={(e) => setCommission(Number(e.target.value))}
          />

          <label className="text-sm font-medium text-slate-700">Contact No.</label>
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={contact} onChange={(e) => setContact(e.target.value)} />

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
