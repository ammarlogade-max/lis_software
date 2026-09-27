// Generates the actual diagnostic report PDF client-side (no server needed).
// Replaces the old backend stub that only ever printed a title + one line
// of subtitle text regardless of what was actually tested.
//
// Uses jsPDF's native text/line drawing (not html2canvas) so the PDF has
// real selectable text and stays small — closer to how Patho One's own
// RDLC-based reports work than a screenshot-of-a-webpage would be.

import { jsPDF } from 'jspdf';
import type { ReportSettings } from './db';

export interface ReportPdfParameter {
  name: string;
  unit: string | null;
  value: string;
  is_bold_header: boolean;
  normal_range_male: string | null;
  normal_range_female: string | null;
}

export interface ReportPdfTestGroup {
  test_group_name: string;
  parameters: ReportPdfParameter[];
}

export interface ReportPdfData {
  lab_id: string;
  patient_name: string;
  gender: string;
  age_years: number | null;
  order_tests: ReportPdfTestGroup[];
  reported_at: string;
}

function isAbnormal(value: string, range: string | null): boolean {
  if (!value || !range) return false;
  const numeric = parseFloat(value);
  if (Number.isNaN(numeric)) return false;
  const match = range.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (!match) return false;
  const [, lo, hi] = match;
  return numeric < parseFloat(lo) || numeric > parseFloat(hi);
}

export async function generateReportPdf(data: ReportPdfData, settings: ReportSettings): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  let y = 16;

  // --- Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(settings.lab_name || 'Lab name not configured', pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const contactLine = [settings.address, settings.phone ? `Tel: ${settings.phone}` : ''].filter(Boolean).join('  |  ');
  if (contactLine) {
    doc.text(contactLine, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }
  if (settings.registration_no) {
    doc.text(`Reg. No: ${settings.registration_no}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  doc.setLineWidth(0.4);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  // --- Patient info block ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Patient: ${data.patient_name}`, marginX, y);
  doc.text(`Lab ID: ${data.lab_id}`, pageWidth - marginX, y, { align: 'right' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  const ageGender = [data.age_years !== null ? `${data.age_years} yrs` : null, data.gender].filter(Boolean).join(' / ');
  doc.text(ageGender, marginX, y);
  doc.text(`Reported: ${data.reported_at}`, pageWidth - marginX, y, { align: 'right' });
  y += 7;

  // --- Results, grouped by test group ---
  for (const group of data.order_tests) {
    if (y > 260) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setFillColor(240, 244, 255);
    doc.rect(marginX, y - 4, pageWidth - marginX * 2, 6, 'F');
    doc.text(group.test_group_name.toUpperCase(), marginX + 1, y);
    y += 6;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Parameter', marginX, y);
    doc.text('Result', marginX + 75, y);
    doc.text('Unit', marginX + 105, y);
    doc.text('Reference Range', marginX + 130, y);
    y += 4;
    doc.setLineWidth(0.1);
    doc.line(marginX, y - 3, pageWidth - marginX, y - 3);

    for (const p of group.parameters) {
      if (y > 275) {
        doc.addPage();
        y = 16;
      }
      const range = p.normal_range_male || p.normal_range_female || '';
      const abnormal = isAbnormal(p.value, range);

      doc.setFont('helvetica', p.is_bold_header ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(p.name, marginX, y);

      if (abnormal) doc.setTextColor(200, 30, 30);
      doc.text(p.value || '-', marginX + 75, y);
      doc.setTextColor(0, 0, 0);

      doc.text(p.unit || '', marginX + 105, y);
      doc.text(range, marginX + 130, y);
      y += 5;
    }
    y += 3;
  }

  // --- Signatures ---
  const slots = [
    { name: settings.signatory_name, degree: settings.signatory_degree, title: settings.signatory_title },
    { name: settings.signatory2_name, degree: settings.signatory2_degree, title: settings.signatory2_title },
    { name: settings.signatory3_name, degree: settings.signatory3_degree, title: settings.signatory3_title },
  ].filter((s) => s.name && s.name.trim());

  if (slots.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 16;
    }
    y = 270;
    const colWidth = (pageWidth - marginX * 2) / slots.length;
    slots.forEach((s, i) => {
      const cx = marginX + colWidth * i + colWidth / 2;
      doc.setLineWidth(0.2);
      doc.line(cx - 25, y, cx + 25, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`${s.name}${s.degree ? ', ' + s.degree : ''}`, cx, y + 4, { align: 'center' });
      if (s.title) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(s.title, cx, y + 8, { align: 'center' });
      }
    });
  }

  // --- Footer note ---
  if (settings.footer_note) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(settings.footer_note, pageWidth / 2, 290, { align: 'center', maxWidth: pageWidth - marginX * 2 });
  }

  return doc.output('blob');
}
