import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { pageSetupDb, patientsDb, reportSettingsDb, storageDb, toolsDb } from '../lib/db';
import { Settings2, KeyRound, Mail, FolderOutput, DatabaseBackup, Undo2 } from 'lucide-react';

type Align = 'Left' | 'Center' | 'Right';

interface Settings {
  lab_name: string;
  address: string;
  phone: string;
  email: string;
  working_hours: string;
  registration_no: string;
  signatory_name: string;
  signatory_degree: string;
  signatory_title: string;
  signatory2_name: string;
  signatory2_degree: string;
  signatory2_title: string;
  signatory3_name: string;
  signatory3_degree: string;
  signatory3_title: string;
  footer_note: string;
  accent_color_hex: string;
  logo_path: string | null;
  qr_code_path: string | null;
  footer_image_path: string | null;
  lab_name_alignment: Align;
  address_alignment: Align;
  test_title_alignment: Align;
  font_color: string;
  abnormal_red_enabled: boolean;
  font_styles: Record<string, { size: number; weight: 'normal' | 'bold'; color: string }>;
}

interface PageSetup {
  report_margin: { top: number; bottom: number; left: number; right: number };
  receipt_margin: { top: number; bottom: number; left: number; right: number };
  print_flags: Record<string, boolean>;
  footer_note_enabled: boolean;
  footer_note_text: string;
}

interface ToolsInfo {
  email_address: string;
  email_domain: string;
  email_password: string;
  pdf_export_path: string;
}

const SUB_TABS = ['Report Header', 'Fonts Style', 'Page Setup', 'Tools'] as const;
const LEGACY_PRINT_FLAGS = [
  'header',
  'patient_id',
  'sample_date',
  'sample_time',
  'received_date',
  'received_time',
  'reporting_date',
  'registration_number',
  'collection_centre',
  'page_number',
  'barcode',
  'qr_code',
  'uhid',
  'header_line',
  'footer_line',
  'report_end_line',
  'investigations_note',
] as const;

// Combines Patho One's "Report Header" upload screen, "Fonts Style" screen,
// "Report Page Setup" screen, and the relevant half of the "Tools" menu
// (Email Info, Exported PDF Files Location, Backup, Recover Deleted Patient
// Entry — Change Password is its own page, linked from the Tools tab).
export default function ReportSettings() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const requestedTab = searchParams.get('tab');
  const pathTab: Record<string, (typeof SUB_TABS)[number]> = {
    '/page-setup': 'Page Setup',
    '/email-settings': 'Tools',
    '/pdf-export': 'Tools',
    '/backup': 'Tools',
    '/recover-deleted-patients': 'Tools',
  };
  const initialTab = pathTab[location.pathname] || (SUB_TABS.includes(requestedTab as (typeof SUB_TABS)[number])
    ? requestedTab as (typeof SUB_TABS)[number]
    : 'Report Header');
  const [subTab, setSubTab] = useState<(typeof SUB_TABS)[number]>(initialTab);
  const [form, setForm] = useState<Settings | null>(null);
  const [pageSetup, setPageSetup] = useState<PageSetup | null>(null);
  const [tools, setTools] = useState<ToolsInfo | null>(null);
  const [deletedPatients, setDeletedPatients] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([reportSettingsDb.get(), pageSetupDb.get(), toolsDb.getSettings(), patientsDb.listDeleted()]).then(([settings, setup, toolSettings, deleted]) => {
      setForm({
        ...(settings as Settings),
        font_styles: (settings as Settings).font_styles || {},
      });
      setPageSetup({
        ...setup,
        print_flags: Object.fromEntries(
          LEGACY_PRINT_FLAGS.map((flag) => [flag, setup.print_flags?.[flag] ?? true])
        ),
      });
      setTools({ ...toolSettings, email_password: '' });
      setDeletedPatients(deleted);
    });
  }, []);

  async function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function saveSettings() {
    if (!form) return;
    await reportSettingsDb.update(form);
    flashSaved();
  }
  async function savePageSetup() {
    if (!pageSetup) return;
    await pageSetupDb.update(pageSetup);
    flashSaved();
  }
  async function saveTools() {
    if (!tools) return;
    await toolsDb.updateSettings({ email_address: tools.email_address, email_domain: tools.email_domain, pdf_export_path: tools.pdf_export_path });
    flashSaved();
  }

  async function handleUpload(kind: 'logo' | 'qr-code' | 'footer-image', e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !form) return;
    setUploading(kind);
    try {
      const folder = kind === 'footer-image' ? 'footer' : kind;
      const publicUrl = await storageDb.uploadPublicImage(file, folder as 'logo' | 'qr-code' | 'footer');
      const field = kind === 'logo' ? 'logo_path' : kind === 'qr-code' ? 'qr_code_path' : 'footer_image_path';
      const updated = await reportSettingsDb.update({ [field]: publicUrl });
      setForm(updated as Settings);
    } finally {
      setUploading(null);
    }
  }
  async function handleRemove(kind: 'logo' | 'qr-code' | 'footer-image') {
    if (!form) return;
    const field = kind === 'logo' ? 'logo_path' : kind === 'qr-code' ? 'qr_code_path' : 'footer_image_path';
    setForm(await reportSettingsDb.update({ [field]: null }) as Settings);
  }

  async function runBackup() {
    const backup = await toolsDb.backup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `lis-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  async function recoverPatient(id: string) {
    await patientsDb.recover(id);
    setDeletedPatients(await patientsDb.listDeleted());
  }

  if (!form || !pageSetup || !tools) return <div className="text-sm text-slate-400">Loading...</div>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="w-5 h-5 text-blue-600" />
        <h1 className="text-lg font-bold text-slate-900">Report Settings & Tools</h1>
        {saved && <span className="text-xs font-semibold text-emerald-600 ml-2">Saved ✓</span>}
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {SUB_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px ${
              subTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {subTab === 'Report Header' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Lab Name</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={form.lab_name} onChange={(e) => setForm({ ...form, lab_name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Registration No.</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={form.registration_no} onChange={(e) => setForm({ ...form, registration_no: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">Address</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Phone</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">E-mail</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Working Hours</label>
              <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={form.working_hours} onChange={(e) => setForm({ ...form, working_hours: e.target.value })} />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase">Report Signatories (up to 3 — leave blank to skip)</div>
            {([1, 2, 3] as const).map((n) => {
              const nameKey = (n === 1 ? 'signatory_name' : `signatory${n}_name`) as keyof Settings;
              const degreeKey = (n === 1 ? 'signatory_degree' : `signatory${n}_degree`) as keyof Settings;
              const titleKey = (n === 1 ? 'signatory_title' : `signatory${n}_title`) as keyof Settings;
              return (
                <div key={n} className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Signatory {n} Name</label>
                    <input
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                      value={form[nameKey] as string}
                      onChange={(e) => setForm({ ...form, [nameKey]: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Degree/Qualification</label>
                    <input
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                      value={form[degreeKey] as string}
                      onChange={(e) => setForm({ ...form, [degreeKey]: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Title / Designation</label>
                    <input
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
                      value={form[titleKey] as string}
                      onChange={(e) => setForm({ ...form, [titleKey]: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <UploadSlot
              label="Lab Header Image"
              path={form.logo_path}
              uploading={uploading === 'logo'}
              onUpload={(e) => handleUpload('logo', e)}
              onRemove={() => handleRemove('logo')}
            />
            <UploadSlot
              label="Lab Footer Image"
              path={form.footer_image_path}
              uploading={uploading === 'footer-image'}
              onUpload={(e) => handleUpload('footer-image', e)}
              onRemove={() => handleRemove('footer-image')}
            />
            <UploadSlot
              label="QR Code"
              path={form.qr_code_path}
              uploading={uploading === 'qr-code'}
              onUpload={(e) => handleUpload('qr-code', e)}
              onRemove={() => handleRemove('qr-code')}
            />
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button onClick={saveSettings} className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white">
              Apply
            </button>
          </div>
        </div>
      )}

      {subTab === 'Fonts Style' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-900">Report font controls</h2>
            <p className="text-xs text-slate-500 mt-1">These controls apply independently to each report section.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['lab_name', 'Lab name'],
              ['address', 'Address'],
              ['test_title', 'Test title'],
              ['test_name', 'Test name'],
              ['result', 'Result'],
              ['unit', 'Unit'],
              ['normal_values', 'Normal values'],
            ].map(([key, label]) => {
              const value = form.font_styles[key] || { size: 12, weight: 'normal' as const, color: '#1e293b' };
              return (
                <div key={key} className="border border-slate-200 rounded-lg p-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-2">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="8" max="32" value={value.size}
                      onChange={(e) => setForm({ ...form, font_styles: { ...form.font_styles, [key]: { ...value, size: Number(e.target.value) } } })}
                      className="w-20 border border-slate-300 rounded px-2 py-1.5 text-sm"
                    />
                    <select
                      value={value.weight}
                      onChange={(e) => setForm({ ...form, font_styles: { ...form.font_styles, [key]: { ...value, weight: e.target.value as 'normal' | 'bold' } } })}
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                    >
                      <option value="normal">Regular</option>
                      <option value="bold">Bold</option>
                    </select>
                    <input
                      type="color" value={value.color}
                      onChange={(e) => setForm({ ...form, font_styles: { ...form.font_styles, [key]: { ...value, color: e.target.value } } })}
                      className="h-8 w-10"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={saveSettings} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">Save font styles</button>
        </div>
      )}

      {subTab === 'Fonts Style' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <AlignPicker label="Lab Name Alignment" value={form.lab_name_alignment} onChange={(v) => setForm({ ...form, lab_name_alignment: v })} />
            <AlignPicker label="Address Alignment" value={form.address_alignment} onChange={(v) => setForm({ ...form, address_alignment: v })} />
            <AlignPicker label="Test Title Alignment" value={form.test_title_alignment} onChange={(v) => setForm({ ...form, test_title_alignment: v })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Colors</label>
            <select className="block border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={form.font_color} onChange={(e) => setForm({ ...form, font_color: e.target.value })}>
              <option>Green</option>
              <option>Blue</option>
              <option>Black</option>
              <option>Maroon</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.abnormal_red_enabled} onChange={(e) => setForm({ ...form, abnormal_red_enabled: e.target.checked })} />
            Abnormal Red Color
          </label>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <p className="text-xs text-slate-500 mb-2">Live Preview</p>
            <div style={{ textAlign: form.lab_name_alignment.toLowerCase() as any, color: form.font_color.toLowerCase() }} className="font-bold text-base">
              {form.lab_name}
            </div>
            <div style={{ textAlign: form.address_alignment.toLowerCase() as any }} className="text-xs text-slate-600 mb-3">
              {form.address}
            </div>
            <div style={{ textAlign: form.test_title_alignment.toLowerCase() as any }} className="font-semibold uppercase text-sm mb-2">
              Complete Blood Count (CBC)
            </div>
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left">Test Name</th>
                  <th className="text-left">Result</th>
                  <th className="text-left">Unit</th>
                  <th className="text-left">Normal Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Hemoglobin</td>
                  <td style={{ color: form.abnormal_red_enabled ? '#dc2626' : undefined }}>18.2</td>
                  <td>g/dL</td>
                  <td>13.0 - 17.0</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-3 border-t border-slate-100">
            <button onClick={() => setForm({ ...form, lab_name_alignment: 'Left', address_alignment: 'Left', test_title_alignment: 'Center', font_color: 'Green', abnormal_red_enabled: true })} className="text-xs font-semibold text-blue-600">
              Reset Default Settings
            </button>
            <button onClick={saveSettings} className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white">
              Apply
            </button>
          </div>
        </div>
      )}

      {subTab === 'Page Setup' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-6">
            <MarginBlock title="Report's Margin" margin={pageSetup.report_margin} onChange={(m) => setPageSetup({ ...pageSetup, report_margin: m })} />
            <MarginBlock title="Receipt's Margin" margin={pageSetup.receipt_margin} onChange={(m) => setPageSetup({ ...pageSetup, receipt_margin: m })} />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">Test Report Print Setting</label>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              {LEGACY_PRINT_FLAGS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={pageSetup.print_flags[key]}
                    onChange={(e) => setPageSetup({ ...pageSetup, print_flags: { ...pageSetup.print_flags, [key]: e.target.checked } })}
                  />
                  {key.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700 mb-1">
              <input type="checkbox" checked={pageSetup.footer_note_enabled} onChange={(e) => setPageSetup({ ...pageSetup, footer_note_enabled: e.target.checked })} />
              Footer Note
            </label>
            <textarea
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={pageSetup.footer_note_text}
              onChange={(e) => setPageSetup({ ...pageSetup, footer_note_text: e.target.value })}
            />
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button onClick={savePageSetup} className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white">
              Apply
            </button>
          </div>
        </div>
      )}

      {subTab === 'Tools' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap gap-2 mb-4">
              <Link to="/email-settings" className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700">E-Mail Information screen</Link>
              <Link to="/pdf-export" className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700">PDF Export screen</Link>
              <Link to="/backup" className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700">Backup screen</Link>
              <Link to="/recover-deleted-patients" className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700">Recovery screen</Link>
            </div>
            <Link to="/change-password" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
              <KeyRound className="w-4 h-4" /> Change Password
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-800">
              <Mail className="w-4 h-4 text-blue-600" /> E-Mail Information
            </div>
            <div className="flex gap-2 items-center mb-2">
              <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1" value={tools.email_address} onChange={(e) => setTools({ ...tools, email_address: e.target.value })} placeholder="username" />
              <span className="text-sm text-slate-500">@</span>
              <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={tools.email_domain} onChange={(e) => setTools({ ...tools, email_domain: e.target.value })}>
                <option>gmail.com</option>
                <option>outlook.com</option>
                <option>yahoo.com</option>
              </select>
            </div>
            <input
              type="password"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full mb-3"
              placeholder="App Password"
              value={tools.email_password}
              onChange={(e) => setTools({ ...tools, email_password: e.target.value })}
            />
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-800">
              <FolderOutput className="w-4 h-4 text-blue-600" /> Exported PDF Files Location
            </div>
            <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" value={tools.pdf_export_path} onChange={(e) => setTools({ ...tools, pdf_export_path: e.target.value })} />
            <div className="flex justify-end pt-3">
              <button onClick={saveTools} className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white">
                Apply
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <button onClick={runBackup} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <DatabaseBackup className="w-4 h-4 text-blue-600" /> Backup Now
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-red-700">
              <Undo2 className="w-4 h-4" /> Recover Deleted Patient Entry
            </div>
            {deletedPatients.length === 0 ? (
              <p className="text-xs text-slate-400">No deleted patient entries.</p>
            ) : (
              <ul className="space-y-2">
                {deletedPatients.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span>
                      {p.full_name} <span className="text-xs text-slate-400">({p.mrn})</span>
                    </span>
                    <button onClick={() => recoverPatient(p.id)} className="text-xs font-semibold text-blue-600">
                      Recover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadSlot({
  label,
  path,
  uploading,
  onUpload,
  onRemove,
}: {
  label: string;
  path: string | null;
  uploading: boolean;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">{label}</label>
      {path && (
        <div className="flex items-center gap-2 mb-2">
          <img src={path} alt={label} className="h-10 border border-slate-200 rounded" />
          <button type="button" onClick={onRemove} className="text-xs text-red-600">
            Remove
          </button>
        </div>
      )}
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUpload} disabled={uploading} className="text-xs" />
    </div>
  );
}

function AlignPicker({ label, value, onChange }: { label: string; value: Align; onChange: (v: Align) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
      <select className="block border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" value={value} onChange={(e) => onChange(e.target.value as Align)}>
        <option>Left</option>
        <option>Center</option>
        <option>Right</option>
      </select>
    </div>
  );
}

function MarginBlock({
  title,
  margin,
  onChange,
}: {
  title: string;
  margin: { top: number; bottom: number; left: number; right: number };
  onChange: (m: { top: number; bottom: number; left: number; right: number }) => void;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-3">
        {(['top', 'bottom', 'left', 'right'] as const).map((k) => (
          <div key={k}>
            <label className="text-[11px] text-slate-500 capitalize">{k}</label>
            <input
              type="number"
              step="0.01"
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
              value={margin[k]}
              onChange={(e) => onChange({ ...margin, [k]: Number(e.target.value) })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
