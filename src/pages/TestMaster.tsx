import { useEffect, useState } from 'react';
import { methodsDb, testGroupsDb, type TestGroup as DbTestGroup } from '../lib/db';
import { ClipboardList, Plus, Save, Trash2, Search } from 'lucide-react';

interface Parameter {
  id: string;
  name: string;
  unit: string | null;
  default_value: string | null;
  formula: string | null;
  decimal_format: string | null;
  is_bold: boolean;
  normal_range_male: string | null;
  normal_range_female: string | null;
  normal_range_child_male: string | null;
  normal_range_child_female: string | null;
  analyzer_code?: string;
  critical_low?: string;
  critical_high?: string;
  report_comment?: string;
  is_required?: boolean;
}
interface TestGroup {
  id: string;
  display_name: string;
  report_title: string;
  short_name: string;
  rate: number;
  method_interpretation: string;
  department?: string;
  specimen_type?: string;
  sample_volume?: string;
  container_type?: string;
  report_sequence?: number;
  is_active: boolean;
  parameters: Parameter[];
}

const emptyParam = (): Parameter => ({
  id: 'new-' + Date.now() + Math.random(),
  name: '',
  unit: '',
  default_value: '',
  formula: '',
  decimal_format: '',
  is_bold: false,
  normal_range_male: '',
  normal_range_female: '',
  normal_range_child_male: '',
  normal_range_child_female: '',
  analyzer_code: '',
  critical_low: '',
  critical_high: '',
  report_comment: '',
  is_required: true,
});

// Mirrors Patho One's "Test Modification" screen: group list on the left,
// group header fields + a parameter grid on the right (with the 4-way
// Male/Female/Child Male/Child Female normal-value split and a per-parameter
// Formula column, matching the separate "Set Formula" screen but inline
// here for editability), plus a free-text Interpretation/Method field.
export default function TestMaster() {
  const [groups, setGroups] = useState<TestGroup[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TestGroup | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [g, m] = await Promise.all([testGroupsDb.listAll(), methodsDb.list()]);
    const mapped = g.map((group) => ({ ...group, parameters: group.test_parameters || [] })) as unknown as TestGroup[];
    setGroups(mapped);
    setMethods(m);
    if (!selectedId && mapped.length) selectGroup(mapped[0]);
  }
  useEffect(() => {
    load();
  }, []);

  function selectGroup(g: TestGroup) {
    setSelectedId(g.id);
    setDraft(JSON.parse(JSON.stringify(g)));
  }

  function startNewGroup() {
    const fresh: TestGroup = {
      id: 'new-' + Date.now(),
      display_name: 'New Test Group',
      report_title: 'NEW TEST GROUP',
      short_name: 'New Group',
      rate: 0,
      method_interpretation: '',
          department: '',
          specimen_type: '',
          sample_volume: '',
          container_type: '',
          report_sequence: 0,
      is_active: true,
      parameters: [emptyParam()],
    };
    setSelectedId(null);
    setDraft(fresh);
  }

  function updateParam(idx: number, field: keyof Parameter, value: string | boolean) {
    if (!draft) return;
    const params = [...draft.parameters];
    params[idx] = { ...params[idx], [field]: value };
    setDraft({ ...draft, parameters: params });
  }

  function addParamRow() {
    if (!draft) return;
    setDraft({ ...draft, parameters: [...draft.parameters, emptyParam()] });
  }

  function removeParamRow(idx: number) {
    if (!draft) return;
    setDraft({ ...draft, parameters: draft.parameters.filter((_, i) => i !== idx) });
  }

  async function handleApply() {
    if (!draft) return;
    setSaving(true);
    try {
      if (draft.id.startsWith('new-')) {
        const created = await testGroupsDb.createGroup({
          display_name: draft.display_name,
          report_title: draft.report_title,
          short_name: draft.short_name,
          rate: draft.rate,
          method_interpretation: draft.method_interpretation,
          department: draft.department || '',
          specimen_type: draft.specimen_type || '',
          sample_volume: draft.sample_volume || '',
          container_type: draft.container_type || '',
          report_sequence: draft.report_sequence || 0,
          is_active: true,
        });
        await testGroupsDb.replaceParameters(created.id, draft.parameters.map((parameter, sort_order) => ({ ...parameter, sort_order })) as any);
        await load();
        selectGroup({ ...created, parameters: draft.parameters });
      } else {
        await testGroupsDb.updateGroup(draft.id, {
          display_name: draft.display_name,
          report_title: draft.report_title,
          short_name: draft.short_name,
          rate: draft.rate,
          method_interpretation: draft.method_interpretation,
          department: draft.department || '',
          specimen_type: draft.specimen_type || '',
          sample_volume: draft.sample_volume || '',
          container_type: draft.container_type || '',
          report_sequence: draft.report_sequence || 0,
          is_active: draft.is_active,
        });
        await testGroupsDb.replaceParameters(draft.id, draft.parameters.map((parameter, sort_order) => ({ ...parameter, sort_order })) as any);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!draft || draft.id.startsWith('new-')) return;
    await testGroupsDb.updateGroup(draft.id, { is_active: false });
    await load();
  }

  const filtered = groups.filter((g) => g.display_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex gap-4 h-full">
      {/* Left: group list */}
      <div className="w-72 shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col">
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
          {filtered.map((g) => (
            <button
              key={g.id}
              onClick={() => selectGroup(g)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-slate-50 ${
                selectedId === g.id ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-50'
              } ${!g.is_active ? 'opacity-40 italic' : ''}`}
            >
              {g.display_name}
            </button>
          ))}
        </div>
        <button
          onClick={startNewGroup}
          className="m-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-amber-500 text-white"
        >
          <Plus className="w-3.5 h-3.5" /> Add New Group
        </button>
      </div>

      {/* Right: group detail + parameter grid */}
      {draft && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-5 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-bold text-slate-900">Test Modification</h1>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Print on Report Title</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={draft.report_title}
                onChange={(e) => setDraft({ ...draft, report_title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Display Group Name</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={draft.display_name}
                onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Short Name</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={draft.short_name}
                onChange={(e) => setDraft({ ...draft, short_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Rate</label>
              <input
                type="number"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={draft.rate}
                onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Department</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={draft.department || ''} onChange={(e) => setDraft({ ...draft, department: e.target.value })} placeholder="e.g. Biochemistry" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Specimen Type</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={draft.specimen_type || ''} onChange={(e) => setDraft({ ...draft, specimen_type: e.target.value })} placeholder="e.g. Serum" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Container / Tube</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={draft.container_type || ''} onChange={(e) => setDraft({ ...draft, container_type: e.target.value })} placeholder="e.g. Gold top SST" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Sample Volume</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={draft.sample_volume || ''} onChange={(e) => setDraft({ ...draft, sample_volume: e.target.value })} placeholder="e.g. 2 mL" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Report Sequence</label>
              <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={draft.report_sequence || 0} onChange={(e) => setDraft({ ...draft, report_sequence: Number(e.target.value) })} />
            </div>
          </div>

          {/* Parameter grid */}
          <div className="border border-slate-200 rounded-lg overflow-x-auto mb-3">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase">
                <tr>
                  <th className="px-2 py-2 text-left">Bold</th>
                  <th className="px-2 py-2 text-left w-40">Test / Parameter</th>
                  <th className="px-2 py-2 text-left w-24">Default</th>
                  <th className="px-2 py-2 text-left w-20">Unit</th>
                  <th className="px-2 py-2 text-left w-44">Formula</th>
                  <th className="px-2 py-2 text-left w-28">Normal [Male]</th>
                  <th className="px-2 py-2 text-left w-28">Normal [Female]</th>
                  <th className="px-2 py-2 text-left w-28">Normal [Child M]</th>
                  <th className="px-2 py-2 text-left w-28">Normal [Child F]</th>
                  <th className="px-2 py-2 text-left w-28">Analyzer Code</th>
                  <th className="px-2 py-2 text-left w-24">Critical Low</th>
                  <th className="px-2 py-2 text-left w-24">Critical High</th>
                  <th className="px-2 py-2 text-left">Required</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {draft.parameters.map((p, idx) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-2 py-1">
                      <input type="checkbox" checked={p.is_bold} onChange={(e) => updateParam(idx, 'is_bold', e.target.checked)} />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className={`w-full border border-slate-200 rounded px-1.5 py-1 ${p.is_bold ? 'font-bold' : ''}`}
                        value={p.name}
                        onChange={(e) => updateParam(idx, 'name', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input className="w-full border border-slate-200 rounded px-1.5 py-1 font-mono" value={p.analyzer_code || ''} onChange={(e) => updateParam(idx, 'analyzer_code', e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <input className="w-full border border-slate-200 rounded px-1.5 py-1" value={p.critical_low || ''} onChange={(e) => updateParam(idx, 'critical_low', e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <input className="w-full border border-slate-200 rounded px-1.5 py-1" value={p.critical_high || ''} onChange={(e) => updateParam(idx, 'critical_high', e.target.value)} />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="checkbox" checked={p.is_required !== false} onChange={(e) => updateParam(idx, 'is_required', e.target.checked)} />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-full border border-slate-200 rounded px-1.5 py-1"
                        value={p.default_value || ''}
                        onChange={(e) => updateParam(idx, 'default_value', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-full border border-slate-200 rounded px-1.5 py-1"
                        value={p.unit || ''}
                        onChange={(e) => updateParam(idx, 'unit', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-full border border-slate-200 rounded px-1.5 py-1 font-mono"
                        placeholder="e.g. (ID2/ID1)*10"
                        value={p.formula || ''}
                        onChange={(e) => updateParam(idx, 'formula', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-full border border-slate-200 rounded px-1.5 py-1"
                        value={p.normal_range_male || ''}
                        onChange={(e) => updateParam(idx, 'normal_range_male', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-full border border-slate-200 rounded px-1.5 py-1"
                        value={p.normal_range_female || ''}
                        onChange={(e) => updateParam(idx, 'normal_range_female', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-full border border-slate-200 rounded px-1.5 py-1"
                        value={p.normal_range_child_male || ''}
                        onChange={(e) => updateParam(idx, 'normal_range_child_male', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="w-full border border-slate-200 rounded px-1.5 py-1"
                        value={p.normal_range_child_female || ''}
                        onChange={(e) => updateParam(idx, 'normal_range_child_female', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <button onClick={() => removeParamRow(idx)} className="text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addParamRow} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 mb-4">
            <Plus className="w-3.5 h-3.5" /> Add Test / Parameter Row
          </button>

          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-500 uppercase">Interpretation / Method</label>
            <div className="flex gap-2 mt-1">
              <select
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
                value=""
                onChange={(e) => e.target.value && setDraft({ ...draft, method_interpretation: e.target.value })}
              >
                <option value="">Insert saved method...</option>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (draft.method_interpretation && !methods.includes(draft.method_interpretation)) {
                    await methodsDb.create(draft.method_interpretation);
                    setMethods(await methodsDb.list());
                  }
                }}
                className="text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg px-3"
              >
                Save to Method Master
              </button>
            </div>
            <textarea
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-2"
              value={draft.method_interpretation}
              onChange={(e) => setDraft({ ...draft, method_interpretation: e.target.value })}
            />
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">
              Formula uses parameter position as <code className="bg-slate-100 px-1 rounded">ID1</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">ID2</code>... referring to other rows in this group.
            </span>
            <div className="flex gap-2">
              {!draft.id.startsWith('new-') && (
                <button onClick={handleDeactivate} className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-300 text-red-600">
                  Deactivate Group
                </button>
              )}
              <button
                onClick={handleApply}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
