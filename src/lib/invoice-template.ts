import { INVOICE_LABELS as L, INVOICE_STATUS, TIER_FR, companyContact } from '@/lib/invoice-labels';

/** Company header resolved once per render (env-configured legal ids). */
const COMPANY = companyContact();

export type InvoiceData = {
  number: string;
  version: number;
  issuedAt: string | Date;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  subtotal: string | number;
  discount: string | number;
  deliveryFee: string | number;
  totalAmount: string | number;
  notes?: string | null;
  orderNumber?: string;
  orderStatus?: string;
  customerType?: string;
  items: {
    reference: string;
    designation: string;
    color?: string | null;
    quantity: number;
    unitPrice: string | number;
    lineTotal: string | number;
  }[];
};

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

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A4, French-only invoice — the single template behind both the HTML preview
 * (printed from the browser) and the server-generated PDF.
 */
export function renderInvoiceHtml(data: InvoiceData, options: { autoPrint?: boolean } = {}): string {
  const rows = data.items
    .map(
      (item, index) => `
        <tr>
          <td class="muted">${index + 1}</td>
          <td><strong>${esc(item.designation)}</strong>${item.color ? `<span class="sub">${esc(L.couleur)} : ${esc(item.color)}</span>` : ''}</td>
          <td class="mono">${esc(item.reference)}</td>
          <td class="center">${item.quantity}</td>
          <td class="right mono">${money(item.unitPrice)}</td>
          <td class="right mono strong">${money(item.lineTotal)}</td>
        </tr>`,
    )
    .join('');

  const discountRow =
    Number(data.discount) > 0
      ? `<tr><td class="label" colspan="5">${L.remise}</td><td class="right mono">−${money(data.discount)}</td></tr>`
      : '';

  return `<!doctype html>
<html lang="fr" dir="ltr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${L.title} ${esc(data.number)} — AMAYA</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #e9eaee; color: #17181d;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 12px; line-height: 1.45;
  }
  .sheet {
    width: 210mm; min-height: 297mm; margin: 18px auto; background: #fff;
    box-shadow: 0 20px 60px rgba(0,0,0,.18);
    padding: 16mm 14mm 14mm; position: relative; display: flex; flex-direction: column;
  }
  .topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .logo { width: 132px; height: auto; display: block; }
  .brand-sub { font-size: 8.5px; letter-spacing: .22em; color: #6b6e7b; margin-top: 4px; font-weight: 700; text-transform: uppercase; }
  .doc { text-align: right; }
  .doc h1 { margin: 0; font-size: 26px; letter-spacing: .18em; color: #f56600; font-weight: 800; }
  .doc .meta { font-size: 10px; color: #545764; margin-top: 6px; }
  .doc .mono { font-family: 'SFMono-Regular', Consolas, monospace; }
  .rule { height: 4px; border-radius: 4px; background: linear-gradient(90deg, #f56600, #ffb04d); margin: 14px 0 18px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .box { border: 1px solid #e6e7ec; border-radius: 10px; padding: 12px 14px; }
  .box h2 { margin: 0 0 8px; font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: #8d909c; font-weight: 800; }
  .box p { margin: 2px 0; }
  .box .name { font-size: 14px; font-weight: 800; color: #17181d; }
  .muted { color: #8d909c; }
  .sub { display: block; font-size: 10px; color: #6b6e7b; margin-top: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 16px; }
  table.items thead th {
    background: #17181d; color: #fff; font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase;
    padding: 8px 9px; text-align: left; font-weight: 700;
  }
  table.items thead th:last-child, table.items thead th.right { text-align: right; }
  table.items thead th.center { text-align: center; }
  table.items tbody td { padding: 9px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  table.items tbody tr:nth-child(even) { background: #fafafa; }
  .right { text-align: right; }
  .center { text-align: center; }
  .mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11px; }
  .strong { font-weight: 800; }
  .totals { margin-top: 14px; margin-inline-start: auto; width: 62%; border-collapse: collapse; }
  .totals td { padding: 6px 9px; }
  .totals .label { color: #545764; text-align: right; }
  .totals .value { text-align: right; font-family: 'SFMono-Regular', Consolas, monospace; white-space: nowrap; }
  .totals tr.grand td { border-top: 2px solid #17181d; font-size: 15px; font-weight: 800; color: #f56600; padding-top: 10px; }
  .notes { margin-top: 18px; border-left: 4px solid #f56600; background: #fff7ef; padding: 10px 14px; border-radius: 0 8px 8px 0; }
  .notes h3 { margin: 0 0 4px; font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: #b84200; }
  .foot { margin-top: auto; padding-top: 22px; display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; }
  .foot .thanks { font-size: 11px; color: #43454f; }
  .foot .legal { font-size: 8.5px; color: #8d909c; line-height: 1.6; margin-top: 6px; }
  .stamp { border: 2px solid #f56600; color: #f56600; border-radius: 8px; padding: 8px 12px; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; font-weight: 800; white-space: nowrap; }
  .version { font-size: 8.5px; color: #8d909c; margin-top: 4px; }
  .toolbar { max-width: 210mm; margin: 16px auto -4px; display: flex; justify-content: flex-end; gap: 8px; }
  .toolbar button { background: #f56600; color: #fff; border: 0; border-radius: 8px; padding: 9px 16px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .toolbar button.secondary { background: #17181d; }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; width: auto; min-height: auto; padding: 0; }
    .toolbar { display: none; }
  }
</style>
</head>
<body>
  ${options.autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),350));</script>' : ''}
  <div class="toolbar">
    <button onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  </div>
  <div class="sheet">
    <div class="topbar">
      <div>
        <img class="logo" src="/brand/amaya-logo-orange.png" alt="AMAYA" />
        <div class="brand-sub">${L.brand}</div>
      </div>
      <div class="doc">
        <h1>${L.title}</h1>
        <div class="meta">${L.number} : <span class="mono"><strong>${esc(data.number)}</strong></span></div>
        <div class="meta">${L.date} : ${humanDate(data.issuedAt)}</div>
        ${data.orderNumber ? `<div class="meta">${L.commande} : <span class="mono">${esc(data.orderNumber)}</span></div>` : ''}
        <div class="version">${L.version} ${data.version}</div>
      </div>
    </div>

    <div class="rule"></div>

    <div class="grid">
      <div class="box">
        <h2>Émetteur</h2>
        <p class="name">${L.societe}</p>
        <p class="muted">${COMPANY.address}</p>
        <p class="muted">${COMPANY.contact}</p>
        ${COMPANY.legal.map((line) => `<p class="muted">${line}</p>`).join('')}
      </div>
      <div class="box">
        <h2>${L.client}</h2>
        <p class="name">${esc(data.customerName)}</p>
        <p>${L.telephone} : ${esc(data.customerPhone)}</p>
        <p class="muted">${L.adresse} : ${esc(data.customerAddress)}</p>
        ${data.customerType ? `<p class="muted">Tarif : ${TIER_FR[data.customerType] ?? esc(data.customerType)}</p>` : ''}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:28px">#</th>
          <th>${L.designation}</th>
          <th style="width:110px">${L.reference}</th>
          <th class="center" style="width:52px">${L.quantite}</th>
          <th class="right" style="width:92px">${L.prixUnitaire}</th>
          <th class="right" style="width:96px">${L.total}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="totals">
      <tr><td class="label">${L.sousTotal}</td><td class="value">${money(data.subtotal)} ${L.devise}</td></tr>
      ${Number(data.deliveryFee) > 0 ? `<tr><td class="label">${L.livraison}</td><td class="value">${money(data.deliveryFee)} ${L.devise}</td></tr>` : ''}
      ${discountRow}
      <tr class="grand"><td class="label">${L.montantTotal}</td><td class="value">${money(data.totalAmount)} ${L.devise}</td></tr>
    </table>

    ${data.notes ? `<div class="notes"><h3>${L.notes}</h3>${esc(data.notes)}</div>` : ''}

    <div class="foot">
      <div>
        <div class="thanks">${L.merci}</div>
        <div class="legal">${L.conditions}</div>
        ${data.orderStatus ? `<div class="legal">${L.statut} : ${INVOICE_STATUS[data.orderStatus] ?? esc(data.orderStatus)}</div>` : ''}
      </div>
      <div class="stamp">${L.brand}</div>
    </div>
  </div>
</body>
</html>`;
}
