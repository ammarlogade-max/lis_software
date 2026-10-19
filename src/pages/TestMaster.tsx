import { useEffect, useState } from 'react';
import { methodsDb, testGroupsDb } from '../lib/db';
import { ClipboardList, Plus, Save, Trash2, Search, ArrowUp, ArrowDown, Pencil } from 'lucide-react';

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
  options?: string | null;
  test_description?: string | null;
  low_value?: string | null;
  high_value?: string | null;
  is_subtitle?: boolean;
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
  id: `new-${Date.now()}-${Math.random()}`,
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
  options: '',
  test_description: '',
  low_value: '',
  high_value: '',
  is_subtitle: false,
});

export default function TestMaster() {
  const [groups, setGroups] = useState<TestGroup[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TestGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [rowEditor, setRowEditor] = useState<Parameter>(emptyParam());

  async function load() {
    const [loadedGroups, loadedMethods] = await Promise.all([testGroupsDb.listAll(), methodsDb.list()]);
    const mapped = loadedGroups.map((group) => ({ ...group, parameters: group.test_parameters || [] })) as unknown as TestGroup[];
    setGroups(mapped);
    setMethods(loadedMethods);
    if (!selectedId && mapped.length) {
      selectGroup(mapped[0]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function selectGroup(group: TestGroup) {
    setSelectedId(group.id);
    setDraft(JSON.parse(JSON.stringify(group)));
    setEditingIndex(null);
  }

  function startNewGroup() {
    const fresh: TestGroup = {
      id: `new-${Date.now()}`,
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
    setEditingIndex(null);
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
    if (editingIndex === idx) setEditingIndex(null);
  }

  function moveParamRow(idx: number, direction: -1 | 1) {
    if (!draft) return;
    const to = idx + direction;
    if (to < 0 || to >= draft.parameters.length) return;
    const next = [...draft.parameters];
    const current = next[idx];
    next[idx] = next[to];
    next[to] = current;
    setDraft({ ...draft, parameters: next });
    if (editingIndex === idx) setEditingIndex(to);
    else if (editingIndex === to) setEditingIndex(idx);
  }

  function openRowEditor(idx: number) {
    if (!draft) return;
    setEditingIndex(idx);
    setRowEditor({ ...draft.parameters[idx] });
  }

  function applyRowEditor() {
    if (!draft || editingIndex === null) return;
    const next = [...draft.parameters];
    next[editingIndex] = rowEditor;
    setDraft({ ...draft, parameters: next });
    setEditingIndex(null);
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
        await testGroupsDb.replaceParameters(
          created.id,
          draft.parameters.map((parameter, sort_order) => ({ ...parameter, sort_order }))
        );
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
        await testGroupsDb.replaceParameters(
          draft.id,
          draft.parameters.map((parameter, sort_order) => ({ ...parameter, sort_order }))
        );
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!draft || draft.id.startsWith('new-')) return;
    await testGroupsDb.updateGroup(draft.id, { is_active: false });
    await load();
  }

  const filtered = groups.filter((group) => group.display_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex gap-4 h-full">
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
          {filtered.map((group) => (
            <button
              key={group.id}
              onClick={() => selectGroup(group)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-slate-50 ${
                selectedId === group.id ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-50'
              } ${!group.is_active ? 'opacity-40 italic' : ''}`}
            >
              {group.display_name}
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

      {draft && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg font-bold text-slate-900">Test Modification</h1>
            </div>
            {!draft.id.startsWith('new-') && (
              <span className="text-xs font-mono text-slate-500">Group ID: {draft.id}</span>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="lg:col-span-2">
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
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={draft.department || ''}
                onChange={(e) => setDraft({ ...draft, department: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Specimen Type</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={draft.specimen_type || ''}
                onChange={(e) => setDraft({ ...draft, specimen_type: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Container / Tube</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={draft.container_type || ''}
                onChange={(e) => setDraft({ ...draft, container_type: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Sample Volume</label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={draft.sample_volume || ''}
                onChange={(e) => setDraft({ ...draft, sample_volume: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Report Sequence</label>
              <input
                type="number"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                value={draft.report_sequence || 0}
                onChange={(e) => setDraft({ ...draft, report_sequence: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-x-auto mb-3">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Test / Parameter</th>
                  <th className="px-2 py-2 text-left">Default</th>
                  <th className="px-2 py-2 text-left">Unit</th>
                  <th className="px-2 py-2 text-left">Formula</th>
                  <th className="px-2 py-2 text-left">Male / Female / Child</th>
                  <th className="px-2 py-2 text-left">Options / Limits</th>
                  <th className="px-2 py-2 text-left">Required</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draft.parameters.map((parameter, idx) => (
                  <tr key={parameter.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="px-2 py-1.5">
                      <div className={parameter.is_bold ? 'font-bold' : ''}>{parameter.name || '-'}</div>
                    </td>
                    <td className="px-2 py-1.5">{parameter.default_value || '-'}</td>
                    <td className="px-2 py-1.5">{parameter.unit || '-'}</td>
                    <td className="px-2 py-1.5 font-mono">{parameter.formula || '-'}</td>
                    <td className="px-2 py-1.5 text-[11px] text-slate-600">
                      <div>M: {parameter.normal_range_male || '-'}</div>
                      <div>F: {parameter.normal_range_female || '-'}</div>
                      <div>
                        C: {parameter.normal_range_child_male || '-'} / {parameter.normal_range_child_female || '-'}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-slate-600">
                      <div>Options: {parameter.options || '-'}</div>
                      <div>Low/High: {parameter.low_value || '-'} / {parameter.high_value || '-'}</div>
                      <div>Analyzer: {parameter.analyzer_code || '-'}</div>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={parameter.is_required !== false}
                        onChange={(e) => updateParam(idx, 'is_required', e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveParamRow(idx, -1)}
                          className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                          disabled={idx === 0}
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveParamRow(idx, 1)}
                          className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                          disabled={idx === draft.parameters.length - 1}
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openRowEditor(idx)}
                          className="p-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                          title="Edit row"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeParamRow(idx)}
                          className="p-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addParamRow}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 mb-4"
          >
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
                {methods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <button
                type="button"
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
              Formula uses row-position IDs like <code className="bg-slate-100 px-1 rounded">ID1</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">ID2</code>.
            </span>
            <div className="flex gap-2">
              {!draft.id.startsWith('new-') && (
                <button
                  type="button"
                  onClick={handleDeactivate}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-300 text-red-600"
                >
                  Deactivate Group
                </button>
              )}
              <button
                type="button"
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

      {draft && editingIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Edit Parameter Row #{editingIndex + 1}</h2>
              <button
                type="button"
                onClick={() => setEditingIndex(null)}
                className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Test / Parameter Name</label>
                <input
                  className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1 ${rowEditor.is_bold ? 'font-bold' : ''}`}
                  value={rowEditor.name}
                  onChange={(e) => setRowEditor({ ...rowEditor, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Default Value</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.default_value || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, default_value: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Unit</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.unit || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, unit: e.target.value })}
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Formula</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1 font-mono"
                  placeholder="e.g. (ID2/ID1)*10"
                  value={rowEditor.formula || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, formula: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Decimal Format</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1 font-mono"
                  placeholder="0.00"
                  value={rowEditor.decimal_format || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, decimal_format: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Normal [Male]</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.normal_range_male || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, normal_range_male: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Normal [Female]</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.normal_range_female || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, normal_range_female: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Normal [Child M]</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.normal_range_child_male || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, normal_range_child_male: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Normal [Child F]</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.normal_range_child_female || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, normal_range_child_female: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Analyzer Code</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.analyzer_code || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, analyzer_code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Critical Low</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.critical_low || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, critical_low: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Critical High</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.critical_high || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, critical_high: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Options</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  placeholder="e.g. Positive; Negative"
                  value={rowEditor.options || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, options: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Low Value</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.low_value || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, low_value: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">High Value</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.high_value || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, high_value: e.target.value })}
                />
              </div>
              <div className="lg:col-span-3">
                <label className="text-xs font-semibold text-slate-600">Test Description</label>
                <textarea
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.test_description || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, test_description: e.target.value })}
                />
              </div>
              <div className="lg:col-span-3">
                <label className="text-xs font-semibold text-slate-600">Notes / Comment</label>
                <textarea
                  rows={2}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                  value={rowEditor.report_comment || ''}
                  onChange={(e) => setRowEditor({ ...rowEditor, report_comment: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-4 text-xs lg:col-span-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rowEditor.is_bold}
                    onChange={(e) => setRowEditor({ ...rowEditor, is_bold: e.target.checked })}
                  />
                  Bold / Subtitle Row
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rowEditor.is_subtitle === true}
                    onChange={(e) => setRowEditor({ ...rowEditor, is_subtitle: e.target.checked })}
                  />
                  Subtitle
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rowEditor.is_required !== false}
                    onChange={(e) => setRowEditor({ ...rowEditor, is_required: e.target.checked })}
                  />
                  Required
                </label>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingIndex(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyRowEditor}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white"
              >
                Apply Row Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
