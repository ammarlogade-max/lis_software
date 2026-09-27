import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FlaskConical,
  FileCheck2,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  QrCode,
  ClipboardEdit,
  Cpu,
  RefreshCw,
  CheckCircle2,
  Boxes,
  Clock,
} from 'lucide-react';
import { dashboardDb } from '../../lib/db';

interface DashboardStats {
  total_orders: number;
  today_orders: number;
  pending_collection: number;
  sample_collected: number;
  completed: number;
  total_patients: number;
  total_tests_offered: number;
  total_revenue: number;
  total_collected: number;
  total_due: number;
  low_stock_count: number;
  low_stock_items: { id: string; name: string; current_quantity: number; unit: string; reorder_level: number }[];
  analyzers: { id: string; name: string; serial_port: string; baud_rate: number; status: string; last_sync?: string }[];
  recent_orders: {
    id: string;
    lab_id: string;
    specimen_id: string;
    patient_name: string;
    status: string;
    payable: number;
    due: number;
    tests_count: number;
  }[];
}

export default function DashboardCards() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchStats() {
    try {
      const data = await dashboardDb.stats();
      setStats(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    fetchStats();
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return (
          <span id={`status-badge-${status}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Report Ready
          </span>
        );
      case 'sample_collected':
        return (
          <span id={`status-badge-${status}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FlaskConical className="w-3.5 h-3.5" />
            In Testing
          </span>
        );
      default:
        return (
          <span id={`status-badge-${status}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending Sample
          </span>
        );
    }
  }

  return (
    <div id="dashboard-container" className="space-y-6">
      {/* Top Banner with Quick Actions */}
      <div id="dashboard-header-panel" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Pathology Lab Operations Center</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              LIS Active
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time patient visits, specimen tracking, analyzer gateway, and billing metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="dashboard-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            id="quick-new-visit-btn"
            onClick={() => navigate('/new-visit')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            New Visit / Billing
          </button>
          <button
            id="quick-visits-btn"
            onClick={() => navigate('/visits')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <ClipboardEdit className="w-4 h-4" />
            Enter Results
          </button>
        </div>
      </div>

      {/* 4 Core Metric KPI Cards */}
      <div id="kpi-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Visits */}
        <div id="kpi-card-visits" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Today's Visits</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {loading ? '...' : (stats?.total_orders ?? 0)}
            </span>
            <span className="text-xs text-slate-500 ml-1.5">registered</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <span>Patients: {stats?.total_patients ?? 0}</span>
            <span className="text-emerald-600 font-medium">{stats?.completed ?? 0} finished</span>
          </div>
        </div>

        {/* Card 2: Specimens in Pipeline */}
        <div id="kpi-card-specimens" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Specimens Active</span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FlaskConical className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {loading ? '...' : ((stats?.pending_collection ?? 0) + (stats?.sample_collected ?? 0))}
            </span>
            <span className="text-xs text-slate-500 ml-1.5">in lab workflow</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-amber-600 font-medium">{stats?.pending_collection ?? 0} pending scan</span>
            <span className="text-blue-600 font-medium">{stats?.sample_collected ?? 0} testing</span>
          </div>
        </div>

        {/* Card 3: Reports Ready */}
        <div id="kpi-card-reports" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Diagnostic Reports</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {loading ? '...' : (stats?.completed ?? 0)}
            </span>
            <span className="text-xs text-slate-500 ml-1.5">validated & signed</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <span>Catalog: {stats?.total_tests_offered ?? 0} tests</span>
            <span className="text-emerald-600 font-medium">Ready for print</span>
          </div>
        </div>

        {/* Card 4: Daily Revenue */}
        <div id="kpi-card-revenue" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Daily Billing</span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {loading ? '...' : `Rs. ${(stats?.total_revenue ?? 0).toLocaleString()}`}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-emerald-600 font-medium">Paid: Rs. {(stats?.total_collected ?? 0).toLocaleString()}</span>
            <span className="text-rose-600 font-medium">Due: Rs. {(stats?.total_due ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Specimen Lifecycle Pipeline Visualizer */}
      <div id="specimen-pipeline-panel" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
          Specimen Processing Pipeline
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Step 1: Registered */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">1. Registration & Billing</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{stats?.total_orders ?? 0} orders</div>
              <div className="text-xs text-slate-500 mt-0.5">Patient verified</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
              01
            </div>
          </div>

          {/* Step 2: Sample Collected */}
          <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-amber-800">2. Sample Accession</div>
              <div className="text-lg font-bold text-amber-900 mt-0.5">{stats?.pending_collection ?? 0} awaiting</div>
              <div className="text-xs text-amber-700 mt-0.5">Specimen identification</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold text-xs">
              02
            </div>
          </div>

          {/* Step 3: Testing & Analyzer */}
          <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50/50 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-blue-800">3. Testing & Analyzer</div>
              <div className="text-lg font-bold text-blue-900 mt-0.5">{stats?.sample_collected ?? 0} active</div>
              <div className="text-xs text-blue-700 mt-0.5">ASTM / Serial link</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-800 font-bold text-xs">
              03
            </div>
          </div>

          {/* Step 4: Verification & Delivery */}
          <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-emerald-800">4. Report Sign-off & PDF</div>
              <div className="text-lg font-bold text-emerald-900 mt-0.5">{stats?.completed ?? 0} ready</div>
              <div className="text-xs text-emerald-700 mt-0.5">Signed & Printable</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-xs">
              04
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Visits & Connected Hardware */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Visits (2 cols) */}
        <div id="recent-visits-card" className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Recent Patient Visits & Worklist</h3>
              <p className="text-xs text-slate-500 mt-0.5">Direct access to specimen scanning and test result entry</p>
            </div>
            <button
              id="view-all-visits-btn"
              onClick={() => navigate('/visits')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Lab ID / Specimen</th>
                  <th className="px-4 py-2.5">Patient Name</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Billing</th>
                  <th className="px-4 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!stats?.recent_orders || stats.recent_orders.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No visits recorded yet. Click "New Visit / Billing" to register a patient.
                    </td>
                  </tr>
                ) : (
                  stats.recent_orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 text-xs">{order.lab_id}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{order.specimen_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{order.patient_name}</span>
                        <div className="text-[11px] text-slate-400">{order.tests_count} test groups</div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-slate-900 text-xs">Rs. {order.payable.toFixed(2)}</div>
                        {order.due > 0 ? (
                          <div className="text-[11px] text-rose-600 font-medium">Due: Rs. {order.due.toFixed(2)}</div>
                        ) : (
                          <div className="text-[11px] text-emerald-600 font-medium">Fully Paid</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          id={`open-order-btn-${order.id}`}
                          onClick={() => navigate('/visits')}
                          className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Analyzer Connectivity & Inventory Alerts (1 col) */}
        <div className="space-y-6">
          {/* Analyzer Hardware Gateway Widget */}
          <div id="analyzers-status-card" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Analyzer Gateway</h4>
                  <p className="text-[11px] text-slate-400">ASTM Serial Link Listener</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/analyzers')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Configure
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {(!stats?.analyzers || stats.analyzers.length === 0) ? (
                <p className="text-xs text-slate-400 py-3 text-center">No analyzers connected</p>
              ) : (
                stats.analyzers.map((ana) => (
                  <div key={ana.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{ana.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {ana.serial_port} &bull; {ana.baud_rate} bps
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reagent Inventory Alerts */}
          <div id="inventory-alerts-card" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Reagents & Stock</h4>
                  <p className="text-[11px] text-slate-400">Consumables tracking</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/inventory')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Manage
              </button>
            </div>

            <div className="mt-3">
              {stats?.low_stock_items && stats.low_stock_items.length > 0 ? (
                <div className="space-y-2">
                  {stats.low_stock_items.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-rose-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-rose-700 mt-0.5">
                          Only {item.current_quantity} {item.unit} left (Reorder: {item.reorder_level} {item.unit})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium mt-1">All reagents adequately stocked</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
