import { useEffect, useState } from 'react';
import { methodsDb } from '../lib/db';

export default function Methods() {
  const [methods, setMethods] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setMethods(await methodsDb.list());
  }

  useEffect(() => {
    load().catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load methods.'));
  }, []);

  async function addMethod() {
    const value = name.trim();
    if (!value) return;
    setError('');
    try {
      await methodsDb.create(value);
      setName('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save method.');
    }
  }

  return (
    <section className="max-w-3xl bg-white border border-slate-200 rounded-xl p-5">
      <h1 className="text-lg font-bold text-slate-900">Method Master</h1>
      <div className="mt-4 flex gap-2">
        <input className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Method name" />
        <button onClick={addMethod} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">Add</button>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <ul className="mt-5 divide-y divide-slate-100 border border-slate-200 rounded-lg">
        {methods.map((method) => <li key={method} className="px-3 py-2 text-sm text-slate-700">{method}</li>)}
        {methods.length === 0 && <li className="px-3 py-5 text-sm text-slate-400">No methods configured.</li>}
      </ul>
    </section>
  );
}
