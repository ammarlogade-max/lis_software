import { useEffect, useState } from 'react';
import { ordersDb, reportSettingsDb, storageDb } from '../lib/db';
import {
  Printer,
  FileText,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  Building2,
  User,
  Stethoscope,
  RefreshCw,
  Eye,
  Sliders,
} from 'lucide-react';

interface OrderOption {
  id: string;
  lab_id: string;
  patient_name: string;
  status: string;
}

interface OrderDetail {
  id: string;
  lab_id: string;
  specimen_id: string;
  patient_name: string;
  patient_title: string;
  gender: string;
  age_years: number | null;
  age_months: number | null;
  mrn: string;
  phone: string;
  doctor_name: string;
  centre_name: string;
  branch_name: string;
  status: string;
  priority: string;
  created_at: string;
  collected_at: string | null;
  phlebotomist: string | null;
  order_tests: {
    id: string;
    test_group_name: string;
    department: string;
    method: string;
    status: string;
    parameters: {
      id: string;
      name: string;
      unit: string | null;
      is_bold_header: boolean;
      normal_range_male: string | null;
      normal_range_female: string | null;
      value: string | null;
    }[];
  }[];
}

interface ReportSettings {
  lab_name: string;
  phone: string;
  email: string;
  address: string;
  registration_no: string;
  footer_note: string;
  signatory_name: string;
  signatory_degree: string;
  signatory_title: string;
  signatory2_name: string;
  signatory2_degree: string;
  signatory2_title: string;
  signatory3_name: string;
  signatory3_degree: string;
  signatory3_title: string;
  logo_path: string | null;
  qr_code_path: string | null;
  report_template_path?: string | null;
  font_styles?: Record<string, { size: number; weight: 'normal' | 'bold'; color: string }>;
}

export default function ReportDesigner() {
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Print & Layout Config
  const [stationeryMode, setStationeryMode] = useState<'plain' | 'preprinted'>('plain');
  const [showQR, setShowQR] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [topMarginInch, setTopMarginInch] = useState<number>(2.5);
  const [bottomMarginInch, setBottomMarginInch] = useState<number>(1.5);
  const [fontSizeScale, setFontSizeScale] = useState<'compact' | 'standard' | 'large'>('standard');
  const [reportTemplateUrl, setReportTemplateUrl] = useState<string | null>(null);
  const [reportTemplateType, setReportTemplateType] = useState<'image' | 'pdf' | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [viewerZoom, setViewerZoom] = useState(100);
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerSearch, setViewerSearch] = useState('');
  const [searchMessage, setSearchMessage] = useState('');

  async function loadInitialData() {
    try {
      setLoading(true);
      const [orderList, reportCfg] = await Promise.all([
        ordersDb.list(),
        reportSettingsDb.get(),
      ]);
      setOrders(orderList || []);
      setSettings(reportCfg);
      setReportTemplateUrl(reportCfg.report_template_path || null);
      setReportTemplateType(reportCfg.report_template_path?.toLowerCase().includes('.pdf') ? 'pdf' : reportCfg.report_template_path ? 'image' : null);

      if (orderList && orderList.length > 0) {
        // Prefer an order with results or the first one
        const activeOrder = orderList[0];
        setSelectedOrderId(activeOrder.id);
        await loadOrderDetail(activeOrder.id);
      }
    } catch (error) {
      console.error('Unable to load report data', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrderDetail(id: string) {
    try {
      const detail = await ordersDb.getDetail(id);
      const patient = (detail as any).patient || {};
      setOrderDetail({
        ...(detail as any),
        patient_name: patient.full_name || '',
        patient_title: patient.title || '',
        gender: patient.gender || '',
        age_years: patient.age_years ?? null,
        mrn: patient.mrn || '',
        phone: patient.phone || '',
        doctor_name: (detail as any).doctor_name || '',
        centre_name: (detail as any).centre_name || '',
        branch_name: (detail as any).branch_name || '',
        created_at: (detail as any).created_at || '',
        collected_at: (detail as any).collected_at || null,
        phlebotomist: (detail as any).phlebotomist || null,
      } as OrderDetail);
    } catch (error) {
      console.error('Unable to load report order', error);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  function handleOrderChange(id: string) {
    setSelectedOrderId(id);
    loadOrderDetail(id);
  }

  function handlePrint() {
    window.print();
  }

  async function handleReportTemplateUpload(file: File | undefined) {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImage && !isPdf) {
      setTemplateError('Choose a report format image or PDF.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setTemplateError('The report format file must be 15 MB or smaller.');
      return;
    }
    setUploadingTemplate(true);
    setTemplateError(null);
    try {
      const url = await storageDb.uploadReportTemplate(file);
      await reportSettingsDb.update({ report_template_path: url });
      setReportTemplateUrl(url);
      setReportTemplateType(isPdf ? 'pdf' : 'image');
      setSettings((current) => current ? { ...current, report_template_path: url } : current);
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Could not upload the report format.');
    } finally {
      setUploadingTemplate(false);
    }
  }

  async function clearReportTemplate() {
    setUploadingTemplate(true);
    setTemplateError(null);
    try {
      await reportSettingsDb.update({ report_template_path: null });
      setReportTemplateUrl(null);
      setReportTemplateType(null);
      setSettings((current) => current ? { ...current, report_template_path: null } : current);
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Could not remove the report format.');
    } finally {
      setUploadingTemplate(false);
    }
  }

  // Parse numeric value to check normal range
  function checkValueStatus(valStr: string | null, rangeStr: string | null) {
    if (!valStr || !rangeStr) return { status: 'normal', flag: null };
    const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return { status: 'normal', flag: null };

    const parts = rangeStr.split('-').map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const [low, high] = parts;
      if (num < low) return { status: 'low', flag: 'L' };
      if (num > high) return { status: 'high', flag: 'H' };
    }
    return { status: 'normal', flag: null };
  }

  return (
    <div id="report-designer-page" className="space-y-6">
      {/* Top Header Controls (Hidden on Print) */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Report Print & Stationery Designer</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live WYSIWYG pathology report previewer, stationery margin calibration, and direct thermal/A4 printing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadInitialData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            Print Report (A4 / PDF)
          </button>
        </div>
      </div>

      {/* Configuration & Order Selector Bar (Hidden on Print) */}
      <div className="print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Patient Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Select Patient / Visit Order:
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => handleOrderChange(e.target.value)}
              className="w-full text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-white"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.lab_id} — {o.patient_name} ({o.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Stationery Mode */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Stationery Paper Mode:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStationeryMode('plain')}
                className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg border text-center transition ${
                  stationeryMode === 'plain'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Plain Paper (With Header)
              </button>
              <button
                type="button"
                onClick={() => setStationeryMode('preprinted')}
                className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg border text-center transition ${
                  stationeryMode === 'preprinted'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Pre-Printed Letterhead
              </button>
            </div>
          </div>

          {/* Pre-printed Margin Adjuster (only visible in preprinted mode) */}
          {stationeryMode === 'preprinted' && (
            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-purple-900 mb-1">Top Blank Margin</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="4.5"
                    value={topMarginInch}
                    onChange={(e) => setTopMarginInch(Number(e.target.value))}
                    className="w-16 text-xs font-bold px-2 py-1.5 border border-purple-300 rounded bg-purple-50 text-purple-950 text-center"
                  />
                  <span className="text-xs text-purple-700 font-semibold">inch</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-purple-900 mb-1">Bottom Margin</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="3"
                    value={bottomMarginInch}
                    onChange={(e) => setBottomMarginInch(Number(e.target.value))}
                    className="w-16 text-xs font-bold px-2 py-1.5 border border-purple-300 rounded bg-purple-50 text-purple-950 text-center"
                  />
                  <span className="text-xs text-purple-700 font-semibold">inch</span>
                </div>
              </div>
            </div>
          )}

          {/* Checkbox Toggles */}
          <div className="flex items-center gap-4 text-xs font-medium text-slate-700 pt-6">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showQR}
                onChange={(e) => setShowQR(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Verification QR
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showBarcode}
                onChange={(e) => setShowBarcode(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Barcode
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Signatures
            </label>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Report Format Reference</label>
              <p className="text-xs text-slate-500">Upload the laboratory report format as an image or PDF for side-by-side reference.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg cursor-pointer">
                <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploadingTemplate} onChange={(event) => handleReportTemplateUpload(event.target.files?.[0])} />
                {uploadingTemplate ? 'Uploading...' : 'Upload Image / PDF'}
              </label>
              {reportTemplateUrl && (
                <button type="button" onClick={clearReportTemplate} disabled={uploadingTemplate} className="px-3 py-2 text-xs font-semibold text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50">
                  Remove
                </button>
              )}
            </div>
          </div>
          {templateError && <p className="mt-2 text-xs text-rose-600">{templateError}</p>}
          {reportTemplateUrl && (
            <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <div className="px-3 py-2 text-[11px] font-semibold text-slate-600 border-b border-slate-200">Uploaded reference preview</div>
              {reportTemplateType === 'pdf' ? (
                <iframe title="Uploaded report format PDF" src={reportTemplateUrl} className="w-full h-80 bg-white" />
              ) : (
                <img src={reportTemplateUrl} alt="Uploaded report format reference" className="max-h-96 max-w-full mx-auto object-contain bg-white" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="print:hidden flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
        <span className="text-xs font-bold text-slate-600 mr-2">Report viewer</span>
        <button type="button" disabled={viewerPage <= 1} onClick={() => setViewerPage((page) => Math.max(1, page - 1))} className="px-2 py-1 text-xs border rounded disabled:opacity-40">Previous</button>
        <span className="text-xs text-slate-600">Page {viewerPage} of 1</span>
        <button type="button" disabled onClick={() => setViewerPage((page) => page + 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-40">Next</button>
        <button type="button" onClick={() => setViewerZoom((zoom) => Math.max(60, zoom - 10))} className="px-2 py-1 text-xs border rounded">−</button>
        <span className="text-xs font-semibold w-12 text-center">{viewerZoom}%</span>
        <button type="button" onClick={() => setViewerZoom((zoom) => Math.min(150, zoom + 10))} className="px-2 py-1 text-xs border rounded">+</button>
        <button type="button" onClick={() => setViewerZoom(100)} className="px-2 py-1 text-xs border rounded">Page width</button>
        <input value={viewerSearch} onChange={(e) => setViewerSearch(e.target.value)} placeholder="Find in report" className="ml-auto w-36 px-2 py-1 text-xs border rounded" />
        <button type="button" onClick={() => setSearchMessage(viewerSearch && document.getElementById('diagnostic-report-sheet')?.innerText.toLowerCase().includes(viewerSearch.toLowerCase()) ? 'Found' : 'Not found')} className="px-2 py-1 text-xs border rounded">Find</button>
        {searchMessage && <span className="text-xs text-slate-500">{searchMessage}</span>}
        <button type="button" onClick={handlePrint} className="px-2 py-1 text-xs font-semibold text-blue-700 border border-blue-200 rounded">Print / Export</button>
      </div>

      {/* The Printable A4 Sheet Simulator */}
      <div className="flex justify-center bg-slate-100 p-4 sm:p-8 rounded-xl border border-slate-200 shadow-inner overflow-x-auto print:bg-white print:p-0 print:border-none print:shadow-none">
        <div
          id="diagnostic-report-sheet"
          className="bg-white text-slate-900 w-[210mm] min-h-[297mm] shadow-2xl p-8 sm:p-10 flex flex-col justify-between print:shadow-none print:p-6 print:w-full print:min-h-0"
          style={{
            paddingTop: stationeryMode === 'preprinted' ? `${topMarginInch}in` : undefined,
            paddingBottom: stationeryMode === 'preprinted' ? `${bottomMarginInch}in` : undefined,
            transform: `scale(${viewerZoom / 100})`,
            transformOrigin: 'top center',
            marginBottom: viewerZoom > 100 ? `${(viewerZoom - 100) * 2}px` : undefined,
          }}
        >
          {/* Section 1: Header (Shown ONLY if Plain Paper Mode) */}
          {stationeryMode === 'plain' ? (
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-700 text-white font-black text-xl flex items-center justify-center shadow-xs">
                    P1
                  </div>
                  <div>
                    <h2
                      className="text-xl font-black tracking-tight leading-none uppercase"
                      style={{
                        fontSize: settings?.font_styles?.lab_name?.size,
                        fontWeight: settings?.font_styles?.lab_name?.weight,
                        color: settings?.font_styles?.lab_name?.color,
                      }}
                    >
                      {settings?.lab_name || 'Lab name not set — configure under Report Settings'}
                    </h2>
                    <p className="text-xs font-semibold text-blue-700 mt-0.5">
                      {settings?.registration_no ? `Reg. No: ${settings.registration_no}` : ''}
                    </p>
                    <div
                      className="text-[11px] mt-1"
                      style={{
                        fontSize: settings?.font_styles?.address?.size,
                        fontWeight: settings?.font_styles?.address?.weight,
                        color: settings?.font_styles?.address?.color,
                      }}
                    >
                      {settings?.address || 'Address not set'}
                      {settings?.phone ? ` | Tel: ${settings.phone}` : ''}
                    </div>
                  </div>
                </div>

                {showQR && (
                  <div className="text-center shrink-0">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded p-1 flex items-center justify-center shadow-xs">
                      <QrCode className="w-14 h-14" />
                    </div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                      Scan to Verify
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border-b border-dashed border-purple-300 pb-1 mb-3 text-center print:hidden">
              <span className="text-[10px] uppercase tracking-widest text-purple-700 font-bold bg-purple-50 px-3 py-0.5 rounded">
                --- Pre-Printed Letterhead Header Margin Reserved ({topMarginInch} in) ---
              </span>
            </div>
          )}

          {/* Section 2: Patient Demographic & Visit Box */}
          {orderDetail && (
            <div className="bg-slate-50/80 border border-slate-300 rounded-lg p-3 text-xs mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Patient Name:</span>
                  <span className="font-bold text-slate-900 text-sm">{orderDetail.patient_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Age / Gender:</span>
                  <span className="font-bold text-slate-900">
                    {orderDetail.age_years ?? '-'} Yrs / {orderDetail.gender}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">MRN / Patient ID:</span>
                  <span className="font-mono font-bold text-slate-900">{orderDetail.mrn}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Lab Reference ID:</span>
                  <span className="font-mono font-bold text-blue-700 text-sm">{orderDetail.lab_id}</span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Referring Doctor:</span>
                  <span className="font-semibold text-slate-800">{orderDetail.doctor_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Collection Center:</span>
                  <span className="font-medium text-slate-700">{orderDetail.centre_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Registered On:</span>
                  <span className="font-medium text-slate-700">{orderDetail.created_at || '2026-03-06'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Specimen Accession:</span>
                  <span className="font-mono font-semibold text-slate-700">{orderDetail.specimen_id}</span>
                </div>
              </div>

              {showBarcode && (
                <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-slate-600">SAMPLE BARCODE:</span>
                    <span className="font-mono font-black text-slate-900">*{orderDetail.specimen_id}*</span>
                  </div>
                  <div className="text-slate-500">
                    Priority: <strong className="uppercase text-slate-800">{orderDetail.priority}</strong> | Drawn by:{' '}
                    {orderDetail.phlebotomist || 'Sister Maria Davis'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Diagnostic Report Body */}
          <div className="flex-1 space-y-6">
            {orderDetail?.order_tests.map((test) => (
              <div key={test.id} className="space-y-2">
                {/* Department / Test Header */}
                <div className="border-b-2 border-slate-800 pb-1 flex items-baseline justify-between">
                  <h3 className="font-black text-sm uppercase tracking-wide text-slate-900">
                    {test.test_group_name}
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Dept: {test.department} | Method: {test.method}
                  </span>
                </div>

                {/* Parameters Table */}
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-1.5 w-5/12">Test Parameter / Analyte</th>
                      <th className="py-1.5 w-2/12">Observed Value</th>
                      <th className="py-1.5 w-2/12">Flag</th>
                      <th className="py-1.5 w-1/12">Unit</th>
                      <th className="py-1.5 w-2/12 text-right">Biological Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {test.parameters.map((p) => {
                      if (p.is_bold_header) {
                        return (
                          <tr key={p.id} className="bg-slate-100 font-bold text-slate-900">
                            <td colSpan={5} className="py-1 px-1 text-[11px] uppercase tracking-wider">
                              {p.name}
                            </td>
                          </tr>
                        );
                      }

                      const range = orderDetail?.gender === 'Female' ? p.normal_range_female : p.normal_range_male;
                      const check = checkValueStatus(p.value, range);
                      const isHigh = check.status === 'high';
                      const isLow = check.status === 'low';
                      const isAbnormal = isHigh || isLow;

                      return (
                        <tr key={p.id} className={isAbnormal ? 'bg-amber-50/50' : ''}>
                          <td className="py-1.5 text-slate-800 font-medium">{p.name}</td>
                          <td className="py-1.5 font-mono">
                            <span className={`text-sm ${isAbnormal ? 'font-black text-slate-950' : 'font-semibold text-slate-800'}`}>
                              {p.value ?? '---'}
                            </span>
                          </td>
                          <td className="py-1.5">
                            {isHigh && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                                HIGH (H)
                              </span>
                            )}
                            {isLow && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-600 text-white">
                                LOW (L)
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 text-slate-500 font-mono text-[11px]">{p.unit || '-'}</td>
                          <td className="py-1.5 text-right font-mono text-[11px] text-slate-600">
                            {range || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Section 4: End of Report Marker */}
          <div className="text-center my-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-t border-b border-slate-200 px-6 py-0.5">
              *** END OF EXAMINATION REPORT ***
            </span>
          </div>

          {/* Section 5: Pathologist Signatures Block — up to 3, driven by Report Settings.
              Blank signatory slots are skipped rather than filled with placeholder names. */}
          {showSignatures &&
            (() => {
              const slots = [
                { name: settings?.signatory_name, degree: settings?.signatory_degree, title: settings?.signatory_title },
                { name: settings?.signatory2_name, degree: settings?.signatory2_degree, title: settings?.signatory2_title },
                { name: settings?.signatory3_name, degree: settings?.signatory3_degree, title: settings?.signatory3_title },
              ].filter((s) => s.name && s.name.trim());
              if (slots.length === 0) {
                return (
                  <div className="pt-4 border-t border-slate-300 text-center mt-6 text-[11px] text-slate-400">
                    No signatories configured — add them under Report Settings.
                  </div>
                );
              }
              return (
                <div
                  className="pt-4 border-t border-slate-300 grid gap-4 text-center mt-6"
                  style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
                >
                  {slots.map((s, i) => (
                    <div key={i}>
                      <div className="h-10 flex items-center justify-center italic text-blue-900 text-xs font-serif font-bold">
                        {s.name}
                      </div>
                      <div className="border-t border-slate-400 pt-1">
                        <div className="font-bold text-xs text-slate-900">
                          {s.name}
                          {s.degree ? `, ${s.degree}` : ''}
                        </div>
                        {s.title && <div className="text-[10px] text-slate-500">{s.title}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

          {/* Section 6: Footer Disclaimer (Shown ONLY in Plain Paper Mode) */}
          {stationeryMode === 'plain' ? (
            <div className="mt-4 pt-2 border-t border-slate-200 text-[9px] text-slate-400 text-center leading-tight">
              {settings?.footer_note ||
                'This report is authorized electronically and does not require a physical handwritten signature. Pathological findings are for clinical correlation only.'}
            </div>
          ) : (
            <div className="border-t border-dashed border-purple-300 pt-1 mt-3 text-center print:hidden">
              <span className="text-[10px] uppercase tracking-widest text-purple-700 font-bold bg-purple-50 px-3 py-0.5 rounded">
                --- Pre-Printed Letterhead Footer Margin Reserved ({bottomMarginInch} in) ---
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
