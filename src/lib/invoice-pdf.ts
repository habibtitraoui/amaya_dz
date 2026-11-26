import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { InvoiceData } from '@/lib/invoice-template';
import { INVOICE_LABELS as L, INVOICE_STATUS, TIER_FR, companyContact } from '@/lib/invoice-labels';

/** Company header resolved once per render (env-configured legal ids). */
const COMPANY = companyContact();

const BRAND = '#F56600';
const INK = '#17181D';
const MUTED = '#6B6E7B';
const LINE = '#E6E7EC';

function money(value: string | number): string {
  const n = Number(value);
  return new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function humanDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}

let logoCache: Buffer | null | undefined;

async function loadLogo(): Promise<Buffer | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = await fs.readFile(path.join(process.cwd(), 'public', 'brand', 'amaya-logo-orange.png'));
  } catch {
    logoCache = null;
  }
  return logoCache;
}

/**
 * Server-generated A4 PDF invoice (French only).
 * pdfkit writes compact, print-ready PDFs with no headless browser needed.
 */
export async function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 42, bottom: 42, left: 44, right: 44 } });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;
  const right = left + pageWidth;

  // ---- header -------------------------------------------------------------
  const logo = await loadLogo();
  if (logo) {
    doc.image(logo, left, 40, { width: 116 });
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(MUTED)
      .text(L.brand, left, 40 + 30, { characterSpacing: 1.4 });
  } else {
    doc.font('Helvetica-Bold').fontSize(26).fillColor(BRAND).text('AMAYA', left, 40);
  }

  doc.font('Helvetica-Bold').fontSize(24).fillColor(BRAND).text(L.title, right - 200, 40, {
    width: 200,
    align: 'right',
    characterSpacing: 3,
  });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(INK)
    .text(`${L.number} : ${data.number}`, right - 220, 70, { width: 220, align: 'right' })
    .text(`${L.date} : ${humanDate(data.issuedAt)}`, right - 220, 82, { width: 220, align: 'right' });
  if (data.orderNumber) {
    doc.text(`${L.commande} : ${data.orderNumber}`, right - 220, 94, { width: 220, align: 'right' });
  }
  doc.fillColor(MUTED).fontSize(7).text(`${L.version} ${data.version}`, right - 220, 108, { width: 220, align: 'right' });

  doc.rect(left, 130, pageWidth, 3).fill(BRAND);

  // ---- parties ------------------------------------------------------------
  const boxTop = 146;
  const boxHeight = 96;
  const gap = 14;
  const boxWidth = (pageWidth - gap) / 2;
  doc.roundedRect(left, boxTop, boxWidth, boxHeight, 7).lineWidth(0.7).strokeColor(LINE).stroke();
  doc
    .roundedRect(left + boxWidth + gap, boxTop, boxWidth, boxHeight, 7)
    .lineWidth(0.7)
    .strokeColor(LINE)
    .stroke();

  const label = (text: string, x: number, y: number) =>
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(MUTED).text(text.toUpperCase(), x, y, { characterSpacing: 1.1 });

  label('Émetteur', left + 12, boxTop + 10);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(L.societe, left + 12, boxTop + 22, { width: boxWidth - 24 });
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(MUTED)
    .text(`${COMPANY.address}\n${COMPANY.contact}${COMPANY.legal.length ? `\n${COMPANY.legal.join('\n')}` : ''}`, left + 12, boxTop + 36, {
      width: boxWidth - 24,
      lineGap: 1,
    });

  const cx = left + boxWidth + gap + 12;
  label(L.client, cx, boxTop + 10);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(data.customerName, cx, boxTop + 22, { width: boxWidth - 24 });
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(INK)
    .text(`${L.telephone} : ${data.customerPhone}`, cx, boxTop + 36, { width: boxWidth - 24 });
  doc
    .fillColor(MUTED)
    .text(`${L.adresse} : ${data.customerAddress}`, cx, boxTop + 47, { width: boxWidth - 24 })
    .text(`Tarif : ${TIER_FR[data.customerType ?? 'RETAIL'] ?? data.customerType ?? ''}`, cx, boxTop + 58, {
      width: boxWidth - 24,
    });

  // ---- items table --------------------------------------------------------
  let y = boxTop + boxHeight + 22;
  const cols = { index: left, designation: left + 22, reference: left + 250, qty: left + 350, unit: left + 400, total: right };
  const headerHeight = 20;
  doc.rect(left, y, pageWidth, headerHeight).fill(INK);
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#FFFFFF');
  doc.text('#', cols.index + 6, y + 7);
  doc.text(L.designation.toUpperCase(), cols.designation, y + 7, { characterSpacing: 0.8 });
  doc.text(L.reference.toUpperCase(), cols.reference, y + 7, { width: 90, characterSpacing: 0.8 });
  doc.text(L.quantite.toUpperCase(), cols.qty, y + 7, { width: 44, align: 'center', characterSpacing: 0.8 });
  doc.text(L.prixUnitaire.toUpperCase(), cols.unit, y + 7, { width: 60, align: 'right', characterSpacing: 0.8 });
  doc.text(L.total.toUpperCase(), cols.total - 80, y + 7, { width: 80, align: 'right', characterSpacing: 0.8 });
  y += headerHeight;

  doc.font('Helvetica').fontSize(8).fillColor(INK);
  data.items.forEach((item, index) => {
    const rowHeight = item.color ? 30 : 22;
    if (y + rowHeight > doc.page.height - 150) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    if (index % 2 === 1) doc.rect(left, y, pageWidth, rowHeight).fill('#FAFAFA');
    doc.fillColor(MUTED).text(String(index + 1), cols.index + 6, y + 7);
    doc.fillColor(INK).font('Helvetica-Bold').text(item.designation, cols.designation, y + 6, { width: 220, ellipsis: true });
    if (item.color) {
      doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(`${L.couleur} : ${item.color}`, cols.designation, y + 17, {
        width: 220,
      });
      doc.fontSize(8);
    }
    doc.font('Helvetica').fillColor(INK).text(item.reference, cols.reference, y + 7, { width: 90 });
    doc.text(String(item.quantity), cols.qty, y + 7, { width: 44, align: 'center' });
    doc.text(money(item.unitPrice), cols.unit, y + 7, { width: 60, align: 'right' });
    doc.font('Helvetica-Bold').text(money(item.lineTotal), cols.total - 80, y + 7, { width: 80, align: 'right' });
    doc.moveTo(left, y + rowHeight).lineTo(right, y + rowHeight).lineWidth(0.5).strokeColor(LINE).stroke();
    y += rowHeight;
  });

  // ---- totals -------------------------------------------------------------
  y += 12;
  const totalsLeft = right - 230;
  const totalRow = (labelText: string, value: string, bold = false, color = INK, size = 8.5) => {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(size)
      .fillColor(color)
      .text(labelText, totalsLeft, y, { width: 130, align: 'right' })
      .text(value, totalsLeft + 136, y, { width: 94, align: 'right' });
    y += size + 6;
  };
  totalRow(L.sousTotal, `${money(data.subtotal)} ${L.devise}`);
  if (Number(data.deliveryFee) > 0) totalRow(L.livraison, `${money(data.deliveryFee)} ${L.devise}`);
  if (Number(data.discount) > 0) totalRow(L.remise, `−${money(data.discount)} ${L.devise}`);
  doc.moveTo(totalsLeft, y - 2).lineTo(right, y - 2).lineWidth(1).strokeColor(INK).stroke();
  y += 6;
  totalRow(L.montantTotal.toUpperCase(), `${money(data.totalAmount)} ${L.devise}`, true, BRAND, 10.5);

  // ---- notes --------------------------------------------------------------
  if (data.notes) {
    y += 10;
    const notesWidth = pageWidth * 0.62;
    doc.rect(left, y, 3, 34).fill(BRAND);
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(BRAND).text(L.notes.toUpperCase(), left + 10, y + 4, {
      characterSpacing: 1,
    });
    doc.font('Helvetica').fontSize(7.5).fillColor(INK).text(data.notes, left + 10, y + 14, { width: notesWidth });
  }

  // ---- footer -------------------------------------------------------------
  const footerY = doc.page.height - 88;
  doc.moveTo(left, footerY).lineTo(right, footerY).lineWidth(0.7).strokeColor(LINE).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text(L.merci, left, footerY + 10);
  doc.font('Helvetica').fontSize(6.5).fillColor(MUTED).text(L.conditions, left, footerY + 22, { width: 330, lineGap: 1 });
  if (data.orderStatus) {
    doc.text(`${L.statut} : ${INVOICE_STATUS[data.orderStatus] ?? data.orderStatus}`, left, footerY + 40);
  }
  doc
    .roundedRect(right - 132, footerY + 8, 132, 24, 4)
    .lineWidth(1)
    .strokeColor(BRAND)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(6.5)
    .fillColor(BRAND)
    .text(L.brand, right - 132, footerY + 16, { width: 132, align: 'center', characterSpacing: 0.8 });

  doc.end();
  return done;
}
