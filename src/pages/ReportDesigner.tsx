import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordersDb, pageSetupDb, reportSettingsDb, storageDb } from '../lib/db';
import type { PageSetup } from '../lib/db';
import { readReportGroupPageModes, saveReportGroupPageModes } from '../lib/reportLayout';
import { supabase } from '../lib/supabaseClient';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import {
  Printer,
  FileText,
  Settings2,
  QrCode,
  RefreshCw,
  Mail,
  MessageCircle,
  Download,
  Palette,
  X,
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
  patient_email: string;
  doctor_name: string;
  doctor_phone: string;
  doctor_email: string;
  centre_name: string;
  branch_name: string;
  status: string;
  priority: string;
  created_at: string;
  collection_at: string | null;
  received_at: string | null;
  reporting_at: string | null;
  collected_at: string | null;
  phlebotomist: string | null;
  remarks: string;
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
  signatory_signature_path: string | null;
  signatory2_signature_path: string | null;
  signatory3_signature_path: string | null;
  logo_path: string | null;
  footer_image_path: string | null;
  qr_code_path: string | null;
  report_template_path?: string | null;
  lab_name_alignment: string;
  address_alignment: string;
  test_title_alignment: string;
  font_color: string;
  abnormal_red_enabled: boolean;
  font_styles?: Record<string, { size: number; weight: 'normal' | 'bold'; color: string }>;
}

const REPORT_PRINT_OPTIONS = [
  ['without_header_report', 'Without Header Report'],
  ['without_header_receipt', 'Without Header Receipt'],
  ['use_own_header_image', 'Use Own Header Image'],
  ['patient_id', 'Patient ID'],
  ['sample_date', 'Sample Collected Date'],
  ['sample_time', 'Sample Collected Time'],
  ['received_date', 'Print Received Date'],
  ['received_time', 'Sample Received Time'],
  ['reporting_date', 'Reporting Date'],
  ['reporting_time', 'Reporting Time'],
  ['collection_centre', 'Print Collection Centre'],
  ['registration_number', 'Registration No.'],
  ['footer_date_time', 'Footer Date Time'],
  ['page_number', 'Page Number'],
  ['barcode', 'Bar Code'],
  ['qr_code', 'QR Code'],
  ['uhid', 'UHID'],
  ['header_on_pdf_file', 'Header on PDF file'],
  ['print_end_of_report', 'Print End of Report'],
  ['investigations_note', 'Investigations Note'],
  ['footer_line', 'Footer Line'],
  ['header_line', 'Header Line'],
  ['indicate_high_low', 'Indicate High/Low'],
  ['end_of_report_line', 'End of Report Line'],
] as const;

const INITIAL_PRINT_FLAGS = Object.fromEntries([
  ...REPORT_PRINT_OPTIONS.map(([key]) => [key, true]),
  ['signatory_1_signature', true],
  ['signatory_1_name', true],
  ['signatory_2_signature', true],
  ['signatory_2_name', true],
  ['signatory_3_signature', true],
  ['signatory_3_name', true],
]) as Record<string, boolean>;

function formatReportDate(value: string | null, includeTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return includeTime
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString();
}

function MarginInputs({
  title,
  value,
  onChange,
}: {
  title: string;
  value: PageSetup['report_margin'];
  onChange: (next: PageSetup['report_margin']) => void;
}) {
  const edges: (keyof PageSetup['report_margin'])[] = ['top', 'bottom', 'left', 'right'];
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] font-semibold text-slate-600">{title} Margin</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {edges.map((edge) => (
          <label key={edge} className="text-[10px] capitalize text-slate-500">
            {edge}
            <input
              type="number"
              min="0"
              max="5"
              step="0.05"
              value={value[edge]}
              onChange={(event) => onChange({ ...value, [edge]: Number(event.target.value) })}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-800"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function SpecimenBarcode({ value }: { value: string }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!barcodeRef.current || !value) return;
    try {
      JsBarcode(barcodeRef.current, value, {
        format: 'CODE128',
        displayValue: true,
        font: 'monospace',
        fontSize: 10,
        height: 36,
        margin: 2,
        width: 1.5,
        textMargin: 2,
      });
      setError(null);
    } catch (caughtError) {
      console.error('Unable to render specimen barcode', caughtError);
      setError('Barcode could not be generated.');
    }
  }, [value]);

  return error
    ? <span role="img" aria-label={error} className="text-rose-700">{error}</span>
    : <svg ref={barcodeRef} aria-label={`Specimen barcode ${value}`} />;
}

export default function ReportDesigner() {
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [pageBreaks, setPageBreaks] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [pageSetup, setPageSetup] = useState<PageSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Print & Layout Config
  const [stationeryMode, setStationeryMode] = useState<'plain' | 'preprinted'>('plain');
  const [topMarginInch, setTopMarginInch] = useState<number>(2.5);
  const [bottomMarginInch, setBottomMarginInch] = useState<number>(1.5);
  const [fontSizeScale, setFontSizeScale] = useState<'compact' | 'standard' | 'large'>('standard');
  const [reportTemplateUrl, setReportTemplateUrl] = useState<string | null>(null);
  const [reportTemplateType, setReportTemplateType] = useState<'image' | 'pdf' | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [headerImageError, setHeaderImageError] = useState<string | null>(null);
  const [signatureUploadError, setSignatureUploadError] = useState<string | null>(null);
  const [viewerZoom, setViewerZoom] = useState(100);
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerSearch, setViewerSearch] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [emailPatient, setEmailPatient] = useState(true);
  const [emailDoctor, setEmailDoctor] = useState(false);
  const [whatsappRecipient, setWhatsappRecipient] = useState<'patient' | 'doctor'>('patient');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  const printFlags = pageSetup?.print_flags ?? INITIAL_PRINT_FLAGS;
  const showQR = printFlags.qr_code;
  const showBarcode = printFlags.barcode;
  const showSignatures = [1, 2, 3].some((number) => printFlags[`signatory_${number}_name`] || printFlags[`signatory_${number}_signature`]);
  const setShowQR = (value: boolean) => updatePrintFlag('qr_code', value);
  const setShowBarcode = (value: boolean) => updatePrintFlag('barcode', value);
  const setShowSignatures = (value: boolean) => {
    [1, 2, 3].forEach((number) => {
      updatePrintFlag(`signatory_${number}_name`, value);
      updatePrintFlag(`signatory_${number}_signature`, value);
    });
  };

  async function handleHeaderImageUpload(file: File | undefined) {
    if (!file || !settings) return;
    if (!file.type.startsWith('image/')) {
      setHeaderImageError('Choose an image file for the report header.');
      return;
    }
    setUploadingTemplate(true);
    setHeaderImageError(null);
    try {
      const url = await storageDb.uploadPublicImage(file, 'logo');
      await reportSettingsDb.update({ logo_path: url });
      setSettings((current) => current ? { ...current, logo_path: url } : current);
    } catch (error) {
      setHeaderImageError(error instanceof Error ? error.message : 'Could not upload the report header image.');
    } finally {
      setUploadingTemplate(false);
    }
  }

  async function removeHeaderImage() {
    if (!settings) return;
    setHeaderImageError(null);
    try {
      await reportSettingsDb.update({ logo_path: null });
      setSettings((current) => current ? { ...current, logo_path: null } : current);
    } catch (error) {
      setHeaderImageError(error instanceof Error ? error.message : 'Could not remove the report header image.');
    }
  }

  async function loadInitialData() {
    try {
      setLoading(true);
      setLoadError(null);
      const [orderList, reportCfg, setup] = await Promise.all([
        ordersDb.list(),
        reportSettingsDb.get(),
        pageSetupDb.get(),
      ]);
      setOrders(orderList || []);
      setSettings(reportCfg);
      setPageSetup({
        ...setup,
        print_flags: { ...INITIAL_PRINT_FLAGS, ...setup.print_flags },
      });
      setReportTemplateUrl(reportCfg.report_template_path || null);
      setReportTemplateType(reportCfg.report_template_path?.toLowerCase().includes('.pdf') ? 'pdf' : reportCfg.report_template_path ? 'image' : null);

      if (orderList && orderList.length > 0) {
        const requestedOrderId = new URLSearchParams(window.location.search).get('orderId');
        const activeOrder = orderList.find((order) => order.id === requestedOrderId) || orderList[0];
        setSelectedOrderId(activeOrder.id);
        await loadOrderDetail(activeOrder.id);
      }
    } catch (error) {
      console.error('Unable to load report data', error);
      setLoadError(error instanceof Error ? error.message : 'Unable to load report designer data.');
    } finally {
      setLoading(false);
    }
  }

  async function loadOrderDetail(id: string) {
    try {
      const detail = await ordersDb.getDetail(id);
      const patient = (detail as any).patient || {};
      const orderGroups = ((detail as any).order_tests || []) as OrderDetail['order_tests'];
      let savedModes: Record<string, boolean> = {};
      try {
        savedModes = readReportGroupPageModes(id);
        setLayoutError(null);
      } catch (error) {
        setLayoutError(error instanceof Error ? error.message : 'Could not load the saved report page layout.');
        console.error('Unable to load saved report page layout', error);
      }
      setOrderDetail({
        ...(detail as any),
        patient_name: patient.full_name || '',
        patient_title: patient.title || '',
        gender: patient.gender || '',
        age_years: patient.age_years ?? null,
        age_months: patient.age_months ?? null,
        mrn: patient.mrn || '',
        phone: patient.phone || '',
        patient_email: patient.email || '',
        doctor_name: (detail as any).doctor_name || '',
        doctor_phone: (detail as any).doctor_phone || '',
        doctor_email: (detail as any).doctor_email || '',
        centre_name: (detail as any).centre_name || '',
        branch_name: (detail as any).branch_name || '',
        created_at: (detail as any).created_at || '',
        collection_at: (detail as any).collection_at || null,
        received_at: (detail as any).received_at || null,
        reporting_at: (detail as any).reporting_at || null,
        collected_at: (detail as any).collected_at || null,
        phlebotomist: (detail as any).phlebotomist || null,
        remarks: (detail as any).remarks || '',
      } as OrderDetail);
      setPageBreaks(Object.fromEntries(orderGroups.map((group) => [group.id, savedModes[group.id] ?? false])));
      setViewerPage(1);
      setDeliveryPhone((current) => current || patient.phone || '');
      setDeliveryMessage(null);
      setDeliveryError(null);
    } catch (error) {
      console.error('Unable to load report order', error);
      setLoadError(error instanceof Error ? error.message : 'Unable to load this patient report.');
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!pageSetup) return;
    const timer = window.setTimeout(async () => {
      setSettingsSaveStatus('saving');
      try {
        await pageSetupDb.update(pageSetup);
        setSettingsSaveStatus('saved');
      } catch (error) {
        console.error('Unable to save report page setup', error);
        setSettingsSaveStatus('error');
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [pageSetup]);

  useEffect(() => {
    if (!settings) return;
    const timer = window.setTimeout(async () => {
      setSettingsSaveStatus('saving');
      try {
        await reportSettingsDb.update({
          lab_name: settings.lab_name,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          registration_no: settings.registration_no,
          footer_note: settings.footer_note,
          signatory_name: settings.signatory_name,
          signatory_degree: settings.signatory_degree,
          signatory_title: settings.signatory_title,
          signatory2_name: settings.signatory2_name,
          signatory2_degree: settings.signatory2_degree,
          signatory2_title: settings.signatory2_title,
          signatory3_name: settings.signatory3_name,
          signatory3_degree: settings.signatory3_degree,
          signatory3_title: settings.signatory3_title,
          lab_name_alignment: settings.lab_name_alignment,
          address_alignment: settings.address_alignment,
          test_title_alignment: settings.test_title_alignment,
          font_color: settings.font_color,
          abnormal_red_enabled: settings.abnormal_red_enabled,
          font_styles: settings.font_styles || {},
        });
        setSettingsSaveStatus('saved');
      } catch (error) {
        console.error('Unable to save report header settings', error);
        setSettingsSaveStatus('error');
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [settings]);

  function handleOrderChange(id: string) {
    setSelectedOrderId(id);
    setOrderDetail(null);
    setLayoutError(null);
    loadOrderDetail(id);
  }

  function handlePageBreakChange(groupId: string, startNewPage: boolean) {
    const next = { ...pageBreaks, [groupId]: startNewPage };
    setPageBreaks(next);
    if (!selectedOrderId) return;
    try {
      saveReportGroupPageModes(selectedOrderId, next);
      setLayoutError(null);
    } catch (error) {
      setLayoutError(error instanceof Error ? error.message : 'Could not save the report page layout.');
      console.error('Unable to save report page layout', error);
    }
  }

  function handlePrint() {
    window.print();
  }

  async function createCurrentReportPdf() {
    if (!orderDetail) throw new Error('Select a patient report first.');
    if (!settings) throw new Error('Report settings have not loaded.');
    await document.fonts.ready;
    const pages = Array.from(document.querySelectorAll<HTMLElement>('#report-print-pages .report-page'));
    if (pages.length === 0) throw new Error('The report preview is not ready to export.');

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const scale = fontSizeScale === 'compact' ? 0.9 : fontSizeScale === 'large' ? 1.1 : 1;
    for (const [index, page] of pages.entries()) {
      const images = Array.from(page.querySelectorAll('img'));
      await Promise.all(images.map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve, reject) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => reject(new Error(`Could not load report image: ${image.alt || image.src}`)), { once: true });
          });
        }
        if (image.naturalWidth === 0) throw new Error(`Could not load report image: ${image.alt || image.src}`);
        if (image.src && !image.src.startsWith('data:') && new URL(image.src).origin !== window.location.origin) {
          const response = await fetch(image.src, { mode: 'cors' });
          if (!response.ok) throw new Error(`Could not load report image (${response.status}): ${image.alt || image.src}`);
        }
      }));
      const canvas = await html2canvas(page, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        onclone: (clonedDocument) => {
          const clonedPage = clonedDocument.getElementById(page.id);
          if (!clonedPage) throw new Error(`Could not prepare report page ${index + 1} for export.`);
          clonedPage.style.setProperty('zoom', String(scale), 'important');
          clonedPage.style.setProperty('width', '210mm', 'important');
          clonedPage.style.setProperty('min-height', '297mm', 'important');
          clonedPage.style.setProperty('height', 'auto', 'important');
          clonedPage.style.setProperty('margin', '0', 'important');
          clonedPage.style.setProperty('box-shadow', 'none', 'important');
          if (!printFlags.header_on_pdf_file) {
            clonedPage.querySelector('.report-print-header')?.remove();
          }
        },
      });
      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297);
      canvas.width = 0;
      canvas.height = 0;
    }
    return pdf.output('blob');
  }

  async function downloadCurrentReport() {
    setDeliveryError(null);
    setDeliveryMessage(null);
    try {
      const blob = await createCurrentReportPdf();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `report-${orderDetail?.lab_id || orderDetail?.id}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setDeliveryMessage('Report PDF downloaded.');
    } catch (error) {
      setDeliveryError(error instanceof Error ? error.message : 'Could not generate the report PDF.');
    }
  }

  async function emailCurrentReport() {
    if (!orderDetail) return;
    const recipients = [
      emailPatient ? { email: orderDetail.patient_email, name: orderDetail.patient_name } : null,
      emailDoctor ? { email: orderDetail.doctor_email, name: orderDetail.doctor_name } : null,
    ].filter((recipient): recipient is { email: string; name: string } => Boolean(recipient?.email));
    if (recipients.length === 0) {
      setDeliveryError('Select a recipient with an email address on file.');
      return;
    }

    setSendingEmail(true);
    setDeliveryError(null);
    setDeliveryMessage(null);
    try {
      const blob = await createCurrentReportPdf();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result !== 'string') {
            reject(new Error('Could not prepare the PDF attachment.'));
            return;
          }
          resolve(reader.result.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('Could not read the PDF attachment.'));
        reader.readAsDataURL(blob);
      });
      const labSettings = await reportSettingsDb.get();
      for (const recipient of recipients) {
        const { error } = await supabase.functions.invoke('send-report-email', {
          body: {
            to: recipient.email,
            patientName: recipient.name,
            labId: orderDetail.lab_id,
            labName: labSettings.lab_name,
            pdfBase64: base64,
          },
        });
        if (error) throw new Error(`Could not send to ${recipient.email}: ${error.message}`);
      }
      setDeliveryMessage(`Report emailed to ${recipients.map((recipient) => recipient.email).join(' and ')}.`);
    } catch (error) {
      setDeliveryError(error instanceof Error
        ? `${error.message} Make sure the send-report-email Edge Function is deployed and RESEND_API_KEY is configured.`
        : 'Could not send the report email.');
    } finally {
      setSendingEmail(false);
    }
  }

  async function sendReportViaWhatsApp() {
    if (!orderDetail) return;
    const phone = deliveryPhone.replace(/[^\d]/g, '');
    if (phone.length < 7) {
      setDeliveryError('Enter a valid mobile number, including the country code, for WhatsApp.');
      return;
    }

    const whatsappWindow = window.open('about:blank', '_blank');
    if (!whatsappWindow) {
      setDeliveryError('Allow pop-ups for this site to open WhatsApp.');
      return;
    }

    setSendingWhatsApp(true);
    setDeliveryError(null);
    setDeliveryMessage(null);
    try {
      const pdf = await createCurrentReportPdf();
      const url = await storageDb.uploadReportPdf(orderDetail.id, pdf);
      const recipientName = whatsappRecipient === 'patient' ? orderDetail.patient_name : orderDetail.doctor_name;
      const message = `Hello ${recipientName}, the laboratory report (${orderDetail.lab_id}) is ready: ${url}`;
      whatsappWindow.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      setDeliveryMessage('WhatsApp opened with the report link. Confirm and send the message in WhatsApp.');
    } catch (error) {
      whatsappWindow.close();
      setDeliveryError(error instanceof Error ? error.message : 'Could not prepare the WhatsApp report.');
    } finally {
      setSendingWhatsApp(false);
    }
  }

  function updatePrintFlag(key: string, value: boolean) {
    setPageSetup((current) => current
      ? { ...current, print_flags: { ...current.print_flags, [key]: value } }
      : current);
  }

  const reportPages: OrderDetail['order_tests'][] = [];
  orderDetail?.order_tests.forEach((test, index) => {
    if (index === 0 || pageBreaks[test.id] || reportPages.length === 0) {
      reportPages.push([test]);
    } else {
      reportPages[reportPages.length - 1].push(test);
    }
  });

  useEffect(() => {
    setViewerPage((current) => Math.min(Math.max(current, 1), Math.max(reportPages.length, 1)));
  }, [reportPages.length]);

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

  async function handleSignatureUpload(number: number, file: File | undefined) {
    if (!file || !settings) return;
    if (!file.type.startsWith('image/')) {
      setSignatureUploadError('Choose an image file for the signatory signature.');
      return;
    }
    setSignatureUploadError(null);
    setUploadingTemplate(true);
    try {
      const url = await storageDb.uploadPublicImage(file, 'signature');
      if (number === 1) {
        await reportSettingsDb.update({ signatory_signature_path: url });
        setSettings({ ...settings, signatory_signature_path: url });
      } else if (number === 2) {
        await reportSettingsDb.update({ signatory2_signature_path: url });
        setSettings({ ...settings, signatory2_signature_path: url });
      } else {
        await reportSettingsDb.update({ signatory3_signature_path: url });
        setSettings({ ...settings, signatory3_signature_path: url });
      }
    } catch (error) {
      setSignatureUploadError(error instanceof Error ? error.message : 'Could not upload the signature image.');
    } finally {
      setUploadingTemplate(false);
    }
  }

  async function removeSignature(number: number) {
    if (!settings) return;
    try {
      if (number === 1) {
        await reportSettingsDb.update({ signatory_signature_path: null });
        setSettings({ ...settings, signatory_signature_path: null });
      } else if (number === 2) {
        await reportSettingsDb.update({ signatory2_signature_path: null });
        setSettings({ ...settings, signatory2_signature_path: null });
      } else {
        await reportSettingsDb.update({ signatory3_signature_path: null });
        setSettings({ ...settings, signatory3_signature_path: null });
      }
    } catch (error) {
      setSignatureUploadError(error instanceof Error ? error.message : 'Could not remove the signature image.');
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadInitialData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${settingsOpen ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <Settings2 className="w-4 h-4" />
            Settings
          </button>
          <button
            type="button"
            onClick={() => setStyleOpen((open) => !open)}
            aria-expanded={styleOpen}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <Palette className="w-4 h-4" />
            Style
          </button>
          <button
            type="button"
            onClick={downloadCurrentReport}
            disabled={!orderDetail}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handlePrint}
            disabled={!orderDetail}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="print:hidden grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Send report by email</p>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={emailPatient} onChange={(event) => setEmailPatient(event.target.checked)} disabled={!orderDetail?.patient_email} />
              E-Mail to Patient <span className="text-slate-400">{orderDetail?.patient_email || 'No patient email on file'}</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={emailDoctor} onChange={(event) => setEmailDoctor(event.target.checked)} disabled={!orderDetail?.doctor_email} />
              E-Mail to Doctor <span className="text-slate-400">{orderDetail?.doctor_email || 'No doctor email on file'}</span>
            </label>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">WhatsApp recipient</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="radio" name="whatsapp-recipient" checked={whatsappRecipient === 'patient'} onChange={() => {
                  setWhatsappRecipient('patient');
                  setDeliveryPhone(orderDetail?.phone || '');
                }} />
                Patient
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="radio" name="whatsapp-recipient" checked={whatsappRecipient === 'doctor'} onChange={() => {
                  setWhatsappRecipient('doctor');
                  setDeliveryPhone(orderDetail?.doctor_phone || '');
                }} />
                Doctor
              </label>
              <input
                aria-label="WhatsApp mobile number"
                value={deliveryPhone}
                onChange={(event) => setDeliveryPhone(event.target.value)}
                placeholder="Mobile, include country code"
                className="min-w-48 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <button type="button" onClick={emailCurrentReport} disabled={sendingEmail || (!emailPatient && !emailDoctor) || !orderDetail} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            <Mail className="h-4 w-4" />{sendingEmail ? 'Sending…' : 'E-Mail'}
          </button>
          <button type="button" onClick={sendReportViaWhatsApp} disabled={sendingWhatsApp || !orderDetail} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            <MessageCircle className="h-4 w-4" />{sendingWhatsApp ? 'Preparing…' : 'WhatsApp'}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-slate-700">
            <input type="checkbox" checked={printFlags.signatory_3_signature} onChange={(event) => updatePrintFlag('signatory_3_signature', event.target.checked)} />
            <span>Signatory 3 signature</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-700">
            <input type="checkbox" checked={printFlags.signatory_3_name} onChange={(event) => updatePrintFlag('signatory_3_name', event.target.checked)} />
            <span>Signatory names</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-700">
            <input type="checkbox" checked={!printFlags.without_header_report} onChange={(event) => updatePrintFlag('without_header_report', !event.target.checked)} />
            <span>Test Header</span>
          </label>
          <span className="text-[10px] text-slate-500" role="status">
            {settingsSaveStatus === 'saving' ? 'Saving settings…' : settingsSaveStatus === 'saved' ? 'Settings saved' : settingsSaveStatus === 'error' ? 'Settings not saved' : ''}
          </span>
        </div>
        {(deliveryError || deliveryMessage) && (
          <div role="status" className={`xl:col-span-2 rounded-lg border px-3 py-2 text-xs ${deliveryError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {deliveryError || deliveryMessage}
          </div>
        )}
      </div>

      {styleOpen && (
        <div className="print:hidden grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-semibold text-slate-800">Report appearance</p>
            <p className="text-xs text-slate-500">Changes preview immediately and save automatically.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              Text size
              <select value={fontSizeScale} onChange={(event) => setFontSizeScale(event.target.value as 'compact' | 'standard' | 'large')} className="rounded-md border border-slate-300 px-2 py-1.5">
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="large">Large</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              Lab name
              <select value={settings?.lab_name_alignment ?? 'Left'} onChange={(event) => settings && setSettings({ ...settings, lab_name_alignment: event.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5">
                <option>Left</option><option>Center</option><option>Right</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              Address
              <select value={settings?.address_alignment ?? 'Left'} onChange={(event) => settings && setSettings({ ...settings, address_alignment: event.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5">
                <option>Left</option><option>Center</option><option>Right</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              Test title
              <select value={settings?.test_title_alignment ?? 'Left'} onChange={(event) => settings && setSettings({ ...settings, test_title_alignment: event.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5">
                <option>Left</option><option>Center</option><option>Right</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              Header color
              <select value={settings?.font_color ?? 'Black'} onChange={(event) => settings && setSettings({ ...settings, font_color: event.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5">
                <option>Black</option><option>Blue</option><option>Green</option><option>Maroon</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={settings?.abnormal_red_enabled ?? true} onChange={(event) => settings && setSettings({ ...settings, abnormal_red_enabled: event.target.checked })} />
              Mark abnormal results red
            </label>
          </div>
          {settings && (
            <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ['lab_name', 'Laboratory name'],
                ['address', 'Address'],
                ['test_title', 'Test title'],
                ['test_name', 'Test name'],
                ['result', 'Result'],
                ['unit', 'Unit'],
                ['normal_values', 'Normal values'],
              ].map(([key, label]) => {
                const fontStyle = settings.font_styles?.[key] ?? {
                  size: key === 'lab_name' ? 18 : 12,
                  weight: key === 'lab_name' ? 'bold' as const : 'normal' as const,
                  color: '#1e293b',
                };
                return (
                  <div key={key} className="rounded-md border border-slate-200 p-2">
                    <p className="mb-1 text-[10px] font-semibold text-slate-600">{label}</p>
                    <div className="flex items-center gap-2">
                      <input
                        aria-label={`${label} font size`}
                        type="number"
                        min="8"
                        max="32"
                        value={fontStyle.size}
                        onChange={(event) => setSettings((current) => current ? {
                          ...current,
                          font_styles: { ...current.font_styles, [key]: { ...fontStyle, size: Number(event.target.value) } },
                        } : current)}
                        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <select
                        aria-label={`${label} font weight`}
                        value={fontStyle.weight}
                        onChange={(event) => setSettings((current) => current ? {
                          ...current,
                          font_styles: { ...current.font_styles, [key]: { ...fontStyle, weight: event.target.value as 'normal' | 'bold' } },
                        } : current)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="normal">Regular</option>
                        <option value="bold">Bold</option>
                      </select>
                      <input
                        aria-label={`${label} font color`}
                        type="color"
                        value={fontStyle.color}
                        onChange={(event) => setSettings((current) => current ? {
                          ...current,
                          font_styles: { ...current.font_styles, [key]: { ...fontStyle, color: event.target.value } },
                        } : current)}
                        className="h-7 w-9"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {settingsOpen && pageSetup && settings && (
        <section className="print:hidden rounded-xl border border-slate-300 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Report Page Setup</h2>
              <p className="text-xs text-slate-500">Edits update the report preview immediately and save automatically.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500" role="status">
                {settingsSaveStatus === 'saving' ? 'Saving…' : settingsSaveStatus === 'saved' ? 'All changes saved' : settingsSaveStatus === 'error' ? 'Save failed — changes remain on screen' : ''}
              </span>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close report settings" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-2">
            <div className="space-y-4">
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-700">Lab Profile</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-[11px] font-semibold text-slate-600">Lab Name
                    <input value={settings.lab_name} onChange={(event) => setSettings({ ...settings, lab_name: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  </label>
                  <label className="text-[11px] font-semibold text-slate-600">Registration No.
                    <input value={settings.registration_no} onChange={(event) => setSettings({ ...settings, registration_no: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  </label>
                  <label className="text-[11px] font-semibold text-slate-600">Email Address
                    <input value={settings.email} onChange={(event) => setSettings({ ...settings, email: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  </label>
                  <label className="text-[11px] font-semibold text-slate-600">Contact No.
                    <input value={settings.phone} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  </label>
                  <label className="text-[11px] font-semibold text-slate-600 sm:col-span-2">Address
                    <textarea rows={2} value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  </label>
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-[11px] font-semibold text-slate-600">Report Header Image</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {settings.logo_path && <img src={settings.logo_path} alt="Current report header" className="h-12 max-w-48 border border-slate-200 object-contain" />}
                      <label className="cursor-pointer rounded border border-slate-300 px-2 py-1.5 text-[11px] font-semibold text-slate-600">
                        {uploadingTemplate ? 'Uploading…' : settings.logo_path ? 'Change image' : 'Upload image'}
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingTemplate} onChange={(event) => handleHeaderImageUpload(event.target.files?.[0])} />
                      </label>
                      {settings.logo_path && <button type="button" onClick={removeHeaderImage} className="text-[11px] font-semibold text-rose-600">Remove</button>}
                    </div>
                    {headerImageError && <p role="alert" className="mt-1 text-xs text-rose-600">{headerImageError}</p>}
                  </div>
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-700">Page Margins (inches)</legend>
                <MarginInputs
                  title="Report"
                  value={pageSetup.report_margin}
                  onChange={(report_margin) => setPageSetup({ ...pageSetup, report_margin })}
                />
                <MarginInputs
                  title="Receipt"
                  value={pageSetup.receipt_margin}
                  onChange={(receipt_margin) => setPageSetup({ ...pageSetup, receipt_margin })}
                />
                <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
                  Line Space (inches)
                  <input type="number" min="0" max="1" step="0.01" value={pageSetup.line_space} onChange={(event) => setPageSetup({ ...pageSetup, line_space: Number(event.target.value) })} className="w-20 rounded border border-slate-300 px-2 py-1" />
                </label>
              </fieldset>
            </div>

            <div className="space-y-4">
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-700">Test Report Print Setting</legend>
                <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                  {REPORT_PRINT_OPTIONS.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-[11px] text-slate-700">
                      <input type="checkbox" checked={Boolean(printFlags[key])} onChange={(event) => updatePrintFlag(key, event.target.checked)} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-700">Show / Hide Signatory Info</legend>
                <div className="space-y-3">
                  {[
                    { number: 1, name: settings.signatory_name, degree: settings.signatory_degree, title: settings.signatory_title },
                    { number: 2, name: settings.signatory2_name, degree: settings.signatory2_degree, title: settings.signatory2_title },
                    { number: 3, name: settings.signatory3_name, degree: settings.signatory3_degree, title: settings.signatory3_title },
                  ].map((signatory) => (
                    <div key={signatory.number} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-slate-100 pb-2 last:border-0">
                      <label className="text-[11px] text-slate-600">Signatory {signatory.number}
                        <input
                          value={signatory.name}
                          onChange={(event) => setSettings({
                            ...settings,
                            [signatory.number === 1 ? 'signatory_name' : `signatory${signatory.number}_name`]: event.target.value,
                          })}
                          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-slate-600">
                        <input type="checkbox" checked={Boolean(printFlags[`signatory_${signatory.number}_signature`])} onChange={(event) => updatePrintFlag(`signatory_${signatory.number}_signature`, event.target.checked)} />
                        Signature
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-slate-600">
                        <input type="checkbox" checked={Boolean(printFlags[`signatory_${signatory.number}_name`])} onChange={(event) => updatePrintFlag(`signatory_${signatory.number}_name`, event.target.checked)} />
                        Name
                      </label>
                      <div className="col-span-3 grid grid-cols-2 gap-2">
                        <input aria-label={`Signatory ${signatory.number} degree`} value={signatory.degree} onChange={(event) => setSettings({ ...settings, [signatory.number === 1 ? 'signatory_degree' : `signatory${signatory.number}_degree`]: event.target.value })} placeholder="Degree" className="rounded border border-slate-300 px-2 py-1.5 text-[11px]" />
                        <input aria-label={`Signatory ${signatory.number} title`} value={signatory.title} onChange={(event) => setSettings({ ...settings, [signatory.number === 1 ? 'signatory_title' : `signatory${signatory.number}_title`]: event.target.value })} placeholder="Title" className="rounded border border-slate-300 px-2 py-1.5 text-[11px]" />
                      </div>
                      <div className="col-span-3 flex flex-wrap items-center gap-2">
                        {(() => {
                          const signaturePath = signatory.number === 1
                            ? settings.signatory_signature_path
                            : signatory.number === 2
                              ? settings.signatory2_signature_path
                              : settings.signatory3_signature_path;
                          return (
                            <>
                              {signaturePath && <img src={signaturePath} alt={`Signatory ${signatory.number} signature`} className="h-10 max-w-32 border border-slate-200 object-contain" />}
                              <label className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                {uploadingTemplate ? 'Uploading…' : signaturePath ? 'Change signature' : 'Add signature'}
                                <input type="file" accept="image/*" className="hidden" disabled={uploadingTemplate} onChange={(event) => handleSignatureUpload(signatory.number, event.target.files?.[0])} />
                              </label>
                              {signaturePath && <button type="button" onClick={() => removeSignature(signatory.number)} className="text-[10px] font-semibold text-rose-600">Remove</button>}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
                {signatureUploadError && <p className="mt-2 text-xs text-rose-600">{signatureUploadError}</p>}
              </fieldset>

              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-700">Footer Note</legend>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={pageSetup.footer_note_enabled} onChange={(event) => setPageSetup({ ...pageSetup, footer_note_enabled: event.target.checked })} />
                  Print footer note
                </label>
                <textarea rows={2} value={pageSetup.footer_note_text} onChange={(event) => setPageSetup({ ...pageSetup, footer_note_text: event.target.value })} className="mt-2 w-full rounded border border-slate-300 px-2 py-1.5 text-xs" />
              </fieldset>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 px-5 py-3">
            <Link to="/report-settings?tab=Report%20Header" className="text-xs font-semibold text-blue-700 hover:underline">More report stationery options</Link>
          </div>
        </section>
      )}

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

          {orderDetail && orderDetail.order_tests.length > 1 && (
            <div className="md:col-span-3 lg:col-span-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
              <p className="mb-2 text-[11px] font-bold text-indigo-900">Page layout for this print</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {orderDetail.order_tests.map((test) => (
                  <label key={test.id} className="flex items-center justify-between gap-3 text-xs text-indigo-950">
                    <span>{test.test_group_name}</span>
                    <select
                      value={pageBreaks[test.id] ? 'new-page' : 'same-page'}
                      onChange={(event) => handlePageBreakChange(test.id, event.target.value === 'new-page')}
                      className="rounded-md border border-indigo-200 bg-white px-2 py-1.5 text-xs text-indigo-950"
                    >
                      <option value="same-page">Continue on same page</option>
                      <option value="new-page">Start on new page</option>
                    </select>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-indigo-700">Choose each group’s page placement before printing. These are report-print settings, not patient-entry or Test Master settings. Choices save per order on this device.</p>
              {layoutError && <p role="alert" className="mt-1 text-[10px] font-semibold text-rose-700">{layoutError}</p>}
            </div>
          )}

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
        <button type="button" disabled={viewerPage <= 1} onClick={() => {
          const page = Math.max(1, viewerPage - 1);
          setViewerPage(page);
          document.getElementById(`report-page-${page}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }} className="px-2 py-1 text-xs border rounded disabled:opacity-40">Previous</button>
        <span className="text-xs text-slate-600">Page {viewerPage} of {Math.max(reportPages.length, 1)}</span>
        {layoutError && <span role="alert" className="text-xs font-semibold text-rose-700">{layoutError}</span>}
        <button type="button" disabled={viewerPage >= reportPages.length} onClick={() => {
          const page = Math.min(reportPages.length, viewerPage + 1);
          setViewerPage(page);
          document.getElementById(`report-page-${page}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }} className="px-2 py-1 text-xs border rounded disabled:opacity-40">Next</button>
        <button type="button" onClick={() => setViewerZoom((zoom) => Math.max(60, zoom - 10))} className="px-2 py-1 text-xs border rounded">−</button>
        <span className="text-xs font-semibold w-12 text-center">{viewerZoom}%</span>
        <button type="button" onClick={() => setViewerZoom((zoom) => Math.min(150, zoom + 10))} className="px-2 py-1 text-xs border rounded">+</button>
        <button type="button" onClick={() => setViewerZoom(100)} className="px-2 py-1 text-xs border rounded">Page width</button>
        <input value={viewerSearch} onChange={(e) => setViewerSearch(e.target.value)} placeholder="Find in report" className="ml-auto w-36 px-2 py-1 text-xs border rounded" />
        <button type="button" onClick={() => setSearchMessage(viewerSearch && document.getElementById('report-print-pages')?.innerText.toLowerCase().includes(viewerSearch.toLowerCase()) ? 'Found' : 'Not found')} className="px-2 py-1 text-xs border rounded">Find</button>
        {searchMessage && <span className="text-xs text-slate-500">{searchMessage}</span>}
        <button type="button" onClick={handlePrint} className="px-2 py-1 text-xs font-semibold text-blue-700 border border-blue-200 rounded">Print / Export</button>
      </div>

      <PagedReportPreview
        pages={reportPages}
        orderDetail={orderDetail}
        settings={settings}
        pageSetup={pageSetup}
        printFlags={printFlags}
        stationeryMode={stationeryMode}
        fontSizeScale={fontSizeScale}
        topMarginInch={topMarginInch}
        bottomMarginInch={bottomMarginInch}
        zoom={viewerZoom}
      />

      {/* Legacy continuous preview retained hidden while compatibility selectors are migrated. */}
      <div className="hidden">
        <div
          id="legacy-diagnostic-report-sheet"
          className="hidden"
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
            <div className="report-print-header border-b-2 border-slate-900 pb-2 mb-4">
              {settings?.logo_path ? (
                <img src={settings.logo_path} alt="Laboratory report header" className="block h-auto w-full object-contain object-center" />
              ) : (
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-700 text-white font-black text-xl flex items-center justify-center shadow-xs">P1</div>
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
              )}
            </div>
          ) : (
            <div className="report-print-header border-b border-dashed border-purple-300 pb-1 mb-3 text-center print:hidden">
              <span className="text-[10px] uppercase tracking-widest text-purple-700 font-bold bg-purple-50 px-3 py-0.5 rounded">
                --- Pre-Printed Letterhead Header Margin Reserved ({topMarginInch} in) ---
              </span>
            </div>
          )}

          {/* Section 2: Patient Demographic & Visit Box */}
          {orderDetail && (
            <div className="report-print-patient bg-slate-50/80 border border-slate-300 rounded-lg p-3 text-xs mb-4">
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
          <div className="space-y-6">
            {orderDetail?.order_tests.map((test, index) => (
              <section
                key={test.id}
                className={`space-y-2 ${index > 0 && pageBreaks[test.id] ? 'report-test-page-break' : ''}`}
                style={index > 0 && pageBreaks[test.id] ? {
                  breakBefore: 'page',
                  pageBreakBefore: 'always',
                  pageBreakInside: 'avoid',
                } : { pageBreakInside: 'avoid' }}
              >
                {index > 0 && pageBreaks[test.id] && (
                  <div className="report-page-break-preview" aria-label="This test group starts on a new printed page">
                    <span>New report page</span>
                  </div>
                )}
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
              </section>
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
          {!settings?.footer_image_path && showSignatures &&
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
            <div className="report-print-footer mt-4 pt-2 border-t border-slate-200 text-[9px] text-slate-400 text-center leading-tight">
              {settings?.footer_image_path && (
                <img
                  src={settings.footer_image_path}
                  alt="Laboratory footer"
                  className="mx-auto mb-2 block h-auto w-full object-contain object-center"
                />
              )}
              {!settings?.footer_image_path && (settings?.footer_note ||
                'This report is authorized electronically and does not require a physical handwritten signature. Pathological findings are for clinical correlation only.')}
            </div>
          ) : (
            <div className="report-print-footer border-t border-dashed border-purple-300 pt-1 mt-3 text-center print:hidden">
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

interface PagedReportPreviewProps {
  pages: OrderDetail['order_tests'][];
  orderDetail: OrderDetail | null;
  settings: ReportSettings | null;
  pageSetup: PageSetup | null;
  printFlags: Record<string, boolean>;
  stationeryMode: 'plain' | 'preprinted';
  fontSizeScale: 'compact' | 'standard' | 'large';
  topMarginInch: number;
  bottomMarginInch: number;
  zoom: number;
}

function PagedReportPreview({
  pages,
  orderDetail,
  settings,
  pageSetup,
  printFlags,
  stationeryMode,
  fontSizeScale,
  topMarginInch,
  bottomMarginInch,
  zoom,
}: PagedReportPreviewProps) {
  if (!orderDetail) return null;

  return (
    <div id="report-print-pages" className="report-print-pages">
      {pages.map((tests, index) => (
        <article
          id={`report-page-${index + 1}`}
          data-report-page={index + 1}
          key={tests[0]?.id ?? index}
          className="report-page bg-white text-slate-900 shadow-2xl"
          style={{
            zoom: (zoom / 100) * (fontSizeScale === 'compact' ? 0.9 : fontSizeScale === 'large' ? 1.1 : 1),
            padding: pageSetup
              ? `${pageSetup.report_margin.top}in ${pageSetup.report_margin.right}in ${pageSetup.report_margin.bottom}in ${pageSetup.report_margin.left}in`
              : undefined,
          }}
        >
          {stationeryMode === 'plain' ? (
            !printFlags.without_header_report && (
              <header className={`report-print-header mb-4 ${printFlags.header_line ? 'border-b border-slate-300 pb-2' : ''}`}>
                {printFlags.use_own_header_image && settings?.logo_path ? (
                  <img src={settings.logo_path} alt="Laboratory report header" className="block h-auto w-full object-contain object-center" />
                ) : (
                  <div className="flex items-start justify-between pb-2">
                    <div>
                      <h2 className="text-xl font-black uppercase" style={{ color: settings?.font_color.toLowerCase(), textAlign: settings?.lab_name_alignment.toLowerCase() === 'center' ? 'center' : settings?.lab_name_alignment.toLowerCase() === 'right' ? 'right' : 'left' }}>{settings?.lab_name || 'Laboratory'}</h2>
                      <p className="text-xs" style={{ textAlign: settings?.address_alignment.toLowerCase() === 'center' ? 'center' : settings?.address_alignment.toLowerCase() === 'right' ? 'right' : 'left' }}>{settings?.address} {settings?.phone && `| Tel: ${settings.phone}`}</p>
                      {printFlags.registration_number && settings?.registration_no && <p className="text-xs">Reg. No: {settings.registration_no}</p>}
                    </div>
                    {printFlags.qr_code && (
                      <div className="text-center">
                        {settings?.qr_code_path
                          ? <img src={settings.qr_code_path} alt="Report verification QR code" className="h-14 w-14" />
                          : <QrCode className="h-14 w-14" />}
                        <span className="block text-[9px] font-bold uppercase">Scan to Verify</span>
                      </div>
                    )}
                  </div>
                )}
              </header>
            )
          ) : (
            !printFlags.without_header_report && <div style={{ paddingTop: `${topMarginInch}in` }} />
          )}

          <section className="report-print-patient bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Patient Name:</span>
                <strong>{orderDetail.patient_name}</strong>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Age / Gender:</span>
                <strong>{orderDetail.age_years ?? '-'} Yrs / {orderDetail.gender || '-'}</strong>
              </div>
              {printFlags.patient_id && <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Patient ID:</span>
                <strong>{orderDetail.lab_id}</strong>
              </div>}
              {printFlags.uhid && <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">UHID / MRN:</span>
                <strong>{orderDetail.mrn || '-'}</strong>
              </div>}
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Referring Doctor:</span>
                <strong>{orderDetail.doctor_name || '-'}</strong>
              </div>
              {printFlags.collection_centre && <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Collection Centre:</span>
                <strong>{orderDetail.centre_name || '-'}</strong>
              </div>}
              {printFlags.sample_date && <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Collection Date:</span>
                <strong>{formatReportDate(orderDetail.collection_at || orderDetail.created_at)}</strong>
              </div>}
              {printFlags.sample_time && <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Collection Time:</span>
                <strong>{formatReportDate(orderDetail.collection_at || orderDetail.created_at, true)}</strong>
              </div>}
              {printFlags.received_date && <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Received Date:</span>
                <strong>{formatReportDate(orderDetail.received_at)}</strong>
              </div>}
              {printFlags.received_time && <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Received Time:</span>
                <strong>{formatReportDate(orderDetail.received_at, true)}</strong>
              </div>}
              {printFlags.reporting_date && <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Reporting Date:</span>
                <strong>{formatReportDate(orderDetail.reporting_at || new Date().toISOString())}</strong>
              </div>}
              {printFlags.reporting_time && <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Reporting Time:</span>
                <strong>{formatReportDate(orderDetail.reporting_at || new Date().toISOString(), true)}</strong>
              </div>}
              {printFlags.barcode && <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Specimen Accession:</span>
                <strong>{orderDetail.specimen_id || '-'}</strong>
              </div>}
            </div>
            {printFlags.barcode && (
              <div className="mt-2 border-t border-slate-200 pt-2 flex items-center justify-between text-[10px]">
                <span className="font-mono font-black">*{orderDetail.specimen_id}*</span>
                <span>Priority: <strong className="uppercase">{orderDetail.priority}</strong> | Drawn by: {orderDetail.phlebotomist || '-'}</span>
              </div>
            )}
            {printFlags.investigations_note && orderDetail.remarks && <p className="mt-2 border-t border-slate-200 pt-2"><strong>Investigations Note:</strong> {orderDetail.remarks}</p>}
          </section>

          <main className="report-page-content flex-1 flex flex-col" style={{ gap: `${pageSetup?.line_space ?? 0.05}in` }}>
            {tests.map((test) => (
              <section key={test.id} className="space-y-2 break-inside-avoid">
                <div className="border-b-2 border-slate-800 pb-1 flex items-baseline justify-between">
                  <h3 className="font-black text-sm uppercase tracking-wide" style={{ textAlign: settings?.test_title_alignment.toLowerCase() === 'center' ? 'center' : settings?.test_title_alignment.toLowerCase() === 'right' ? 'right' : 'left', color: settings?.font_color.toLowerCase() }}>{test.test_group_name}</h3>
                  <span className="text-[11px] font-semibold text-slate-500">Dept: {test.department} | Method: {test.method}</span>
                </div>
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
                    {test.parameters.map((parameter) => {
                      if (parameter.is_bold_header) {
                        return (
                          <tr key={parameter.id} className="bg-slate-100 font-bold text-slate-900">
                            <td colSpan={5} className="py-1 px-1 text-[11px] uppercase tracking-wider">{parameter.name}</td>
                          </tr>
                        );
                      }

                      const range = orderDetail.gender === 'Female' ? parameter.normal_range_female : parameter.normal_range_male;
                      const result = parameter.value ? parseFloat(parameter.value.replace(/[^0-9.]/g, '')) : NaN;
                      const bounds = range?.split('-').map((part) => parseFloat(part.trim())) ?? [];
                      const isLow = bounds.length === 2 && !Number.isNaN(result) && !Number.isNaN(bounds[0]) && result < bounds[0];
                      const isHigh = bounds.length === 2 && !Number.isNaN(result) && !Number.isNaN(bounds[1]) && result > bounds[1];
                      return (
                        <tr key={parameter.id} className={isLow || isHigh ? 'bg-amber-50/50' : ''}>
                          <td className="py-1.5 text-slate-800 font-medium">{parameter.name}</td>
                          <td className="py-1.5 font-mono font-semibold" style={{ color: settings?.abnormal_red_enabled && (isLow || isHigh) ? '#dc2626' : undefined }}>{parameter.value ?? '---'}</td>
                          <td className="py-1.5">{printFlags.indicate_high_low ? (isHigh ? 'HIGH (H)' : isLow ? 'LOW (L)' : '') : ''}</td>
                          <td className="py-1.5 text-slate-500">{parameter.unit || '-'}</td>
                          <td className="py-1.5 text-right font-mono text-[11px] text-slate-600">{range || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </main>

          {index === pages.length - 1 && printFlags.print_end_of_report && (
            <div className="text-center my-4">
              <span className={`text-[10px] font-bold uppercase tracking-widest text-slate-400 px-6 py-0.5 ${printFlags.end_of_report_line ? 'border-t border-b border-slate-200' : ''}`}>
                *** END OF EXAMINATION REPORT ***
              </span>
            </div>
          )}

          {stationeryMode === 'plain' ? (
            <footer className={`report-print-footer mt-4 ${printFlags.footer_line ? 'border-t border-slate-300 pt-3' : ''}`}>
              <div className="mb-4 grid grid-cols-3 gap-4 text-center text-[10px]">
                {[
                  { number: 1, name: settings?.signatory_name, degree: settings?.signatory_degree, title: settings?.signatory_title, signature: settings?.signatory_signature_path },
                  { number: 2, name: settings?.signatory2_name, degree: settings?.signatory2_degree, title: settings?.signatory2_title, signature: settings?.signatory2_signature_path },
                  { number: 3, name: settings?.signatory3_name, degree: settings?.signatory3_degree, title: settings?.signatory3_title, signature: settings?.signatory3_signature_path },
                ].filter((slot) => printFlags[`signatory_${slot.number}_name`] || printFlags[`signatory_${slot.number}_signature`]).map((slot) => (
                  <div key={slot.number} className="px-1">
                    {printFlags[`signatory_${slot.number}_signature`] && slot.signature && (
                      <img src={slot.signature} alt={`Signatory ${slot.number} signature`} className="mx-auto h-10 max-w-32 object-contain" />
                    )}
                    {printFlags[`signatory_${slot.number}_signature`] && !slot.signature && (
                      <div className="h-10" aria-label={`Signatory ${slot.number} signature not uploaded`} />
                    )}
                    {printFlags[`signatory_${slot.number}_name`] && (
                      <div className="border-t border-slate-400 pt-1">
                        <strong>{slot.name}</strong>{slot.degree ? `, ${slot.degree}` : ''}
                        {slot.title && <p>{slot.title}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {settings?.footer_image_path && (
                <img src={settings.footer_image_path} alt="Laboratory footer" className="block h-auto w-full object-contain object-center" />
              )}
              {pageSetup?.footer_note_enabled && pageSetup.footer_note_text && (
                <p className="pt-2 text-center text-[9px] text-slate-500">{pageSetup.footer_note_text}</p>
              )}
              {printFlags.footer_date_time && (
                <p className="mt-1 text-right text-[9px] text-slate-500">{new Date().toLocaleString()}</p>
              )}
              {printFlags.page_number && <p className="mt-1 text-right text-[9px] text-slate-500">Page {index + 1} of {pages.length}</p>}
            </footer>
          ) : (
            <div style={{ height: `${bottomMarginInch}in` }} />
          )}
        </article>
      ))}
    </div>
  );
}
