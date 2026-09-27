import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersDb, reportSettingsDb } from '../lib/db';
import { storageDb } from '../lib/db';
import { supabase } from '../lib/supabaseClient';
import { generateReportPdf } from '../lib/generateReportPdf';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { computeFormulas } from '../lib/formula';
import {
  Search,
  FlaskConical,
  FileText,
  Printer,
  QrCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Save,
  Check,
  MessageCircle,
  Mail,
} from 'lucide-react';

type Order = {
  id: string;
  lab_id: string | null;
  patient_name: string | null;
  status: string;
  payable: number;
  due: number;
  priority?: string;
};

type Parameter = {
  id: string;
  name: string;
  unit: string | null;
  is_bold_header: boolean;
  formula?: string | null;
  decimal_format?: string | null;
  normal_range_male: string | null;
  normal_range_female: string | null;
  value: string | null;
};

type OrderTestDetail = {
  id: string;
  test_group_name: string;
  status: string;
  parameters: Parameter[];
};

type OrderDetail = {
  id: string;
  lab_id: string | null;
  specimen_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  patient_email: string | null;
  patient_gender: string | null;
  patient_age_years: number | null;
  status: string;
  priority?: string;
  order_tests: OrderTestDetail[];
};

function checkAbnormality(val: string | undefined | null, normalRange: string | null): 'normal' | 'low' | 'high' | 'none' {
  if (!val || !normalRange) return 'none';
  const cleaned = val.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 'none';

  const dashMatch = normalRange.replace(/,/g, '').match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (dashMatch) {
    const min = parseFloat(dashMatch[1]);
    const max = parseFloat(dashMatch[2]);
    if (num < min) return 'low';
    if (num > max) return 'high';
    return 'normal';
  }

  const lessMatch = normalRange.replace(/,/g, '').match(/<\s*([\d.]+)/);
  if (lessMatch) {
    const max = parseFloat(lessMatch[1]);
    if (num > max) return 'high';
    return 'normal';
  }

  const greaterMatch = normalRange.replace(/,/g, '').match(/>\s*([\d.]+)/);
  if (greaterMatch) {
    const min = parseFloat(greaterMatch[1]);
    if (num < min) return 'low';
    return 'normal';
  }

  return 'none';
}

export default function Visits() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [savingTestId, setSavingTestId] = useState<string | null>(null);
  const [savedSuccessTestId, setSavedSuccessTestId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [printingLabel, setPrintingLabel] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function loadOrders() {
    const data = await ordersDb.list();
    setOrders(data as Order[]);
    if (!activeOrderId && data.length > 0) {
      openOrder(data[0].id);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        (o.lab_id && o.lab_id.toLowerCase().includes(q)) ||
        (o.patient_name && o.patient_name.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'completed' && o.status === 'completed') ||
        (statusFilter === 'sample_collected' && o.status === 'sample_collected') ||
        (statusFilter === 'pending' && o.status !== 'completed' && o.status !== 'sample_collected');

      return matchSearch && matchStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  async function openOrder(id: string) {
    setActiveOrderId(id);
    setDetailError(null);
    setShareError(null);
    setShareSuccess(null);
    try {
      const raw = await ordersDb.getDetail(id);
      const d: OrderDetail = {
        id: raw.id,
        lab_id: raw.lab_id,
        specimen_id: raw.specimen_id,
        patient_name: raw.patient?.full_name || 'Unknown',
        patient_phone: raw.patient?.phone || null,
        patient_email: raw.patient?.email || null,
        patient_gender: raw.patient?.gender || null,
        patient_age_years: raw.patient?.age_years ?? null,
        status: raw.status,
        priority: raw.priority,
        order_tests: raw.order_tests as OrderTestDetail[],
      };
      setDetail(d);
      let values: Record<string, string> = {};
      d.order_tests.forEach((ot) =>
        ot.parameters.forEach((p) => {
          if (p.value) values[p.id] = p.value;
        })
      );
      d.order_tests.forEach((ot) => {
        values = computeFormulas(ot.parameters, values);
      });
      setDraftValues(values);
    } catch (error) {
      setDetail(null);
      setDetailError(error instanceof Error ? error.message : 'Could not load this visit.');
    }
  }

  async function collectSample() {
    if (!detail) return;
    setCollecting(true);
    try {
      const { error } = await supabase.from('orders').update({ status: 'sample_collected' }).eq('id', detail.id);
      if (error) throw new Error(error.message);
      await openOrder(detail.id);
      await loadOrders();
    } finally {
      setCollecting(false);
    }
  }

  async function printBarcodeLabel() {
    if (!detail) return;
    setPrintingLabel(true);
    try {
      const doc = new jsPDF({ unit: 'mm', format: [70, 40] });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(detail.lab_id || '', 5, 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(detail.patient_name, 5, 14);
      doc.text(`Specimen: ${detail.specimen_id || '-'}`, 5, 20);
      const barcodeCanvas = document.createElement('canvas');
      const barcodeValue = detail.specimen_id || detail.lab_id || 'UNKNOWN';
      JsBarcode(barcodeCanvas, barcodeValue, {
        format: 'CODE128',
        displayValue: true,
        font: 'monospace',
        fontSize: 10,
        height: 42,
        margin: 0,
        width: 1.5,
        textMargin: 3,
      });
      doc.addImage(barcodeCanvas.toDataURL('image/png'), 'PNG', 5, 22, 60, 14);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } finally {
      setPrintingLabel(false);
    }
  }

  async function saveResults(orderTestId: string) {
    if (!detail) return;
    setSavingTestId(orderTestId);
    try {
      const ot = detail.order_tests.find((t) => t.id === orderTestId);
      if (!ot) return;
      const { data: userData } = await supabase.auth.getUser();
      const values: Record<string, string> = {};
      ot.parameters
        .filter((p) => !p.is_bold_header && draftValues[p.id] !== undefined && draftValues[p.id] !== '')
        .forEach((p) => {
          values[p.id] = draftValues[p.id];
        });

      await ordersDb.saveResults(orderTestId, detail.id, values, userData.user?.id || '');
      setSavedSuccessTestId(orderTestId);
      setTimeout(() => setSavedSuccessTestId(null), 3000);

      if (activeOrderId) await openOrder(activeOrderId);
      await loadOrders();
    } finally {
      setSavingTestId(null);
    }
  }

  async function buildReportPdfBlob(): Promise<Blob> {
    if (!detail) throw new Error('No order loaded.');
    const settings = await reportSettingsDb.get();
    return generateReportPdf(
      {
        lab_id: detail.lab_id || '',
        patient_name: detail.patient_name,
        gender: detail.patient_gender || '',
        age_years: detail.patient_age_years,
        order_tests: detail.order_tests.map((ot) => ({
          test_group_name: ot.test_group_name,
          parameters: ot.parameters
            .filter((p) => !p.is_bold_header || true)
            .map((p) => ({
              name: p.name,
              unit: p.unit,
              value: draftValues[p.id] ?? p.value ?? '',
              is_bold_header: p.is_bold_header,
              normal_range_male: p.normal_range_male,
              normal_range_female: p.normal_range_female,
            })),
        })),
        reported_at: new Date().toLocaleDateString(),
      },
      settings
    );
  }

  async function downloadReport() {
    if (!detail) return;
    setDownloading(true);
    try {
      const blob = await buildReportPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${detail.lab_id || detail.id}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not generate the report.');
    } finally {
      setDownloading(false);
    }
  }

  // WhatsApp: no external account/API needed, works today. Uploads the PDF
  // to Supabase Storage to get a shareable link, then opens WhatsApp with
  // that link pre-filled — the staff member still taps Send once. A true
  // zero-tap auto-send requires registering the lab's own number with
  // Meta's WhatsApp Business Cloud API, which is a real external
  // verification process, not something this code can complete on its own.
  async function shareViaWhatsApp() {
    if (!detail) return;
    if (!detail.patient_phone) {
      setShareError('This patient has no phone number on file — add one to their record to share via WhatsApp.');
      return;
    }
    setSendingWhatsApp(true);
    setShareError(null);
    setShareSuccess(null);
    try {
      const blob = await buildReportPdfBlob();
      const url = await storageDb.uploadReportPdf(detail.id, blob);
      const digits = detail.patient_phone.replace(/[^\d]/g, '');
      const message = `Hello ${detail.patient_name}, your lab report (${detail.lab_id}) is ready. View/download it here: ${url}`;
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank');
      setShareSuccess('WhatsApp opened with the report link — tap Send in WhatsApp to deliver it.');
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not prepare the report for WhatsApp.');
    } finally {
      setSendingWhatsApp(false);
    }
  }

  // Email: genuinely automatic (no manual "click send" step) via a Supabase
  // Edge Function + Resend — see supabase/functions/send-report-email. Only
  // ever called when the patient has an email on file (checked by the
  // caller / hidden in the UI), per spec.
  async function shareViaEmail() {
    if (!detail || !detail.patient_email) return;
    setSendingEmail(true);
    setShareError(null);
    setShareSuccess(null);
    try {
      const settings = await reportSettingsDb.get();
      const blob = await buildReportPdfBlob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const { error } = await supabase.functions.invoke('send-report-email', {
        body: {
          to: detail.patient_email,
          patientName: detail.patient_name,
          labId: detail.lab_id,
          labName: settings.lab_name,
          pdfBase64: base64,
        },
      });
      if (error) throw new Error(error.message);
      setShareSuccess(`Report emailed to ${detail.patient_email}.`);
    } catch (err) {
      setShareError(
        err instanceof Error
          ? `${err.message} — make sure the send-report-email Edge Function is deployed and RESEND_API_KEY is set (see SETUP.md).`
          : 'Could not send the email.'
      );
    } finally {
      setSendingEmail(false);
    }
  }

  function renderStatusBadge(status: string) {
    if (status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    }
    if (status === 'sample_collected') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          <FlaskConical className="w-3 h-3" />
          In Testing
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
        <Clock className="w-3 h-3" />
        Sample Pending
      </span>
    );
  }

  return (
    <div id="visits-page" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left List: Visits Queue (4 cols) */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden max-h-[calc(100vh-140px)]">
        {/* Filters Header */}
        <div className="p-3.5 border-b border-slate-200 space-y-2 bg-slate-50/50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Lab ID or Patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto text-[11px]">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'sample_collected', label: 'In Lab' },
              { id: 'completed', label: 'Reported' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  statusFilter === tab.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-200 bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Order Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredOrders.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No matching diagnostic visits found.
            </div>
          ) : (
            filteredOrders.map((o) => {
              const isSelected = activeOrderId === o.id;
              return (
                <button
                  key={o.id}
                  id={`order-row-${o.id}`}
                  onClick={() => openOrder(o.id)}
                  type="button"
                  className={`w-full text-left p-3.5 cursor-pointer transition select-none flex items-start justify-between ${
                    isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{o.lab_id}</span>
                      {o.priority === 'stat' && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
                          STAT
                        </span>
                      )}
                      {renderStatusBadge(o.status)}
                    </div>
                    <div className="text-xs font-medium text-slate-800 truncate mt-0.5">
                      {o.patient_name}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Billing: Rs. {o.payable.toFixed(2)}
                      {o.due > 0 && (
                        <span className="text-rose-600 font-medium ml-1.5">(Due: Rs. {o.due.toFixed(2)})</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Area: Selected Order Detail, specimen processing & test results entry (8 cols) */}
      <div className="lg:col-span-8 space-y-4">
        {!detail ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 shadow-xs">
            <FlaskConical className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            {detailError ? (
              <>
                <p className="text-sm font-semibold text-rose-700">Could not open this visit</p>
                <p className="mt-2 text-xs text-rose-600">{detailError}</p>
                <button type="button" onClick={() => activeOrderId && openOrder(activeOrderId)} className="mt-4 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white">
                  Retry
                </button>
              </>
            ) : (
              <p className="text-sm font-medium text-slate-600">Select a visit from the worklist to enter test results.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header Card with Patient, Specimen and Action Buttons */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-slate-900">{detail.patient_name}</h2>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {detail.lab_id}
                  </span>
                  {renderStatusBadge(detail.status)}
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  Specimen Barcode: <span className="font-bold text-slate-700">{detail.specimen_id}</span>
                </p>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                {detail.status !== 'sample_collected' && detail.status !== 'completed' && (
                  <button
                    id="collect-specimen-btn"
                    onClick={collectSample}
                    disabled={collecting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    {collecting ? 'Marking...' : 'Mark Sample Collected'}
                  </button>
                )}

                <button
                  id="print-barcode-btn"
                  onClick={printBarcodeLabel}
                  disabled={printingLabel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  {printingLabel ? 'Printing...' : 'Barcode Label'}
                </button>

                <button
                  id="open-report-designer-btn"
                  onClick={() => navigate('/report-designer')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Report Designer
                </button>

                <button
                  id="download-report-btn"
                  onClick={downloadReport}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {downloading ? 'Generating PDF...' : 'Download Report'}
                </button>

                <button
                  id="whatsapp-share-btn"
                  onClick={shareViaWhatsApp}
                  disabled={sendingWhatsApp || !detail.patient_phone}
                  title={!detail.patient_phone ? 'No phone number on file for this patient' : undefined}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-40 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {sendingWhatsApp ? 'Preparing...' : 'Share via WhatsApp'}
                </button>

                {detail.patient_email && (
                  <button
                    id="email-share-btn"
                    onClick={shareViaEmail}
                    disabled={sendingEmail}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {sendingEmail ? 'Sending...' : 'Email Report'}
                  </button>
                )}
              </div>
            </div>

            {(shareError || shareSuccess) && (
              <div
                className={`text-xs font-medium px-3 py-2 rounded-lg border ${
                  shareError ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                }`}
              >
                {shareError || shareSuccess}
              </div>
            )}

            {/* Test Groups & Parameter Entry Cards */}
            {detail.order_tests.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                No test groups attached to this visit.
              </div>
            ) : (
              detail.order_tests.map((ot) => (
                <div key={ot.id} id={`test-card-${ot.id}`} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="font-bold text-slate-900 text-sm">{ot.test_group_name}</h3>
                    <span className="text-xs text-slate-500">
                      {ot.parameters.filter((p) => !p.is_bold_header).length} parameters
                    </span>
                  </div>

                  {/* Parameter Entry Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-slate-500 bg-slate-50 text-left border-y border-slate-100">
                        <tr>
                          <th className="py-2 px-3 font-semibold">Investigation Parameter</th>
                          <th className="py-2 px-3 font-semibold w-40">Observed Value</th>
                          <th className="py-2 px-3 font-semibold w-24">Unit</th>
                          <th className="py-2 px-3 font-semibold w-36">Normal Reference Range</th>
                          <th className="py-2 px-3 font-semibold w-24 text-center">Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ot.parameters.map((p) => {
                          if (p.is_bold_header) {
                            return (
                              <tr key={p.id} className="bg-slate-50/80">
                                <td colSpan={5} className="py-2 px-3 font-bold text-slate-800 tracking-wide uppercase text-[11px]">
                                  {p.name}
                                </td>
                              </tr>
                            );
                          }

                          const currentValue = draftValues[p.id] ?? '';
                          const normalRange = p.normal_range_male || p.normal_range_female || '';
                          const flag = checkAbnormality(currentValue, normalRange);

                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {p.name}
                              </td>
                              <td className="py-2.5 px-3">
                                <input
                                  id={`param-input-${p.id}`}
                                  type="text"
                                  className={`w-full px-2.5 py-1 text-xs rounded-md border font-mono transition focus:outline-hidden focus:ring-1 ${
                                    p.formula
                                      ? 'border-blue-200 bg-blue-50/60 text-blue-900 italic cursor-not-allowed'
                                      : flag === 'high'
                                      ? 'border-rose-400 bg-rose-50 text-rose-900 font-bold focus:ring-rose-500'
                                      : flag === 'low'
                                      ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold focus:ring-amber-500'
                                      : 'border-slate-300 bg-white text-slate-800 focus:ring-blue-500'
                                  }`}
                                  value={currentValue}
                                  readOnly={Boolean(p.formula)}
                                  onChange={(e) => {
                                    const updated = { ...draftValues, [p.id]: e.target.value };
                                    setDraftValues(computeFormulas(ot.parameters, updated));
                                  }}
                                  placeholder={p.formula ? 'Auto-calculated' : 'Enter value'}
                                />
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {p.unit || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {normalRange || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {flag === 'high' && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                                    <ArrowUp className="w-2.5 h-2.5" /> High
                                  </span>
                                )}
                                {flag === 'low' && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                    <ArrowDown className="w-2.5 h-2.5" /> Low
                                  </span>
                                )}
                                {flag === 'normal' && (
                                  <span className="text-[10px] font-semibold text-emerald-600">Normal</span>
                                )}
                                {flag === 'none' && <span className="text-slate-300">-</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Save Button for this Test Group */}
                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      {savedSuccessTestId === ot.id && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded">
                          <Check className="w-3.5 h-3.5" /> Results saved successfully!
                        </span>
                      )}
                    </div>
                    <button
                      id={`save-results-btn-${ot.id}`}
                      onClick={() => saveResults(ot.id)}
                      disabled={savingTestId === ot.id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingTestId === ot.id ? 'Saving Results...' : 'Save Test Results'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
