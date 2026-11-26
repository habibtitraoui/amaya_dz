/**
 * Invoices are ALWAYS French — regardless of the language the customer used on
 * the storefront. These labels are intentionally not part of the i18n bundles.
 */
export const INVOICE_LABELS = {
  title: 'FACTURE',
  number: 'Numéro de facture',
  date: 'Date',
  client: 'Client',
  telephone: 'Téléphone',
  adresse: 'Adresse',
  designation: 'Désignation',
  reference: 'Référence',
  couleur: 'Couleur',
  quantite: 'Quantité',
  prixUnitaire: 'Prix unitaire',
  total: 'Total',
  sousTotal: 'Sous-total',
  livraison: 'Livraison',
  remise: 'Remise',
  montantTotal: 'Montant total à payer',
  notes: 'Notes',
  merci: 'Merci de votre confiance.',
  conditions: 'Paiement à la livraison. Garantie échange sous 7 jours sur présentation de cette facture.',
  validePar: 'Établie par',
  devise: 'DA',
  brand: 'AMAYA PREMIUM ACCESSORIES',
  societe: 'AMAYA — Accessoires de téléphonie mobile',
  adresseSociete: 'Oran, Algérie',
  telSociete: '+213 555 00 00 00',
  emailSociete: 'contact@amaya.dz',
  version: 'Version',
  statut: 'Statut de la commande',
  commande: 'Commande',
} as const;

/**
 * Legal identifiers are configuration, not demo data: a real invoice must never
 * print placeholder zeros. Set them in `.env` (or the admin Settings page) once
 * the company registration is known; until then the lines are simply omitted.
 */
export function legalIdentifiers(): string[] {
  const rc = process.env.COMPANY_RC?.trim();
  const nif = process.env.COMPANY_NIF?.trim();
  const ai = process.env.COMPANY_AI?.trim();
  const lines: string[] = [];
  if (rc) lines.push(`RC : ${rc}`);
  if (nif || ai) lines.push([nif ? `NIF : ${nif}` : null, ai ? `AI : ${ai}` : null].filter(Boolean).join(' · '));
  return lines;
}

/** Header contact block shared by the HTML and PDF renderers. */
export function companyContact(): { address: string; contact: string; legal: string[] } {
  return {
    address: process.env.COMPANY_ADDRESS?.trim() || INVOICE_LABELS.adresseSociete,
    contact: [INVOICE_LABELS.telSociete, INVOICE_LABELS.emailSociete].filter(Boolean).join(' · '),
    legal: legalIdentifiers(),
  };
}

/** Order status labels in French, for the invoice footer. */
export const INVOICE_STATUS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  READY: 'Prête',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

export const TIER_FR: Record<string, string> = {
  RETAIL: 'Détail',
  WHOLESALE: 'Gros',
  SUPER_WHOLESALE: 'Super Gros',
};
