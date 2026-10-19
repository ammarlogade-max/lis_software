// Typed data-access layer for the production Supabase backend.
// REST calls. Grouped by domain so each page imports only what it needs,
// e.g. `import { patientsDb } from '../lib/db'`.
//
// None of this has run against a live database — there is no network
// access in the environment this was written in. Treat the first `bun dev`
// run against your real Supabase project as the actual test.

import { supabase } from './supabaseClient';

function must<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('Expected a row but got none.');
  return data;
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------
export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  is_main: boolean;
  is_active: boolean;
}

export const branchesDb = {
  async list(): Promise<Branch[]> {
    const { data, error } = await supabase.from('branches').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },
  async create(input: Omit<Branch, 'id'>): Promise<Branch> {
    const { data, error } = await supabase.from('branches').insert(input).select().single();
    return must(data, error);
  },
  async update(id: string, input: Partial<Omit<Branch, 'id'>>): Promise<Branch> {
    const { data, error } = await supabase.from('branches').update(input).eq('id', id).select().single();
    return must(data, error);
  },
};

// ---------------------------------------------------------------------------
// Collection Centres
// ---------------------------------------------------------------------------
export interface CollectionCentre {
  id: string;
  name: string;
  commission_percent: number;
  contact_no: string | null;
  is_active: boolean;
}

export const centresDb = {
  async list(): Promise<CollectionCentre[]> {
    const { data, error } = await supabase.from('collection_centres').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },
  async create(input: Omit<CollectionCentre, 'id'>): Promise<CollectionCentre> {
    const { data, error } = await supabase.from('collection_centres').insert(input).select().single();
    return must(data, error);
  },
  async update(id: string, input: Partial<Omit<CollectionCentre, 'id'>>): Promise<CollectionCentre> {
    const { data, error } = await supabase.from('collection_centres').update(input).eq('id', id).select().single();
    return must(data, error);
  },
};

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------
export interface Doctor {
  id: string;
  salutation: string;
  name: string;
  degree: string;
  commission_basis: string;
  commission_percent: number;
  contact_no: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
}

export const doctorsDb = {
  async list(): Promise<Doctor[]> {
    const { data, error } = await supabase.from('doctors').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },
  async create(input: Omit<Doctor, 'id'>): Promise<Doctor> {
    const { data, error } = await supabase.from('doctors').insert(input).select().single();
    return must(data, error);
  },
  async update(id: string, input: Partial<Omit<Doctor, 'id'>>): Promise<Doctor> {
    const { data, error } = await supabase.from('doctors').update(input).eq('id', id).select().single();
    return must(data, error);
  },
};

// ---------------------------------------------------------------------------
// Patients — soft-delete only, matching the app's existing behaviour
// ---------------------------------------------------------------------------
export interface Patient {
  id: string;
  mrn: string;
  title: string;
  patient_type: string;
  full_name: string;
  gender: string;
  age_years: number | null;
  age_months: number;
  age_days: number;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  history: string | null;
}

function generateMrn(): string {
  const now = new Date();
  const y = now.getFullYear();
  const rand = Math.floor(Math.random() * 900000 + 100000);
  return `MRN-${y}-${rand}`;
}

export const patientsDb = {
  async list(search?: string): Promise<Patient[]> {
    let query = supabase.from('patients').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
    if (search && search.trim()) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,mrn.ilike.%${search}%`);
    }
    const { data, error } = await query.limit(200);
    if (error) throw new Error(error.message);
    return data || [];
  },
  async get(id: string): Promise<Patient> {
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
    return must(data, error);
  },
  async create(input: Omit<Patient, 'id' | 'mrn'>): Promise<Patient> {
    const { data, error } = await supabase
      .from('patients')
      .insert({ ...input, mrn: generateMrn() })
      .select()
      .single();
    return must(data, error);
  },
  async update(id: string, input: Partial<Omit<Patient, 'id' | 'mrn'>>): Promise<Patient> {
    const { data, error } = await supabase.from('patients').update(input).eq('id', id).select().single();
    return must(data, error);
  },
  async softDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from('patients')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },
  async listDeleted(): Promise<Patient[]> {
    const { data, error } = await supabase.from('patients').select('*').eq('is_deleted', true).order('deleted_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async recover(id: string): Promise<void> {
    const { error } = await supabase.from('patients').update({ is_deleted: false, deleted_at: null }).eq('id', id);
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Test Master: groups + parameters (nested)
// ---------------------------------------------------------------------------
export interface TestParameter {
  id?: string;
  test_group_id?: string;
  name: string;
  unit: string | null;
  default_value: string | null;
  formula: string | null;
  decimal_format: string | null;
  is_bold: boolean;
  normal_range_male: string | null;
  normal_range_female: string | null;
  normal_range_child_male: string | null;
  normal_range_child_female: string | null;
  analyzer_code?: string;
  critical_low?: string;
  critical_high?: string;
  report_comment?: string;
  is_required?: boolean;
  options?: string | null;
  test_description?: string | null;
  low_value?: string | null;
  high_value?: string | null;
  is_subtitle?: boolean;
  sort_order: number;
}

export interface TestGroup {
  id: string;
  display_name: string;
  report_title: string;
  short_name: string;
  rate: number;
  method_interpretation: string;
  department?: string;
  specimen_type?: string;
  sample_volume?: string;
  container_type?: string;
  report_sequence?: number;
  is_active: boolean;
  test_parameters?: TestParameter[];
}

export const testGroupsDb = {
  async listActive(): Promise<TestGroup[]> {
    const { data, error } = await supabase
      .from('test_groups')
      .select('*, test_parameters(*)')
      .eq('is_active', true)
      .order('display_name');
    if (error) throw new Error(error.message);
    return (data as TestGroup[]) || [];
  },
  async listAll(): Promise<TestGroup[]> {
    const { data, error } = await supabase
      .from('test_groups')
      .select('*, test_parameters(*)')
      .order('display_name');
    if (error) throw new Error(error.message);
    return (data as TestGroup[]) || [];
  },
  async createGroup(input: Omit<TestGroup, 'id' | 'test_parameters'>): Promise<TestGroup> {
    const { data, error } = await supabase.from('test_groups').insert(input).select().single();
    return must(data as TestGroup, error);
  },
  async updateGroup(id: string, input: Partial<Omit<TestGroup, 'id' | 'test_parameters'>>): Promise<TestGroup> {
    const { data, error } = await supabase.from('test_groups').update(input).eq('id', id).select().single();
    return must(data as TestGroup, error);
  },
  // Replaces all parameter rows for a group in one call — simplest way to
  // keep the grid editor (add/remove/reorder rows freely) in sync without
  // diffing row-by-row on every save.
  async replaceParameters(testGroupId: string, params: TestParameter[]): Promise<void> {
    const { error: delErr } = await supabase.from('test_parameters').delete().eq('test_group_id', testGroupId);
    if (delErr) throw new Error(delErr.message);
    if (params.length === 0) return;
    const rows = params.map((p, i) => ({ ...p, id: undefined, test_group_id: testGroupId, sort_order: i }));
    const { error: insErr } = await supabase.from('test_parameters').insert(rows);
    if (insErr) throw new Error(insErr.message);
  },
};

// ---------------------------------------------------------------------------
// Packages (dual-list over test_groups via junction table)
// ---------------------------------------------------------------------------
export interface PackageItem {
  id: string;
  name: string;
  fee: number;
  is_active: boolean;
  test_group_ids?: string[];
}

export const packagesDb = {
  async list(): Promise<PackageItem[]> {
    const { data, error } = await supabase
      .from('packages')
      .select('*, package_test_groups(test_group_id)')
      .order('name');
    if (error) throw new Error(error.message);
    return (data || []).map((p: any) => ({
      ...p,
      test_group_ids: (p.package_test_groups || []).map((j: any) => j.test_group_id),
    }));
  },
  async create(input: { name: string; fee: number; is_active: boolean; test_group_ids: string[] }): Promise<PackageItem> {
    const { data, error } = await supabase
      .from('packages')
      .insert({ name: input.name, fee: input.fee, is_active: input.is_active })
      .select()
      .single();
    const pkg = must(data, error);
    if (input.test_group_ids.length > 0) {
      const rows = input.test_group_ids.map((tgId) => ({ package_id: pkg.id, test_group_id: tgId }));
      const { error: junctionErr } = await supabase.from('package_test_groups').insert(rows);
      if (junctionErr) throw new Error(junctionErr.message);
    }
    return pkg;
  },
  async update(
    id: string,
    input: { name?: string; fee?: number; is_active?: boolean; test_group_ids?: string[] }
  ): Promise<void> {
    const { name, fee, is_active, test_group_ids } = input;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (fee !== undefined) patch.fee = fee;
    if (is_active !== undefined) patch.is_active = is_active;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from('packages').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
    }
    if (test_group_ids !== undefined) {
      const { error: delErr } = await supabase.from('package_test_groups').delete().eq('package_id', id);
      if (delErr) throw new Error(delErr.message);
      if (test_group_ids.length > 0) {
        const rows = test_group_ids.map((tgId) => ({ package_id: id, test_group_id: tgId }));
        const { error: insErr } = await supabase.from('package_test_groups').insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Orders (billing/visit) + results
// ---------------------------------------------------------------------------
export interface NewOrderInput {
  patient_id: string;
  doctor_id: string | null;
  centre_id: string | null;
  branch_id: string | null;
  collection_at: string | null;
  received_at: string | null;
  reporting_at: string | null;
  remarks: string;
  fasting_status: string;
  priority: string;
  discount_percent: number;
  payable: number;
  paid: number;
  payment_mode: string;
  test_group_ids: string[];
}

async function nextLabId(): Promise<string> {
  const year = new Date().getFullYear();
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`);
  if (error) throw new Error(error.message);
  const seq = (count || 0) + 1;
  return `LAB-${year}-${String(seq).padStart(5, '0')}`;
}

export const ordersDb = {
  async create(input: NewOrderInput, createdBy: string): Promise<{ id: string; lab_id: string }> {
    const labId = await nextLabId();
    const due = Math.max(0, input.payable - input.paid);
    const { data: selectedGroups, error: groupsError } = await supabase
      .from('test_groups')
      .select('container_type')
      .in('id', input.test_group_ids);
    if (groupsError) throw new Error(groupsError.message);
    const tubesRequired = Array.from(new Set((selectedGroups || []).map((group: any) => group.container_type).filter(Boolean)));
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        lab_id: labId,
        patient_id: input.patient_id,
        doctor_id: input.doctor_id,
        centre_id: input.centre_id,
        branch_id: input.branch_id,
        collection_at: input.collection_at,
        received_at: input.received_at,
        reporting_at: input.reporting_at,
        remarks: input.remarks,
        fasting_status: input.fasting_status,
        priority: input.priority,
        discount_percent: input.discount_percent,
        payable: input.payable,
        paid: input.paid,
        due,
        payment_mode: input.payment_mode,
        tubes_required: tubesRequired,
        created_by: createdBy,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (input.test_group_ids.length > 0) {
      const rows = input.test_group_ids.map((tgId) => ({ order_id: order.id, test_group_id: tgId }));
      const { error: otgErr } = await supabase.from('order_test_groups').insert(rows);
      if (otgErr) throw new Error(otgErr.message);
    }
    return { id: order.id, lab_id: order.lab_id };
  },

  async list(filters?: { status?: string; from?: string; to?: string; search?: string }) {
    let q = supabase
      .from('orders')
      .select('id, lab_id, status, payable, due, priority, created_at, patients(full_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.from) q = q.gte('created_at', filters.from);
    if (filters?.to) q = q.lte('created_at', filters.to);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map((o: any) => ({
      id: o.id,
      lab_id: o.lab_id,
      patient_name: o.patients?.full_name || null,
      status: o.status,
      payable: o.payable,
      due: o.due,
      priority: o.priority,
    }));
  },

  async getDetail(orderId: string) {
    const { data: order, error } = await supabase
      .from('orders')
      .select(
        `id, lab_id, specimen_id, status, priority, created_at, collection_at, received_at, reporting_at, remarks,
         patients(id, mrn, title, full_name, phone, email, gender, age_years),
         doctor:doctors(salutation, name, degree),
         centre:collection_centres(name),
         branch:branches(name),
         order_test_groups(id, status, test_groups(id, display_name, report_title,
           test_parameters(id, name, unit, formula, decimal_format, is_bold,
             normal_range_male, normal_range_female, normal_range_child_male, normal_range_child_female, sort_order)))`
      )
      .eq('id', orderId)
      .single();
    if (error) throw new Error(error.message);

    const { data: results, error: resultsErr } = await supabase
      .from('order_results')
      .select('order_test_group_id, parameter_id, value')
      .in('order_test_group_id', ((order as any).order_test_groups || []).map((g: any) => g.id));
    if (resultsErr) throw new Error(resultsErr.message);

    const valueMap = new Map<string, string>();
    (results || []).forEach((r) => valueMap.set(`${r.order_test_group_id}:${r.parameter_id}`, r.value || ''));

    return {
      id: (order as any).id,
      lab_id: (order as any).lab_id,
      specimen_id: (order as any).specimen_id,
      status: (order as any).status,
      priority: (order as any).priority,
      patient: (order as any).patients,
      doctor_name: (order as any).doctor ? `${(order as any).doctor.salutation} ${(order as any).doctor.name} (${(order as any).doctor.degree})` : 'Self / Walk-In',
      centre_name: (order as any).centre?.name || 'Main Laboratory',
      branch_name: (order as any).branch?.name || 'Main Lab Campus',
      created_at: (order as any).created_at,
      order_tests: ((order as any).order_test_groups || []).map((g: any) => ({
        id: g.id,
        test_group_name: g.test_groups?.display_name || '',
        status: g.status,
        parameters: (g.test_groups?.test_parameters || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            is_bold_header: p.is_bold,
            formula: p.formula,
            decimal_format: p.decimal_format,
            normal_range_male: p.normal_range_male,
            normal_range_female: p.normal_range_female,
            value: valueMap.get(`${g.id}:${p.id}`) ?? '',
          })),
      })),
    };
  },

  // Saves every parameter's value for one test group in a single upsert,
  // then marks that test group (and the order, if every group is now
  // complete) as completed. Formula computation happens client-side before
  // calling this (see src/lib/formula.ts), same approach as before.
  async saveResults(orderTestGroupId: string, orderId: string, values: Record<string, string>, enteredBy: string) {
    const { error } = await supabase.rpc('save_order_results', {
      p_order_test_group_id: orderTestGroupId,
      p_order_id: orderId,
      p_values: values,
      p_entered_by: enteredBy,
    });
    if (error) throw new Error(error.message);
  },
};

// ---------------------------------------------------------------------------
// Report Settings / Page Setup (singleton rows)
// ---------------------------------------------------------------------------
export interface ReportSettings {
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
  report_template_path?: string | null;
  font_styles?: Record<string, { size: number; weight: 'normal' | 'bold'; color: string }>;
}

export const reportSettingsDb = {
  async get(): Promise<ReportSettings> {
    const { data, error } = await supabase.from('report_settings').select('*').eq('id', 1).single();
    return must(data, error);
  },
  async update(patch: Partial<ReportSettings>): Promise<ReportSettings> {
    const { data, error } = await supabase.from('report_settings').update(patch).eq('id', 1).select().single();
    return must(data, error);
  },
};

export interface PageSetup {
  report_margin: { top: number; bottom: number; left: number; right: number };
  receipt_margin: { top: number; bottom: number; left: number; right: number };
  line_space: number;
  print_flags: Record<string, boolean>;
  footer_note_enabled: boolean;
  footer_note_text: string;
}

export const pageSetupDb = {
  async get(): Promise<PageSetup> {
    const { data, error } = await supabase.from('page_setup').select('*').eq('id', 1).single();
    return must(data as PageSetup, error);
  },
  async update(patch: Partial<PageSetup>): Promise<PageSetup> {
    const { data, error } = await supabase.from('page_setup').update(patch).eq('id', 1).select().single();
    return must(data as PageSetup, error);
  },
};

export const toolsDb = {
  async getSettings() {
    const { data, error } = await supabase.from('lab_tools_settings').select('*').eq('id', 1).single();
    return must(data, error);
  },
  async updateSettings(patch: { email_address: string; email_domain: string; pdf_export_path: string }) {
    const { data, error } = await supabase.from('lab_tools_settings').update(patch).eq('id', 1).select().single();
    return must(data, error);
  },
  async backup() {
    const tables = ['patients', 'doctors', 'collection_centres', 'branches', 'test_groups', 'test_parameters', 'packages', 'package_test_groups', 'orders', 'order_test_groups', 'order_results', 'report_settings', 'page_setup'];
    const snapshot: Record<string, unknown> = {};
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw new Error(error.message);
      snapshot[table] = data || [];
    }
    return snapshot;
  },
};

// ---------------------------------------------------------------------------
// Supabase Storage — replaces the old hand-rolled multipart upload parser.
// Requires a public bucket named "uploads" (see SETUP.md step 3).
// ---------------------------------------------------------------------------
export const storageDb = {
  async uploadPublicImage(file: File, folder: 'logo' | 'qr-code' | 'footer'): Promise<string> {
    const ext = file.name.split('.').pop() || 'png';
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('uploads').getPublicUrl(path);
    return data.publicUrl;
  },
  async uploadReportTemplate(file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `report-templates/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('uploads').upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('uploads').getPublicUrl(path);
    return data.publicUrl;
  },
  async uploadReportPdf(orderId: string, blob: Blob): Promise<string> {
    const path = `reports/${orderId}-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from('reports').upload(path, blob, {
      upsert: true,
      contentType: 'application/pdf',
    });
    if (error) throw new Error(error.message);
    const { data, error: signedUrlError } = await supabase.storage.from('reports').createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signedUrlError) throw new Error(signedUrlError.message);
    return data.signedUrl;
  },
};

// ---------------------------------------------------------------------------
// Operational workflows
// ---------------------------------------------------------------------------
export const dashboardDb = {
  async stats() {
    const [{ count: orderCount }, { count: patientCount }, { count: testCount }, { data: orders }, { data: lowStock }, { data: analyzers }] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
      supabase.from('test_groups').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('orders').select('id, lab_id, specimen_id, status, payable, due, patient:patients(full_name), order_test_groups(id)').order('created_at', { ascending: false }).limit(6),
      supabase.from('inventory_items').select('*').filter('current_quantity', 'lte', 'reorder_level'),
      supabase.from('analyzers').select('*').eq('is_active', true),
    ]);
    const orderRows = orders || [];
    const totalRevenue = orderRows.reduce((sum: number, order: any) => sum + Number(order.payable || 0), 0);
    const totalDue = orderRows.reduce((sum: number, order: any) => sum + Number(order.due || 0), 0);
    return {
      total_orders: orderCount || 0,
      today_orders: orderCount || 0,
      pending_collection: orderRows.filter((order: any) => order.status === 'created').length,
      sample_collected: orderRows.filter((order: any) => order.status === 'sample_collected').length,
      completed: orderRows.filter((order: any) => order.status === 'completed').length,
      total_patients: patientCount || 0,
      total_tests_offered: testCount || 0,
      total_revenue: totalRevenue,
      total_collected: Math.max(0, totalRevenue - totalDue),
      total_due: totalDue,
      low_stock_count: (lowStock || []).length,
      low_stock_items: lowStock || [],
      analyzers: analyzers || [],
      recent_orders: orderRows.map((order: any) => ({
        id: order.id,
        lab_id: order.lab_id,
        specimen_id: order.specimen_id,
        patient_name: order.patient?.full_name || '',
        status: order.status,
        payable: Number(order.payable || 0),
        due: Number(order.due || 0),
        tests_count: (order.order_test_groups || []).length,
      })),
    };
  },
};

export const methodsDb = {
  async list(): Promise<string[]> {
    const { data, error } = await supabase.from('methods').select('name').order('name');
    if (error) throw new Error(error.message);
    return (data || []).map((row) => row.name);
  },
  async create(name: string) {
    const { error } = await supabase.from('methods').insert({ name });
    if (error) throw new Error(error.message);
  },
};

export const auditDb = {
  async record(input: {
    action: string;
    entity_type: string;
    entity_id?: string;
    branch_id?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Active staff session is required.');
    const { error } = await supabase.from('audit_events').insert({
      actor_id: userData.user.id,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id || null,
      branch_id: input.branch_id || null,
      metadata: input.metadata || {},
    });
    if (error) throw new Error(error.message);
  },
};

export const paymentDb = {
  async collect(input: {
    order_id: string;
    amount: number;
    payment_mode: string;
    reference_no?: string;
    remarks?: string;
  }) {
    const { data, error } = await supabase.rpc('collect_order_payment', {
      p_order_id: input.order_id,
      p_amount: input.amount,
      p_payment_mode: input.payment_mode,
      p_reference_no: input.reference_no || null,
      p_remarks: input.remarks || '',
    });
    return must(data, error);
  },
  async listForOrder(orderId: string) {
    const { data, error } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async refund(input: { order_id: string; amount: number; payment_mode: string; reference_no?: string; remarks?: string }) {
    const { data, error } = await supabase.rpc('refund_order_payment', {
      p_order_id: input.order_id,
      p_amount: input.amount,
      p_payment_mode: input.payment_mode,
      p_reference_no: input.reference_no || null,
      p_remarks: input.remarks || '',
    });
    return must(data, error);
  },
};

export const inventoryDb = {
  async list() {
    const { data, error } = await supabase.from('inventory_items').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data || []).map((item: any) => ({ ...item, is_low_stock: Number(item.current_quantity) <= Number(item.reorder_level) }));
  },
  async create(input: { name: string; unit: string; opening_quantity: number; reorder_level: number }) {
    const { data, error } = await supabase.from('inventory_items').insert({
      name: input.name,
      unit: input.unit,
      current_quantity: input.opening_quantity,
      reorder_level: input.reorder_level,
    }).select().single();
    const item = must(data, error);
    if (input.opening_quantity > 0) {
      const { data: userData } = await supabase.auth.getUser();
      const { error: movementError } = await supabase.from('inventory_movements').insert({
        item_id: item.id,
        movement_type: 'stock_in',
        quantity: input.opening_quantity,
        reason: 'Opening balance',
        created_by: userData.user?.id || null,
      });
      if (movementError) throw new Error(movementError.message);
    }
    return item;
  },
  async movements(itemId?: string) {
    let query = supabase.from('inventory_movements').select('*, item:inventory_items(name, unit)').order('created_at', { ascending: false });
    if (itemId) query = query.eq('item_id', itemId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },
  async adjust(itemId: string, movementType: 'stock_in' | 'stock_out' | 'adjustment', quantity: number, reason: string) {
    const { data, error } = await supabase.rpc('adjust_inventory', {
      p_item_id: itemId,
      p_movement_type: movementType,
      p_quantity: quantity,
      p_reason: reason,
    });
    return must(data, error);
  },
};

export const analyzersDb = {
  async list() {
    const { data, error } = await supabase.from('analyzers').select('*').order('name');
    if (error) throw new Error(error.message);
    return data || [];
  },
  async create(input: Record<string, unknown>) {
    const { data, error } = await supabase.from('analyzers').insert(input).select().single();
    return must(data, error);
  },
  async mappings() {
    const { data, error } = await supabase.from('analyzer_mappings').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },
  async createMapping(input: Record<string, unknown>) {
    const { data, error } = await supabase.from('analyzer_mappings').insert(input).select().single();
    return must(data, error);
  },
  async logs() {
    const { data, error } = await supabase.from('analyzer_logs').select('*, analyzer:analyzers(name)').order('created_at', { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data || [];
  },
};

export const financeDb = {
  async transactions() {
    const { data, error } = await supabase.from('orders').select('*, patient:patients(phone)').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data || [];
    const summary = rows.reduce((acc: any, order: any) => {
      acc.total_billed += Number(order.payable || 0);
      acc.total_collected += Number(order.paid || 0);
      acc.total_due += Number(order.due || 0);
      const mode = order.payment_mode || 'cash';
      if (mode === 'cash') acc.cash_in_hand += Number(order.paid || 0);
      if (mode === 'upi') acc.upi_collections += Number(order.paid || 0);
      if (mode === 'card') acc.card_collections += Number(order.paid || 0);
      if (mode === 'net_banking') acc.net_banking_collections += Number(order.paid || 0);
      return acc;
    }, { total_billed: 0, total_discount: 0, total_collected: 0, total_due: 0, cash_in_hand: 0, upi_collections: 0, card_collections: 0, net_banking_collections: 0 });
    return {
      summary,
      transactions: rows.map((order: any) => ({ ...order, id: order.id, date: order.created_at, patient_name: order.patient?.full_name || '', phone: order.patient?.phone || '-' })),
      outstanding_dues: rows.filter((order: any) => Number(order.due) > 0).map((order: any) => ({ id: order.id, lab_id: order.lab_id, patient_name: order.patient?.full_name || '', phone: order.patient?.phone || '-', total_bill: order.payable, due_amount: order.due, registered_on: order.created_at })),
    };
  },
  async vouchers() {
    const { data, error } = await supabase.from('doctor_vouchers').select('*, doctor:doctors(salutation, name, degree)').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async doctorIncentives() {
    const [{ data: doctors, error: doctorError }, { data: orders, error: orderError }, { data: vouchers, error: voucherError }] = await Promise.all([
      supabase.from('doctors').select('*').eq('is_active', true).order('name'),
      supabase.from('orders').select('doctor_id, payable'),
      supabase.from('doctor_vouchers').select('*'),
    ]);
    if (doctorError) throw new Error(doctorError.message);
    if (orderError) throw new Error(orderError.message);
    if (voucherError) throw new Error(voucherError.message);
    return {
      doctors: (doctors || []).map((doctor: any) => {
        const doctorOrders = (orders || []).filter((order: any) => order.doctor_id === doctor.id);
        const doctorVouchers = (vouchers || []).filter((voucher: any) => voucher.doctor_id === doctor.id);
        const totalBilling = doctorOrders.reduce((sum: number, order: any) => sum + Number(order.payable || 0), 0);
        const grossIncentive = (totalBilling * Number(doctor.commission_percent || 0)) / 100;
        const totalPaid = doctorVouchers.reduce((sum: number, voucher: any) => sum + Number(voucher.amount || 0), 0);
        return { doctor_id: doctor.id, salutation: doctor.salutation, name: doctor.name, degree: doctor.degree, commission_percent: doctor.commission_percent, referral_count: doctorOrders.length, total_billing: totalBilling, gross_incentive: grossIncentive, total_paid: totalPaid, balance_payable: Math.max(0, grossIncentive - totalPaid) };
      }),
      vouchers: vouchers || [],
    };
  },
  async collectDue(orderId: string, amount: number, paymentMode: string) {
    const { data: order, error } = await supabase.from('orders').select('paid, due').eq('id', orderId).single();
    const current = must(order, error);
    const paid = Number(current.paid) + amount;
    const due = Math.max(0, Number(current.due) - amount);
    const { error: updateError } = await supabase.from('orders').update({ paid, due, payment_mode: paymentMode }).eq('id', orderId);
    if (updateError) throw new Error(updateError.message);
  },
  async createVoucher(input: Record<string, unknown>) {
    const { data, error } = await supabase.from('doctor_vouchers').insert({ ...input, mode: input.payment_mode }).select('*, doctor:doctors(salutation, name, degree)').single();
    return must(data, error);
  },
};

export const reportsDb = {
  async load(tab: string, fromDate?: string, toDate?: string, search?: string) {
    const [{ data: orders, error: orderError }, { data: groups, error: groupError }, { data: doctors, error: doctorError }, { data: centres, error: centreError }, { data: patients, error: patientError }, { data: settings, error: settingsError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase.from('orders').select('*, patient:patients(full_name, phone), order_test_groups(test_group:test_groups(display_name))').order('created_at', { ascending: false }),
      supabase.from('test_groups').select('id, display_name, rate'),
      supabase.from('doctors').select('id, salutation, name'),
      supabase.from('collection_centres').select('id, name, commission_percent'),
      supabase.from('patients').select('id, full_name, phone, gender, age_years'),
      supabase.from('report_settings').select('lab_name').eq('id', 1).single(),
      supabase.from('profiles').select('id, full_name'),
    ]);
    if (orderError || groupError || doctorError || centreError || patientError || settingsError || profilesError) {
      throw new Error([orderError, groupError, doctorError, centreError, patientError, settingsError, profilesError].find(Boolean)?.message || 'Could not load report data.');
    }
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : -Infinity;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Infinity;
    const rows = (orders || []).filter((order: any) => {
      const created = new Date(order.created_at).getTime();
      return created >= from && created <= to;
    });
    if (tab === 'rate-list') return { rows: (groups || []).map((group: any) => ({ display_name: group.display_name, rate: group.rate })), lab_name: settings?.lab_name || '' };
    if (tab === 'fees-received') {
      const filtered = rows.filter((order: any) => Number(order.paid) > 0).filter((order: any) => !search || order.lab_id.toLowerCase().includes(search.toLowerCase()) || order.patient?.full_name?.toLowerCase().includes(search.toLowerCase()) || order.patient?.phone?.includes(search));
      return { rows: filtered.map((order: any) => ({ lab_id: order.lab_id, patient_name: order.patient?.full_name || '', phone: order.patient?.phone, paid: order.paid, payment_mode: order.payment_mode, created_at: order.created_at })), total_received: filtered.reduce((sum: number, order: any) => sum + Number(order.paid || 0), 0) };
    }
    if (tab === 'day-book') {
      const result = rows.map((order: any) => ({ lab_id: order.lab_id, patient_name: order.patient?.full_name || '', tests: (order.order_test_groups || []).map((item: any) => item.test_group?.display_name).filter(Boolean).join(', '), payable: order.payable, paid: order.paid, due: order.due, payment_mode: order.payment_mode, created_at: order.created_at }));
      return { rows: result, totals: result.reduce((acc: any, row: any) => ({ payable: acc.payable + Number(row.payable || 0), paid: acc.paid + Number(row.paid || 0), due: acc.due + Number(row.due || 0) }), { payable: 0, paid: 0, due: 0 }) };
    }
    if (tab === 'due-list') {
      const result = rows.filter((order: any) => Number(order.due) > 0).map((order: any) => ({ lab_id: order.lab_id, patient_name: order.patient?.full_name || '', total_bill: order.payable, paid: order.paid, due_amount: order.due, registered_on: order.created_at }));
      return { rows: result, total_due: result.reduce((sum: number, row: any) => sum + Number(row.due_amount || 0), 0) };
    }
    if (tab === 'doctorwise') {
      const result = (doctors || []).map((doctor: any) => { const doctorOrders = rows.filter((order: any) => order.doctor_id === doctor.id); return { doctor_name: `${doctor.salutation} ${doctor.name}`, test_count: doctorOrders.reduce((sum: number, order: any) => sum + (order.order_test_groups || []).length, 0), patient_count: doctorOrders.length, total_billing: doctorOrders.reduce((sum: number, order: any) => sum + Number(order.payable || 0), 0) }; });
      return { rows: result };
    }
    if (tab === 'userwise') {
      const names = new Map((profiles || []).map((profile: any) => [profile.id, profile.full_name || profile.id]));
      const grouped = new Map<string, { user_name: string; test_count: number; total_billing: number }>();
      rows.forEach((order: any) => {
        const userId = order.created_by || 'unassigned';
        const current = grouped.get(userId) || { user_name: names.get(userId) || 'Unassigned', test_count: 0, total_billing: 0 };
        current.test_count += (order.order_test_groups || []).length;
        current.total_billing += Number(order.payable || 0);
        grouped.set(userId, current);
      });
      const result = Array.from(grouped.values());
      return { rows: result, total: result.reduce((sum, row) => sum + row.total_billing, 0) };
    }
    if (tab === 'agentwise') {
      return { rows: (centres || []).map((centre: any) => { const centreOrders = rows.filter((order: any) => order.centre_id === centre.id); const billing = centreOrders.reduce((sum: number, order: any) => sum + Number(order.payable || 0), 0); return { centre_name: centre.name, patient_count: centreOrders.length, total_billing: billing, commission_percent: centre.commission_percent, commission_amount: billing * Number(centre.commission_percent || 0) / 100 }; }) };
    }
    if (tab === 'testwise') {
      return { rows: (groups || []).map((group: any) => { const count = rows.filter((order: any) => (order.order_test_groups || []).some((item: any) => item.test_group?.display_name === group.display_name)).length; return { test_name: group.display_name, count, revenue: count * Number(group.rate || 0) }; }).filter((row: any) => row.count > 0) };
    }
    if (tab === 'patients-list') {
      const seen = new Set<string>();
      return { rows: rows.filter((order: any) => { if (seen.has(order.patient_id)) return false; seen.add(order.patient_id); return true; }).map((order: any) => ({ lab_id: order.lab_id, patient_name: order.patient?.full_name || '', gender: order.patient?.gender || '-', age: order.patient?.age_years ? `${order.patient.age_years}y` : '-', phone: order.patient?.phone || '-', registered_on: order.created_at })) };
    }
    return { rows: [] };
  },
};
