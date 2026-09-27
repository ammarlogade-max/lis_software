import { useEffect, useState } from 'react';
import { reportSettingsDb } from '../lib/db';

export default function About() {
  const [labName, setLabName] = useState('Patho One');

  useEffect(() => {
    reportSettingsDb.get().then((settings) => setLabName(settings.lab_name || 'Patho One')).catch(() => undefined);
  }, []);

  return (
    <section className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
      <div className="mx-auto w-20 h-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-black">P1</div>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">{labName}</h1>
      <p className="mt-2 text-sm text-slate-500">Pathology Laboratory Management System</p>
      <p className="mt-6 text-xs text-slate-400">Production LIS application</p>
    </section>
  );
}
