import { useEffect, useState } from 'react';
import { reportsDb } from '../lib/db';
import { FileBarChart } from 'lucide-react';

type Tab =
  | 'fees-received'
  | 'day-book'
  | 'due-list'
  | 'doctorwise'
  | 'agentwise'
  | 'userwise'
  | 'testwise'
  | 'rate-list'
  | 'patients-list';

const TABS: { id: Tab; label: string }[] = [
  { id: 'fees-received', label: 'Due Fees Received' },
  { id: 'day-book', label: 'Day Book' },
  { id: 'due-list', label: 'Due List' },
  { id: 'doctorwise', label: 'Doctorwise' },
  { id: 'agentwise', label: 'Agent/Collection Centrewise' },
  { id: 'userwise', label: 'Userwise' },
  { id: 'testwise', label: 'Testswise' },
  { id: 'rate-list', label: 'Rate List' },
  { id: 'patients-list', label: "Patient's List with Mobile No." },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Mirrors Patho One's Reports menu exactly (Day Book / Doctorwise / Due List /
// Testswise / Agent-Collection Centrewise / Userwise Test Reports / Rate List /
// Patient's List with Mobile No.), plus "Due Fees Received" from the
// Transactions menu — nine separate filterable screens instead of one
// combined Finance/DCR view.
export default function Reports() {
  const [tab, setTab] = useState<Tab>('fees-received');
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      if (tab === 'rate-list') {
        setData(await reportsDb.load(tab));
      } else {
        setData(await reportsDb.load(tab, fromDate, toDate, search.trim()));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <FileBarChart className="w-5 h-5 text-blue-600" />
        <h1 className="text-lg font-bold text-slate-900">Reports</h1>
      </div>

      <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px ${
              tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'rate-list' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-end gap-3 flex-wrap mb-4">
          {tab === 'fees-received' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Lab ID / Patient / Mobile</label>
              <input
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-500 mb-1">From Date</label>
            <input type="date" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To Date</label>
            <input type="date" className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button onClick={load} className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white">
            Submit
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-slate-400 text-sm">Loading...</div>
      ) : (
        <ReportTable tab={tab} data={data} />
      )}
    </div>
  );
}

function ReportTable({ tab, data }: { tab: Tab; data: any }) {
  if (!data) return null;

  if (tab === 'fees-received') {
    return (
      <Table
        cols={['Lab ID', 'Patient', 'Phone', 'Paid', 'Mode']}
        rows={data.rows.map((r: any) => [r.lab_id, r.patient_name, r.phone ?? '-', r.paid, r.payment_mode])}
        footer={['Total Received', '', '', data.total_received, '']}
      />
    );
  }
  if (tab === 'day-book') {
    return (
      <Table
        cols={['Lab ID', 'Patient', 'Tests', 'Payable', 'Paid', 'Due', 'Mode']}
        rows={data.rows.map((r: any) => [r.lab_id, r.patient_name, r.tests, r.payable, r.paid, r.due, r.payment_mode])}
        footer={['Total', '', '', data.totals.payable, data.totals.paid, data.totals.due, '']}
      />
    );
  }
  if (tab === 'due-list') {
    return (
      <Table
        cols={['Lab ID', 'Patient', 'Total Bill', 'Paid', 'Due Amount', 'Registered On']}
        rows={data.rows.map((r: any) => [r.lab_id, r.patient_name, r.total_bill, r.paid, r.due_amount, r.registered_on?.slice(0, 10)])}
        footer={['Total Due', '', '', '', data.total_due, '']}
      />
    );
  }
  if (tab === 'doctorwise') {
    return (
      <Table
        cols={['Doctor', 'Patients', 'Tests', 'Total Billing']}
        rows={data.rows.map((r: any) => [r.doctor_name, r.patient_count, r.test_count, r.total_billing])}
      />
    );
  }
  if (tab === 'agentwise') {
    return (
      <Table
        cols={['Centre', 'Patients', 'Total Billing', 'Commission %', 'Commission Amount']}
        rows={data.rows.map((r: any) => [r.centre_name, r.patient_count, r.total_billing, r.commission_percent, r.commission_amount.toFixed(2)])}
      />
    );
  }
  if (tab === 'userwise') {
    return (
      <Table
        cols={['User', 'Tests', 'Total Billing']}
        rows={data.rows.map((r: any) => [r.user_name, r.test_count, r.total_billing])}
        footer={['Total', '', data.total]}
      />
    );
  }
  if (tab === 'testwise') {
    return <Table cols={['Test Name', 'Count', 'Revenue']} rows={data.rows.map((r: any) => [r.test_name, r.count, r.revenue])} />;
  }
  if (tab === 'rate-list') {
    return (
      <div>
        <div className="text-sm font-semibold text-slate-700 mb-2">{data.lab_name} — Test Rate List</div>
        <Table cols={['Group Display Name', 'Rate']} rows={data.rows.map((r: any) => [r.display_name, r.rate])} />
      </div>
    );
  }
  if (tab === 'patients-list') {
    return (
      <Table
        cols={['Lab ID', 'Patient', 'Gender', 'Age', 'Phone', 'Registered On']}
        rows={data.rows.map((r: any) => [r.lab_id, r.patient_name, r.gender, r.age, r.phone, r.registered_on?.slice(0, 10)])}
      />
    );
  }
  return null;
}

function Table({ cols, rows, footer }: { cols: string[]; rows: any[][]; footer?: any[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-4 py-2">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="px-4 py-6 text-center text-slate-400">
                No records found in this range.
              </td>
            </tr>
          )}
        </tbody>
        {footer && (
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              {footer.map((cell, j) => (
                <td key={j} className="px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
