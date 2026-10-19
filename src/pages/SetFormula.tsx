import { useEffect, useState } from 'react';
import { testGroupsDb, type TestParameter } from '../lib/db';
import { Save, Search } from 'lucide-react';

type FormulaGroup = {
  id: string;
  display_name: string;
  report_title: string;
  test_parameters?: TestParameter[];
};

export default function SetFormula() {
  const [groups, setGroups] = useState<FormulaGroup[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const loaded = (await testGroupsDb.listAll()) as unknown as FormulaGroup[];
    setGroups(loaded);
    if (!selectedId && loaded.length > 0) setSelectedId(loaded[0].id);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = groups.filter((group) => group.display_name.toLowerCase().includes(search.toLowerCase()));
  const activeGroup = groups.find((group) => group.id === selectedId) || null;
  const params = [...(activeGroup?.test_parameters || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  function updateParam(paramId: string, patch: Partial<TestParameter>) {
    if (!activeGroup) return;
    const next = groups.map((group) => {
      if (group.id !== activeGroup.id) return group;
      const updatedParams = (group.test_parameters || []).map((parameter) =>
        parameter.id === paramId ? { ...parameter, ...patch } : parameter
      );
      return { ...group, test_parameters: updatedParams };
    });
    setGroups(next);
  }

  async function applyFormulas() {
    if (!activeGroup) return;
    setSaving(true);
    try {
      await testGroupsDb.replaceParameters(
        activeGroup.id,
        params.map((parameter, sort_order) => ({
          ...parameter,
          sort_order,
        }))
      );
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-4 h-full">
      <aside className="w-80 shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col">
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search test group..."
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setSelectedId(group.id)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-slate-50 ${
                selectedId === group.id ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {group.display_name}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex-1 bg-white rounded-xl border border-slate-200 p-5 overflow-y-auto">
        {!activeGroup ? (
          <p className="text-sm text-slate-500">Select a test group to configure formulas.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-lg font-bold text-slate-900">Set Formula</h1>
                <p className="text-xs text-slate-500 mt-1">
                  {activeGroup.display_name} · Use ID1, ID2, ID3 based on the row index.
                </p>
              </div>
              <button
                type="button"
                onClick={applyFormulas}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? 'Applying...' : 'Apply'}
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase">
                  <tr>
                    <th className="px-2 py-2 text-left">Test ID</th>
                    <th className="px-2 py-2 text-left">Test / Parameter</th>
                    <th className="px-2 py-2 text-left">Formula</th>
                    <th className="px-2 py-2 text-left">Decimal</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map((parameter, index) => (
                    <tr key={parameter.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-mono text-slate-600">ID{index + 1}</td>
                      <td className="px-2 py-1.5 text-slate-700">{parameter.name || '-'}</td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-full border border-slate-200 rounded px-2 py-1 font-mono"
                          value={parameter.formula || ''}
                          placeholder="e.g. (ID2/ID1)*10"
                          onChange={(e) => parameter.id && updateParam(parameter.id, { formula: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="w-full border border-slate-200 rounded px-2 py-1 font-mono"
                          value={parameter.decimal_format || ''}
                          placeholder="0.00"
                          onChange={(e) => parameter.id && updateParam(parameter.id, { decimal_format: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                  {params.length === 0 && (
                    <tr>
                      <td className="px-3 py-5 text-slate-400 text-sm" colSpan={4}>
                        No parameters configured for this test group.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
