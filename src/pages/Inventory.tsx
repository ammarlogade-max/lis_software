import { useEffect, useState } from 'react';
import { inventoryDb } from '../lib/db';
import { Boxes, Plus, Save, X, AlertTriangle } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  reorder_level: number;
  current_quantity: number;
  unit_cost: number;
  is_low_stock: boolean;
}

// Not part of Patho One (no consumables/inventory screen was shown) — kept
// as one of the "additional features beyond Patho One" the project scope calls for.
export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [qty, setQty] = useState(0);
  const [reorder, setReorder] = useState(0);

  async function load() {
    setItems(await inventoryDb.list());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!name.trim()) return;
    await inventoryDb.create({ name, unit, opening_quantity: qty, reorder_level: reorder });
    setName('');
    setQty(0);
    setReorder(0);
    setShowForm(false);
    await load();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold text-slate-900">Inventory & Consumables</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white">
          <Plus className="w-3.5 h-3.5" /> New Item
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 grid grid-cols-[140px_1fr] gap-3 items-center max-w-lg">
          <label className="text-sm text-slate-700">Item Name</label>
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="text-sm text-slate-700">Unit</label>
          <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <label className="text-sm text-slate-700">Opening Quantity</label>
          <input type="number" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <label className="text-sm text-slate-700">Reorder Level</label>
          <input type="number" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={reorder} onChange={(e) => setReorder(Number(e.target.value))} />
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
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Reorder Level</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">{i.name}</td>
                <td className="px-4 py-2 text-slate-600">{i.unit}</td>
                <td className="px-4 py-2 text-slate-600">{i.current_quantity}</td>
                <td className="px-4 py-2 text-slate-600">{i.reorder_level}</td>
                <td className="px-4 py-2">
                  {i.is_low_stock ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                      <AlertTriangle className="w-3 h-3" /> Low Stock
                    </span>
                  ) : (
                    <span className="text-emerald-700 text-xs font-semibold">OK</span>
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
