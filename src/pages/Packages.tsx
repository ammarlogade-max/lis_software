import { useEffect, useState } from 'react';
import { packagesDb, testGroupsDb, type PackageItem as Package } from '../lib/db';
import { Package as PackageIcon, Plus, List, Save, X, Trash2 } from 'lucide-react';

interface TestGroup {
  id: string;
  display_name: string;
  rate: number;
}

// Mirrors Patho One's "Package Master": pick a package name, move tests from
// the left list into the right list with >> / <<, then set a combined fee.
export default function Packages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [testGroups, setTestGroups] = useState<TestGroup[]>([]);
  const [showList, setShowList] = useState(true);
  const [name, setName] = useState('');
  const [fee, setFee] = useState(0);
  const [available, setAvailable] = useState<TestGroup[]>([]);
  const [selected, setSelected] = useState<TestGroup[]>([]);
  const [leftPick, setLeftPick] = useState<string | null>(null);
  const [rightPick, setRightPick] = useState<string | null>(null);

  async function load() {
    const [pkgs, groups] = await Promise.all([packagesDb.list(), testGroupsDb.listActive()]);
    setPackages(pkgs);
    setTestGroups(groups.map((g) => ({ id: g.id, display_name: g.display_name, rate: g.rate })));
  }
  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setName('');
    setFee(0);
    setAvailable(testGroups);
    setSelected([]);
    setShowList(false);
  }

  function moveRight() {
    if (!leftPick) return;
    const item = available.find((g) => g.id === leftPick);
    if (!item) return;
    setSelected([...selected, item]);
    setAvailable(available.filter((g) => g.id !== leftPick));
    setLeftPick(null);
  }
  function moveLeft() {
    if (!rightPick) return;
    const item = selected.find((g) => g.id === rightPick);
    if (!item) return;
    setAvailable([...available, item]);
    setSelected(selected.filter((g) => g.id !== rightPick));
    setRightPick(null);
  }

  async function handleSave() {
    if (!name.trim() || selected.length === 0) return;
    await packagesDb.create({
      name,
      fee: Number(fee),
      is_active: true,
      test_group_ids: selected.map((s) => s.id),
    });
    await load();
    setShowList(true);
  }

  // Deactivate rather than hard-delete — a package can be referenced by
  // historical orders indirectly through the test groups it expanded to.
  async function handleDelete(id: string) {
    await packagesDb.update(id, { is_active: false });
    await load();
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <PackageIcon className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-900">Package Master</h1>
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
            <Plus className="w-3.5 h-3.5" /> New Package
          </button>
        </div>
      </div>

      {showList ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Package Name</th>
                <th className="px-4 py-2">Tests Included</th>
                <th className="px-4 py-2">Fee</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {(p.test_group_ids || [])
                      .map((id) => testGroups.find((g) => g.id === id)?.display_name)
                      .filter(Boolean)
                      .join(', ')}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.fee}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleDelete(p.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No packages added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="grid grid-cols-[160px_1fr_140px] gap-3 items-center mb-4">
            <label className="text-sm font-medium text-slate-700">
              Package Name <span className="text-red-500">*</span>
            </label>
            <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Fee</span>
              <input
                type="number"
                className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_60px_1fr] gap-3 items-center">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Available Tests</div>
              <select
                size={12}
                className="w-full border border-slate-300 rounded-lg text-sm"
                value={leftPick || ''}
                onChange={(e) => setLeftPick(e.target.value)}
              >
                {available.map((g) => (
                  <option key={g.id} value={g.id} className="px-2 py-1">
                    {g.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 items-center">
              <button onClick={moveRight} className="w-10 h-8 rounded bg-blue-600 text-white text-sm font-bold">
                {'>>'}
              </button>
              <button onClick={moveLeft} className="w-10 h-8 rounded bg-slate-200 text-slate-700 text-sm font-bold">
                {'<<'}
              </button>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Included in Package</div>
              <select
                size={12}
                className="w-full border border-slate-300 rounded-lg text-sm"
                value={rightPick || ''}
                onChange={(e) => setRightPick(e.target.value)}
              >
                {selected.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => setShowList(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
