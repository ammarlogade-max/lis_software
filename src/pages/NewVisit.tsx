import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientsDb, doctorsDb, centresDb, testGroupsDb, packagesDb, branchesDb, ordersDb, reportSettingsDb } from '../lib/db';
import { supabase } from '../lib/supabaseClient';
import {
  CheckCircle2,
  Search,
  PackageCheck,
  CreditCard,
  Banknote,
  Smartphone,
  Tag,
  Receipt,
  Printer,
  ChevronRight,
  UserPlus,
  RotateCcw,
  Plus,
  Phone,
  User,
  X,
  Sparkles,
} from 'lucide-react';

type Patient = {
  id: string;
  full_name: string;
  mrn: string | null;
  phone: string | null;
  gender: string;
  age_years: number | null;
  title?: string;
  email?: string | null;
  address?: string | null;
  patient_type?: string;
};
type Doctor = { id: string; salutation: string; name: string };
type Centre = { id: string; name: string };
type TestGroup = { id: string; display_name: string; rate: number };
type PackageItem = { id: string; name: string; fee: number; test_group_ids: string[] };
type Branch = { id: string; name: string };

function formatForDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoOrNull(value: string): string | null {
  if (!value.trim()) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export default function NewVisit() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [groups, setGroups] = useState<TestGroup[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Direct Patient Details (Created directly on this page)
  const [patientTitle, setPatientTitle] = useState('Mr.');
  const [patientType, setPatientType] = useState('Regular');
  const [patientFullName, setPatientFullName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientAgeUnit, setPatientAgeUnit] = useState<'Years' | 'Months' | 'Days'>('Years');
  const [patientGender, setPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [collectionAt, setCollectionAt] = useState(() => formatForDateTimeLocal(new Date()));
  const [receivedAt, setReceivedAt] = useState(() => formatForDateTimeLocal(new Date()));
  const [reportingAt, setReportingAt] = useState(() => formatForDateTimeLocal(new Date()));
  const [visitRemarks, setVisitRemarks] = useState('');
  const [fastingStatus, setFastingStatus] = useState('Unspecified');

  // Returning Patient Quick Lookup
  const [patientId, setPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedExistingPatient, setSelectedExistingPatient] = useState<Patient | null>(null);

  // Quick Doctor Addition
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorDegree, setNewDoctorDegree] = useState('');
  const [savingDoctor, setSavingDoctor] = useState(false);

  // Referral & Visit Setup
  const [doctorId, setDoctorId] = useState('');
  const [centreId, setCentreId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [paid, setPaid] = useState('0');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi' | 'net_banking'>('cash');
  const [priority, setPriority] = useState<'routine' | 'stat'>('routine');
  const [saving, setSaving] = useState(false);
  const [savedOrder, setSavedOrder] = useState<{ lab_id: string; id: string; due: number; patient_name?: string; paid?: number } | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPatientList, setShowPatientList] = useState(false);
  const [labName, setLabName] = useState('');

  useEffect(() => {
    patientsDb.list().then(setPatients).catch(console.error);
    doctorsDb.list().then(setDoctors).catch(console.error);
    centresDb.list().then(setCentres).catch(console.error);
    testGroupsDb.listActive().then((gs) => setGroups(gs as unknown as TestGroup[])).catch(console.error);
    packagesDb.list().then((ps) => setPackages(ps as unknown as PackageItem[])).catch(console.error);
    branchesDb.list().then(setBranches).catch(console.error);
    reportSettingsDb
      .get()
      .then((s) => setLabName(s.lab_name || ''))
      .catch(() => {});
  }, []);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return [];
    const q = patientSearch.toLowerCase();
    return patients
      .filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          (p.mrn && p.mrn.toLowerCase().includes(q)) ||
          (p.phone && p.phone.includes(q))
      )
      .slice(0, 6);
  }, [patients, patientSearch]);

  const filteredGroups = useMemo(() => {
    if (!testSearch.trim()) return groups;
    const q = testSearch.toLowerCase();
    return groups.filter((g) => g.display_name.toLowerCase().includes(q));
  }, [groups, testSearch]);

  const totalFees = useMemo(
    () => selectedTests.reduce((sum, id) => sum + (groups.find((g) => g.id === id)?.rate ?? 0), 0),
    [selectedTests, groups],
  );
  const discountAmount = (totalFees * Number(discountPercent || 0)) / 100;
  const payable = Math.max(0, totalFees - discountAmount);
  const due = Math.max(0, payable - Number(paid || 0));

  const requiredTubes = useMemo(() => {
    const names = selectedTests
      .map((id) => groups.find((g) => g.id === id)?.display_name || '')
      .join(' ')
      .toLowerCase();

    const tubes: { name: string; color: string; desc: string }[] = [];
    if (names.includes('cbc') || names.includes('hemogram') || names.includes('hba1c') || names.includes('esr') || names.includes('blood group')) {
      tubes.push({ name: 'EDTA (Lavender)', color: 'bg-purple-600 text-white', desc: 'Whole Blood' });
    }
    if (names.includes('lipid') || names.includes('lft') || names.includes('kft') || names.includes('thyroid') || names.includes('serum') || names.includes('calcium') || names.includes('electrolyte')) {
      tubes.push({ name: 'SST Gel (Yellow)', color: 'bg-amber-400 text-amber-950 font-bold', desc: 'Serum Clot Activator' });
    }
    if (names.includes('glucose') || names.includes('fbs') || names.includes('ppbs') || names.includes('sugar')) {
      tubes.push({ name: 'Fluoride (Grey)', color: 'bg-slate-500 text-white', desc: 'Sodium Fluoride' });
    }
    if (names.includes('pt') || names.includes('inr') || names.includes('aptt') || names.includes('coagulation')) {
      tubes.push({ name: 'Citrate (Light Blue)', color: 'bg-sky-500 text-white', desc: 'Sodium Citrate 3.2%' });
    }
    if (names.includes('urine') || names.includes('routine')) {
      tubes.push({ name: 'Sterile Container', color: 'bg-emerald-600 text-white', desc: 'Urine Specimen' });
    }
    return tubes;
  }, [selectedTests, groups]);

  function handleTitleChange(val: string) {
    setPatientTitle(val);
    if (val === 'Mr.' || val === 'Master') {
      setPatientGender('Male');
    } else if (val === 'Mrs.' || val === 'Ms.') {
      setPatientGender('Female');
    }
  }

  function handleSelectExistingPatient(p: Patient) {
    setSelectedExistingPatient(p);
    setPatientId(p.id);
    setPatientTitle(p.title || (p.gender === 'Female' ? 'Ms.' : 'Mr.'));
    setPatientType(p.patient_type || 'Regular');
    setPatientFullName(p.full_name);
    setPatientPhone(p.phone || '');
    setPatientAge(p.age_years !== null && p.age_years !== undefined ? String(p.age_years) : '');
    setPatientGender((p.gender as any) || 'Male');
    setPatientEmail(p.email || '');
    setPatientAddress(p.address || '');
    setPatientSearch('');
  }

  function handleClearPatient() {
    setSelectedExistingPatient(null);
    setPatientId('');
    setPatientTitle('Mr.');
    setPatientType('Regular');
    setPatientFullName('');
    setPatientPhone('');
    setPatientAge('');
    setPatientAgeUnit('Years');
    setPatientGender('Male');
    setPatientEmail('');
    setPatientAddress('');
    const now = formatForDateTimeLocal(new Date());
    setCollectionAt(now);
    setReceivedAt(now);
    setReportingAt(now);
    setVisitRemarks('');
    setFastingStatus('Unspecified');
    setPatientSearch('');
  }

  async function handleQuickAddDoctor() {
    if (!newDoctorName.trim()) return;
    setSavingDoctor(true);
    try {
      const createdDoc = await doctorsDb.create({
        salutation: 'Dr.',
        name: newDoctorName.trim(),
        degree: newDoctorDegree.trim() || 'MBBS',
        commission_basis: 'percent',
        commission_percent: 0,
        contact_no: null,
        email: null,
        address: null,
        is_active: true,
      });
      setDoctors((prev) => [...prev, createdDoc]);
      setDoctorId(createdDoc.id);
      setNewDoctorName('');
      setNewDoctorDegree('');
      setShowAddDoctor(false);
    } catch (err) {
      console.error('Failed to add doctor:', err);
    } finally {
      setSavingDoctor(false);
    }
  }

  function toggleTest(id: string) {
    setSelectedTests((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function applyPackage(pkg: PackageItem) {
    const combined = Array.from(new Set([...selectedTests, ...pkg.test_group_ids]));
    setSelectedTests(combined);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!patientFullName.trim() || selectedTests.length === 0) return;
    setSaving(true);
    setSavedOrder(null);
    try {
      let finalPatientId = patientId;
      let finalPatientName = patientFullName.trim();

      // If this is a new patient (no existing patient selected), create patient record directly!
      if (!selectedExistingPatient || !finalPatientId) {
        const createdPat = await patientsDb.create({
          title: patientTitle,
          patient_type: patientType,
          full_name: finalPatientName,
          phone: patientPhone.trim() || null,
          gender: patientGender,
          age_years: patientAge ? Number(patientAge) : null,
          age_months: patientAgeUnit === 'Months' ? Number(patientAge) : 0,
          age_days: patientAgeUnit === 'Days' ? Number(patientAge) : 0,
          email: patientEmail.trim() || null,
          address: patientAddress.trim() || null,
          city: null,
          history: `Fasting: ${fastingStatus}`,
        });
        finalPatientId = createdPat.id;
        finalPatientName = createdPat.full_name;
        setPatients((prev) => [createdPat, ...prev]);
      }

      const { data: userData } = await supabase.auth.getUser();
      const totalPayable = payable;
      const order = await ordersDb.create(
        {
          patient_id: finalPatientId,
          doctor_id: doctorId || null,
          centre_id: centreId || null,
          branch_id: branchId || null,
          collection_at: toIsoOrNull(collectionAt),
          received_at: toIsoOrNull(receivedAt),
          reporting_at: toIsoOrNull(reportingAt),
          remarks: visitRemarks.trim(),
          fasting_status: fastingStatus,
          priority,
          discount_percent: Number(discountPercent || 0),
          payable: totalPayable,
          paid: Number(paid || 0),
          payment_mode: paymentMode,
          test_group_ids: selectedTests,
        },
        userData.user?.id || ''
      );

      setSavedOrder({
        lab_id: order.lab_id,
        id: order.id || '',
        due,
        patient_name: `${patientTitle} ${finalPatientName}`,
        paid: Number(paid || 0),
      });
      setShowReceiptModal(true);

      // Keep form ready for next patient
      handleClearPatient();
      setSelectedTests([]);
      setDiscountPercent('0');
      setPaid('0');
    } catch (err) {
      console.error('Error registering visit:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div id="new-visit-page" className="space-y-6">
      {/* Success Notification Banner */}
      {savedOrder && (
        <div id="order-success-banner" className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-emerald-950">
                Diagnostic Visit Registered — Lab ID: {savedOrder.lab_id}
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Specimen barcode generated. Outstanding due: Rs. {savedOrder.due.toFixed(2)}. Ready for sample collection.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/visits')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              Go to Visits & Results
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSavedOrder(null)}
              className="px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 rounded-lg transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Patient Demographics & Test Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Patient Demographics & Registration (Patho One Direct Workflow) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  1. Patient Demographics & Registration
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Direct billing entry: Register new walk-in patient or search returning patient.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPatientList(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 transition"
                >
                  <User className="w-3 h-3" />
                  Patient List
                </button>
                {selectedExistingPatient ? (
                  <button
                    type="button"
                    onClick={handleClearPatient}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    New Walk-in Patient
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Direct Patient Entry
                  </span>
                )}
              </div>
            </div>

            {/* Quick Search for Returning Patients */}
            <div className="relative">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Quick Search Returning Patient (Optional)
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Type mobile number, MRN, or name to auto-fill returning patient..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
                />
                {patientSearch && (
                  <button
                    type="button"
                    onClick={() => setPatientSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Autocomplete Results Dropdown */}
              {filteredPatients.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Found {filteredPatients.length} existing patient(s) — Click to Auto-fill:
                  </div>
                  {filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectExistingPatient(p)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50/70 transition flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-800">{p.full_name}</span>
                          <span className="text-[11px] text-slate-500 ml-1.5">
                            ({p.gender}, {p.age_years ?? '—'} yrs)
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-semibold text-blue-600 text-[11px]">{p.mrn}</span>
                        {p.phone && <div className="text-[10px] text-slate-400">{p.phone}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Existing Patient Banner */}
            {selectedExistingPatient && (
              <div className="p-3 bg-blue-50/80 rounded-lg border border-blue-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-bold text-blue-900">Loaded Returning Patient: </span>
                    <span className="font-mono text-blue-700">[{selectedExistingPatient.mrn}] </span>
                    <span className="font-semibold text-slate-900">{selectedExistingPatient.full_name}</span>
                    <span className="text-slate-600 text-[11px] ml-1">
                      ({selectedExistingPatient.gender}{selectedExistingPatient.age_years ? `, ${selectedExistingPatient.age_years} yrs` : ''})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearPatient}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
                >
                  Change / Clear
                </button>
              </div>
            )}

            {/* Direct Patient Demographics Form */}
            <div className="space-y-3 pt-1">
              {/* Row 1: Salutation, Full Name, Mobile Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Title</label>
                  <select
                    id="patient-title-select"
                    value={patientTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Master">Master</option>
                    <option value="Baby">Baby</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                  </select>
                </div>

                <div className="sm:col-span-6 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Patient Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="patient-fullname-input"
                    type="text"
                    required
                    placeholder="Enter patient full name..."
                    value={patientFullName}
                    onChange={(e) => setPatientFullName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-medium"
                  />
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Mobile Phone <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      id="patient-phone-input"
                      type="tel"
                      required
                      placeholder="Mobile number..."
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Age, Age Unit, Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Age & Unit <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="patient-age-input"
                      type="number"
                      required
                      min="0"
                      max="130"
                      placeholder="Age"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      className="w-20 border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                    />
                    <select
                      id="patient-age-unit-select"
                      value={patientAgeUnit}
                      onChange={(e) => setPatientAgeUnit(e.target.value as any)}
                      className="flex-1 border border-slate-300 rounded-lg px-2 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value="Years">Years</option>
                      <option value="Months">Months</option>
                      <option value="Days">Days</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Patient Type</label>
                    <select
                      id="patient-type-select"
                      value={patientType}
                      onChange={(e) => setPatientType(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option>Regular</option>
                      <option>Emergency</option>
                      <option>Corporate</option>
                      <option>Home Collection</option>
                      <option>Camp</option>
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Gender <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    {(['Male', 'Female', 'Other'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setPatientGender(g)}
                        className={`py-1.5 px-2 rounded-lg border text-xs font-semibold transition text-center ${
                          patientGender === g
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Fasting / Preparation</label>
                  <select
                    id="fasting-status-select"
                    value={fastingStatus}
                    onChange={(e) => setFastingStatus(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="Unspecified">Unspecified / Routine</option>
                    <option value="Fasting 10-12 hrs">Fasting (10-12 Hours)</option>
                    <option value="Post-Prandial (PP 2 hrs)">Post-Prandial (PP 2 Hours)</option>
                    <option value="Random / Non-Fasting">Random / Non-Fasting</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Optional Address & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Email Address (for Digital Reports)</label>
                  <input
                    id="patient-email-input"
                    type="email"
                    placeholder="patient@example.com (optional)"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Address / City (Optional)</label>
                  <input
                    id="patient-address-input"
                    type="text"
                    placeholder="Area / City / Landmark..."
                    value={patientAddress}
                    onChange={(e) => setPatientAddress(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Referral Masters: Doctor, Collection Centre, Branch */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Referring Doctor</label>
                    <button
                      type="button"
                      onClick={() => setShowAddDoctor(!showAddDoctor)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      {showAddDoctor ? 'Close' : 'Quick Add Dr'}
                    </button>
                  </div>
                  <select
                    id="doctor-select"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                  >
                    <option value="">SELF / Walk-in Patient</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.salutation} {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Collection Centre / Hub</label>
                  <select
                    id="centre-select"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    value={centreId}
                    onChange={(e) => setCentreId(e.target.value)}
                  >
                    <option value="">Main Lab Collection Desk</option>
                    {centres.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Inline Quick Add Doctor Card */}
              {showAddDoctor && (
                <div className="p-3 bg-slate-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Quick Add Referring Doctor</span>
                    <button
                      type="button"
                      onClick={() => setShowAddDoctor(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Doctor Name (e.g. Dr. A. K. Gupta)"
                      value={newDoctorName}
                      onChange={(e) => setNewDoctorName(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="Degree / Spec (e.g. MD Medicine)"
                      value={newDoctorDegree}
                      onChange={(e) => setNewDoctorDegree(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingDoctor || !newDoctorName.trim()}
                      onClick={handleQuickAddDoctor}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                    >
                      {savingDoctor ? 'Saving...' : 'Save & Select Doctor'}
                    </button>
                  </div>
                </div>
              )}

              {branches.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-700">Diagnostic Branch</label>
                  <select
                    id="branch-select"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                  >
                    <option value="">Primary Diagnostic Center</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Visit Priority (Routine vs STAT) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-700">Investigation Priority</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPriority('routine')}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      priority === 'routine'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>Routine Order</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('stat')}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      priority === 'stat'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                    <span>STAT (Emergency)</span>
                  </button>
                </div>
              </div>

              {/* Row 4: Legacy PathoOne visit timing + remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Collection Date & Time</label>
                  <input
                    id="collection-at-input"
                    type="datetime-local"
                    value={collectionAt}
                    onChange={(e) => setCollectionAt(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Received Date & Time</label>
                  <input
                    id="received-at-input"
                    type="datetime-local"
                    value={receivedAt}
                    onChange={(e) => setReceivedAt(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Reporting Date & Time</label>
                  <input
                    id="reporting-at-input"
                    type="datetime-local"
                    value={reportingAt}
                    onChange={(e) => setReportingAt(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-medium text-slate-600">Remarks</label>
                <textarea
                  id="visit-remarks-input"
                  rows={2}
                  value={visitRemarks}
                  onChange={(e) => setVisitRemarks(e.target.value)}
                  placeholder="Optional visit notes..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Test Catalog & Package Bundles */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-indigo-600" />
                2. Test Selection ({selectedTests.length} selected)
              </h2>
              <span className="text-xs font-semibold text-slate-600">
                Subtotal: Rs. {totalFees.toFixed(2)}
              </span>
            </div>

            {/* Dynamic specimen tube requirement indicator */}
            {requiredTubes.length > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <span>Required Sample Collection Tubes ({requiredTubes.length}):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {requiredTubes.map((tube, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold shadow-xs ${tube.color}`}
                    >
                      <span>{tube.name}</span>
                      <span className="opacity-75 text-[10px] font-normal">({tube.desc})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Package Presets */}
            {packages.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" />
                  Quick Health Packages (Click to auto-select tests):
                </div>
                <div className="flex flex-wrap gap-2">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      id={`apply-package-${pkg.id}`}
                      onClick={() => applyPackage(pkg)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-800 font-medium transition flex items-center gap-1.5"
                    >
                      <span>{pkg.name}</span>
                      <span className="text-indigo-600 font-bold">Rs. {pkg.fee}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Filter for Individual Tests */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search test name (e.g. CBC, Lipid, Glucose)..."
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Test Group Rows */}
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {filteredGroups.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No matching tests found. Configure tests in Test Master.
                </div>
              ) : (
                filteredGroups.map((g) => {
                  const isChecked = selectedTests.includes(g.id);
                  return (
                    <label
                      key={g.id}
                      id={`test-group-option-${g.id}`}
                      className={`flex items-center justify-between px-3.5 py-2.5 text-xs cursor-pointer transition select-none ${
                        isChecked ? 'bg-blue-50/70 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTest(g.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>{g.display_name}</span>
                      </div>
                      <span className="font-mono text-slate-600">Rs. {g.rate.toFixed(2)}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Billing & Cashier Summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-600" />
              3. Billing & Payment Math
            </h2>

            {/* Total Fees */}
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Total Investigation Fees:</span>
              <span className="font-semibold text-slate-900 font-mono text-sm">
                Rs. {totalFees.toFixed(2)}
              </span>
            </div>

            {/* Discount % */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-slate-700">Discount Percentage (%):</label>
                <span className="text-slate-500 font-mono">- Rs. {discountAmount.toFixed(2)}</span>
              </div>
              <input
                id="discount-input"
                type="number"
                min="0"
                max="100"
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
            </div>

            {/* Net Payable */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">Net Payable:</span>
              <span className="font-bold text-slate-900 font-mono text-base">
                Rs. {payable.toFixed(2)}
              </span>
            </div>

            {/* Amount Paid */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="font-semibold text-slate-700">Amount Received Today:</label>
                <button
                  type="button"
                  onClick={() => setPaid(payable.toString())}
                  className="text-[11px] text-blue-600 font-medium hover:underline"
                >
                  Pay in Full
                </button>
              </div>
              <input
                id="paid-amount-input"
                type="number"
                min="0"
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </div>

            {/* Payment Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Payment Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'upi', label: 'UPI / QR', icon: Smartphone },
                  { id: 'card', label: 'Card / POS', icon: CreditCard },
                  { id: 'net_banking', label: 'Online / Bank', icon: Receipt },
                ].map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = paymentMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPaymentMode(mode.id as any)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Balance Due */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-sm">
              <span className="font-bold text-slate-800">Balance Due:</span>
              <span className={`font-bold font-mono ${due > 0 ? 'text-rose-600 text-base' : 'text-emerald-600 text-sm'}`}>
                {due > 0 ? `Rs. ${due.toFixed(2)}` : 'Nil (Fully Settled)'}
              </span>
            </div>

            {/* Submit Button */}
            <button
              id="save-visit-btn"
              type="submit"
              disabled={saving || !patientFullName.trim() || selectedTests.length === 0}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Processing Registration...' : 'Save / Next & Generate Receipt'}
            </button>
          </div>
        </div>
      </form>

      {showPatientList && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Patient List</h2>
                <p className="text-xs text-slate-500">Select a patient to return to registration.</p>
              </div>
              <button type="button" onClick={() => setShowPatientList(false)} className="text-xs px-3 py-1.5 rounded border border-slate-200">
                Close
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <input
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search by name, MRN, or mobile..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="overflow-y-auto">
              {(patientSearch.trim() ? filteredPatients : patients).map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => {
                    handleSelectExistingPatient(patient);
                    setShowPatientList(false);
                  }}
                  className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-blue-50 flex items-center justify-between"
                >
                  <span>
                    <span className="font-semibold text-slate-900">{patient.title} {patient.full_name}</span>
                    <span className="block text-xs text-slate-500">{patient.mrn} · {patient.gender} · {patient.phone || 'No phone'}</span>
                  </span>
                  <span className="text-xs font-semibold text-blue-600">Select</span>
                </button>
              ))}
              {(patientSearch.trim() ? filteredPatients : patients).length === 0 && (
                <p className="p-8 text-center text-sm text-slate-400">No patients found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking Receipt / Thermal Slip Modal */}
      {showReceiptModal && savedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Visit Registration & Receipt Slip</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Receipt Preview Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs space-y-2 text-slate-800">
              <div className="text-center border-b border-slate-200 pb-2">
                <div className="font-bold text-sm text-slate-900">
                  {labName || 'Lab name not set — configure under Report Settings'}
                </div>
                <div className="text-xs font-bold text-blue-700 mt-1">
                  VISIT TOKEN: {savedOrder.lab_id}
                </div>
              </div>

              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Patient:</span>
                  <span className="font-bold">{savedOrder.patient_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Priority:</span>
                  <span className={`font-bold ${priority === 'stat' ? 'text-rose-600' : 'text-slate-700'}`}>
                    {priority.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment:</span>
                  <span className="font-bold uppercase">{paymentMode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Paid Amount:</span>
                  <span className="font-bold text-emerald-700">Rs. {(savedOrder.paid ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Due Amount:</span>
                  <span className={`font-bold ${savedOrder.due > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                    Rs. {savedOrder.due.toFixed(2)}
                  </span>
                </div>
              </div>

            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
