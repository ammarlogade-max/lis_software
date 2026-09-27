import { useEffect, useState } from 'react';
import { branchesDb, type Branch } from '../lib/db';
import { GitBranch, Plus, Save, X, Trash2 } from 'lucide-react';

// Not part of Patho One (which is single-branch) — kept as one of the
// "additional features beyond Patho One" the project scope calls for.
export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  async function load() {
    setBranches(await branchesDb.list());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!name.trim()) return;
    await branchesDb.create({ name, address, phone, is_main: branches.length === 0, is_active: true });
    setName('');
    setAddress('');
    setPhone('');
    setShowForm(false);
    await load();
  }

  // Deactivate rather than hard-delete — a branch can be referenced by
  // historical orders.
  async function handleDelete(id: string) {
    await branchesDb.update(id, { is_active: false });
    await load();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-900">Branches</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white">
          <Plus className="w-3.5 h-3.5" /> New Branch
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 grid grid-cols-[120px_1fr] gap-3 items-center max-w-lg">
          <label className="text-sm text-slate-700">Name</label>
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="text-sm text-slate-700">Address</label>
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={address} onChange={(e) => setAddress(e.target.value)} />
          <label className="text-sm text-slate-700">Phone</label>
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Address</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">{b.name}</td>
                <td className="px-4 py-2 text-slate-600">{b.address}</td>
                <td className="px-4 py-2 text-slate-600">{b.phone}</td>
                <td className="px-4 py-2 text-slate-600">{b.is_main ? 'Main Branch' : 'Sub Branch'}</td>
                <td className="px-4 py-2 text-right">
                  {!b.is_main && (
                    <button onClick={() => handleDelete(b.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
