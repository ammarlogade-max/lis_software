import { useEffect, useState } from 'react';
import { financeDb, paymentDb, reportSettingsDb } from '../lib/db';
import {
  IndianRupee,
  CreditCard,
  QrCode,
  Banknote,
  Building2,
  Stethoscope,
  Receipt,
  FileCheck2,
  Search,
  Plus,
  RefreshCw,
  X,
  AlertCircle,
  TrendingUp,
  Printer,
} from 'lucide-react';

interface FinanceSummary {
  total_billed: number;
  total_discount: number;
  total_collected: number;
  total_due: number;
  cash_in_hand: number;
  upi_collections: number;
  card_collections: number;
  net_banking_collections: number;
}

interface TransactionRecord {
  id: string;
  lab_id: string;
  date: string;
  patient_name: string;
  phone: string;
  payable: number;
  paid: number;
  due: number;
  payment_mode: string;
  status: string;
}

interface OutstandingDue {
  id: string;
  lab_id: string;
  patient_name: string;
  phone: string;
  total_bill: number;
  due_amount: number;
  registered_on: string;
}

interface DoctorSummary {
  doctor_id: string;
  salutation: string;
  name: string;
  degree: string;
  commission_percent: number;
  referral_count: number;
  total_billing: number;
  gross_incentive: number;
  total_paid: number;
  balance_payable: number;
}

interface DoctorVoucher {
  id: string;
  doctor_id: string;
  doctor_name: string;
  amount: number;
  payment_mode: string;
  reference_no: string;
  date: string;
  remarks: string;
}

export default function Finance() {
  const [activeTab, setActiveTab] = useState<'dcr' | 'dues' | 'incentives'>('dcr');
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [outstandingDues, setOutstandingDues] = useState<OutstandingDue[]>([]);
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [vouchers, setVouchers] = useState<DoctorVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Collect due modal
  const [collectingDue, setCollectingDue] = useState<OutstandingDue | null>(null);
  const [dueAmountInput, setDueAmountInput] = useState<number>(0);
  const [duePaymentMode, setDuePaymentMode] = useState<string>('UPI');

  // Doctor Voucher modal
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorSummary | null>(null);
  const [voucherAmount, setVoucherAmount] = useState<number>(0);
  const [voucherMode, setVoucherMode] = useState<string>('Bank NEFT / IMPS');
  const [voucherRef, setVoucherRef] = useState<string>('');
  const [voucherRemarks, setVoucherRemarks] = useState<string>('Referral incentive settlement');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [labName, setLabName] = useState('');

  // Voucher print receipt modal
  const [printVoucher, setPrintVoucher] = useState<DoctorVoucher | null>(null);

  async function loadFinanceData() {
    try {
      setLoading(true);
      const dcrData = await financeDb.transactions();
      setSummary(dcrData.summary);
      setTransactions(dcrData.transactions || []);
      setOutstandingDues(dcrData.outstanding_dues || []);

      const docData = await financeDb.doctorIncentives();
      setDoctors(docData.doctors || []);
      setVouchers(docData.vouchers || []);
    } catch (error) {
      console.error('Unable to load finance data', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinanceData();
    reportSettingsDb
      .get()
      .then((s) => setLabName(s.lab_name || ''))
      .catch(() => {});
  }, []);

  async function handleCollectDueSubmit() {
    if (!collectingDue) return;
    try {
      setIsSubmitting(true);
      await paymentDb.collect({
        order_id: collectingDue.id,
        amount: dueAmountInput,
        payment_mode: duePaymentMode,
        remarks: 'Due fees received',
      });
      setCollectingDue(null);
      await loadFinanceData();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateVoucherSubmit() {
    if (!selectedDoctor) return;
    try {
      setIsSubmitting(true);
      const res = await financeDb.createVoucher({
        doctor_id: selectedDoctor.doctor_id,
        amount: voucherAmount,
        payment_mode: voucherMode,
        reference_no: voucherRef || `REF-${Date.now().toString().slice(-6)}`,
        remarks: voucherRemarks,
      });
      setSelectedDoctor(null);
      setPrintVoucher(res);
      await loadFinanceData();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div id="finance-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
            <IndianRupee className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Finance & Accounts Ledger</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily Cash Register (DCR), mode-wise audit breakdown, patient dues settlement, and doctor referral incentives
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadFinanceData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Accounts
          </button>
        </div>
      </div>

      {/* Financial Metrics Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Gross Billed</span>
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">₹{summary.total_billed.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-slate-400 mt-1">Total revenue generated</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700">Total Collected</span>
              <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                <FileCheck2 className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2">
              ₹{summary.total_collected.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-1">Received & deposited</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs bg-rose-50/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-700">Outstanding Patient Dues</span>
              <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                <AlertCircle className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-rose-700 mt-2">₹{summary.total_due.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-rose-600/80 mt-1">{outstandingDues.length} patients with balance</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-700">Cash in Hand</span>
              <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
                <Banknote className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-purple-900 mt-2">
              ₹{summary.cash_in_hand.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-purple-600/80 mt-1">Physical drawer currency</div>
          </div>
        </div>
      )}

      {/* Mode-wise breakdown strip */}
      {summary && (
        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Payment Gateway & Mode Breakdown
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">Cash:</span>
              <span className="font-bold text-white">₹{summary.cash_in_hand.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-sky-400" />
              <span className="text-slate-400">UPI / QR:</span>
              <span className="font-bold text-white">₹{summary.upi_collections.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span className="text-slate-400">POS Card:</span>
              <span className="font-bold text-white">₹{summary.card_collections.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">Net Banking:</span>
              <span className="font-bold text-white">₹{summary.net_banking_collections.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('dcr')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'dcr'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          Daily Collection Register (DCR)
        </button>

        <button
          onClick={() => setActiveTab('dues')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'dues'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Patient Dues Settlement ({outstandingDues.length})
        </button>

        <button
          onClick={() => setActiveTab('incentives')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'incentives'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          Doctor Referral Incentives & Vouchers ({doctors.length})
        </button>
      </div>

      {/* Tab 1: DCR Transactions */}
      {activeTab === 'dcr' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, Lab ID, mode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-72"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">{transactions.length} Total Receipts Logged</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Receipt / Lab ID</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Bill Amount</th>
                  <th className="py-3 px-4">Paid (Received)</th>
                  <th className="py-3 px-4">Balance Due</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions
                  .filter(
                    (t) =>
                      t.patient_name.toLowerCase().includes(search.toLowerCase()) ||
                      t.lab_id.toLowerCase().includes(search.toLowerCase()) ||
                      t.payment_mode.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{t.lab_id}</div>
                        <div className="text-[10px] text-slate-400">{t.date}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{t.patient_name}</div>
                        <div className="text-[11px] text-slate-500">{t.phone}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">₹{t.payable.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">₹{t.paid.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4">
                        {t.due > 0 ? (
                          <span className="font-bold text-rose-600">₹{t.due.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-slate-400">₹0 (Cleared)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {t.payment_mode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Dues Settlement */}
      {activeTab === 'dues' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-950">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Patients with Unsettled Diagnostic Balances
            </div>
            <span className="text-xs text-rose-800 font-semibold">
              Total Due: ₹
              {outstandingDues.reduce((sum, d) => sum + d.due_amount, 0).toLocaleString('en-IN')}
            </span>
          </div>

          {outstandingDues.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs font-medium">
              No outstanding dues pending. All patient accounts are settled.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Patient Details</th>
                    <th className="py-3 px-4">Lab ID</th>
                    <th className="py-3 px-4">Total Billed</th>
                    <th className="py-3 px-4">Outstanding Due</th>
                    <th className="py-3 px-4">Registered Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outstandingDues.map((due) => (
                    <tr key={due.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{due.patient_name}</div>
                        <div className="text-[11px] text-slate-500">{due.phone}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{due.lab_id}</td>
                      <td className="py-3 px-4 font-medium text-slate-600">₹{due.total_bill.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-bold text-rose-600 text-sm">
                        ₹{due.due_amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{due.registered_on}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setCollectingDue(due);
                            setDueAmountInput(due.due_amount);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                          Collect & Clear Due
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Doctor Incentives & Vouchers */}
      {activeTab === 'incentives' && (
        <div className="space-y-6">
          {/* Summary Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-slate-900">Referring Doctors Incentive Summary</h3>
                <p className="text-[11px] text-slate-500">Calculated on referring lab order turnover</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Doctor</th>
                    <th className="py-3 px-4">Incentive %</th>
                    <th className="py-3 px-4">Patients Referred</th>
                    <th className="py-3 px-4">Gross Billing</th>
                    <th className="py-3 px-4">Gross Earned</th>
                    <th className="py-3 px-4">Total Paid Out</th>
                    <th className="py-3 px-4">Payable Balance</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctors.map((doc) => (
                    <tr key={doc.doctor_id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {doc.salutation} {doc.name}
                        </div>
                        <div className="text-[11px] text-slate-500">{doc.degree}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-blue-600">{doc.commission_percent}%</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{doc.referral_count} visits</td>
                      <td className="py-3 px-4 text-slate-700">₹{doc.total_billing.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        ₹{doc.gross_incentive.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-emerald-600 font-medium">₹{doc.total_paid.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-bold text-purple-700 text-sm">
                        ₹{doc.balance_payable.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedDoctor(doc);
                            setVoucherAmount(doc.balance_payable > 0 ? doc.balance_payable : 500);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Issue Voucher
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Past Vouchers List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-900">Issued Payment Vouchers History</h3>
              <span className="text-[11px] text-slate-500">{vouchers.length} Vouchers Created</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Voucher ID & Ref</th>
                    <th className="py-3 px-4">Doctor Name</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Remarks</th>
                    <th className="py-3 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{v.id}</div>
                        <div className="text-[10px] text-slate-400">{v.reference_no}</div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{v.doctor_name}</td>
                      <td className="py-3 px-4 font-black text-emerald-600 text-sm">
                        ₹{v.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{v.payment_mode}</td>
                      <td className="py-3 px-4 text-slate-500">{v.date}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{v.remarks}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setPrintVoucher(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Collect Due */}
      {collectingDue && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                Collect Outstanding Patient Due
              </h3>
              <button onClick={() => setCollectingDue(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
              <div>
                Patient: <strong className="text-slate-900">{collectingDue.patient_name}</strong>
              </div>
              <div>
                Lab Visit ID: <strong className="font-mono text-slate-900">{collectingDue.lab_id}</strong>
              </div>
              <div>
                Current Balance Due:{' '}
                <strong className="text-rose-600 text-sm">₹{collectingDue.due_amount.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Settlement Amount (₹) *</label>
              <input
                type="number"
                value={dueAmountInput}
                onChange={(e) => setDueAmountInput(Number(e.target.value))}
                max={collectingDue.due_amount}
                className="w-full text-base font-bold px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Payment Channel *</label>
              <select
                value={duePaymentMode}
                onChange={(e) => setDuePaymentMode(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-medium"
              >
                <option value="Cash">Cash at Counter</option>
                <option value="UPI">UPI / Dynamic QR Code (GPay, PhonePe, Paytm)</option>
                <option value="Card">Debit / Credit Card (POS Terminal)</option>
                <option value="Net Banking">Direct Bank Transfer / NEFT</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCollectingDue(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || dueAmountInput <= 0}
                onClick={handleCollectDueSubmit}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
              >
                {isSubmitting ? 'Processing...' : 'Collect & Issue Official Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Issue Doctor Voucher */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-purple-600" />
                Issue Doctor Incentive Voucher
              </h3>
              <button onClick={() => setSelectedDoctor(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 text-xs space-y-1 text-purple-950">
              <div>
                Doctor: <strong>{selectedDoctor.salutation} {selectedDoctor.name}</strong> ({selectedDoctor.degree})
              </div>
              <div>Commission Rate: <strong>{selectedDoctor.commission_percent}%</strong></div>
              <div>
                Accrued Balance Payable:{' '}
                <strong className="text-purple-700 font-bold">
                  ₹{selectedDoctor.balance_payable.toLocaleString('en-IN')}
                </strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Voucher Amount (₹) *</label>
              <input
                type="number"
                value={voucherAmount}
                onChange={(e) => setVoucherAmount(Number(e.target.value))}
                className="w-full text-base font-bold px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Payment Mode *</label>
              <select
                value={voucherMode}
                onChange={(e) => setVoucherMode(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="Bank NEFT / IMPS">Bank NEFT / IMPS Transfer</option>
                <option value="Cheque">Account Payee Cheque</option>
                <option value="UPI">UPI Transfer</option>
                <option value="Cash">Cash Voucher</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Cheque / UTR / Reference No.</label>
              <input
                type="text"
                value={voucherRef}
                onChange={(e) => setVoucherRef(e.target.value)}
                placeholder="e.g. UTR-98218739182"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Remarks / Ledger Note</label>
              <input
                type="text"
                value={voucherRemarks}
                onChange={(e) => setVoucherRemarks(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedDoctor(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || voucherAmount <= 0}
                onClick={handleCreateVoucherSubmit}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs transition"
              >
                {isSubmitting ? 'Issuing...' : 'Issue Voucher & Debit Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Voucher Slip Modal */}
      {printVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-600" />
                Payment Voucher Slip
              </h3>
              <button onClick={() => setPrintVoucher(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 border-2 border-dashed border-slate-300 rounded-lg space-y-3 bg-white">
              <div className="text-center pb-2 border-b border-slate-200">
                <h4 className="font-black text-sm uppercase text-slate-900">
                  {labName || 'Lab name not set — configure under Report Settings'}
                </h4>
                <div className="text-[10px] text-slate-500">DOCTOR INCENTIVE DISBURSEMENT VOUCHER</div>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Voucher No:</span>
                <span className="font-mono font-bold text-slate-900">{printVoucher.id}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium text-slate-900">{printVoucher.date}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Paid To:</span>
                <span className="font-bold text-slate-900">{printVoucher.doctor_name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Payment Channel:</span>
                <span className="font-medium text-slate-900">{printVoucher.payment_mode}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Ref / UTR:</span>
                <span className="font-mono text-slate-900">{printVoucher.reference_no}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-slate-200 pt-2">
                <span className="font-bold text-slate-900">Amount Paid:</span>
                <span className="font-black text-base text-emerald-700">
                  ₹{printVoucher.amount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="pt-6 flex justify-between text-[10px] text-slate-500 border-t border-slate-100">
                <div>Authorized Signatory</div>
                <div>Recipient Signature</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPrintVoucher(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Voucher Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
