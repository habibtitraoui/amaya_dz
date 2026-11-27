'use client';

import * as React from 'react';
import Link from '@/components/ui/navigation-link';
import { useRouter } from 'next/navigation';
import { FileText, Loader2, Printer, Download, Plus, ShieldCheck, Info } from 'lucide-react';
import { issueInvoiceAction } from '@/app/actions/admin';
import { formatDA } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import type { Locale } from '@/lib/i18n';

export function InvoicePanel({
  orderId,
  orderStatus,
  invoices,
  locale = 'fr',
  labels,
}: {
  orderId: string;
  orderStatus: string;
  invoices: { id: string; number: string; version: number; issuedAt: string; totalAmount: string }[];
  locale?: Locale;
  labels: {
    title: string;
    generate: string;
    reissue: string;
    preview: string;
    pdf: string;
    print: string;
    empty: string;
    pending: string;
    immutable: string;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const canGenerate = orderStatus !== 'PENDING' && orderStatus !== 'CANCELLED';

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const result = await issueInvoiceAction(orderId);
      if (result.ok) {
        router.refresh();
        const data = result.data as { id: string } | undefined;
        if (data?.id) window.open(`/invoices/${data.id}?print=1`, '_blank');
      } else {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
        <FileText className="h-3.5 w-3.5" />
        {labels.title}
      </h2>

      {invoices.length === 0 ? (
        <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-[11px] text-ink-500">
          <Info className="mb-0.5 me-1 inline h-3 w-3" />
          {canGenerate ? labels.empty : labels.pending}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="rounded-xl border border-ink-100 p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-bold text-ink-900" dir="ltr">{invoice.number}</p>
                  <p className="text-[10px] text-ink-400">v{invoice.version} · {formatDate(invoice.issuedAt, locale)}</p>
                </div>
                <span className="text-[11.5px] font-bold text-ink-700 tabular-nums" dir="ltr">{formatDA(invoice.totalAmount, locale)}</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <Link
                  href={`/invoices/${invoice.id}`}
                  target="_blank"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-ink-100 py-1.5 text-[10.5px] font-bold text-ink-700 hover:bg-ink-200"
                >
                  <Printer className="h-3 w-3" /> {labels.preview}
                </Link>
                <Link
                  href={`/invoices/${invoice.id}/pdf`}
                  target="_blank"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-500 py-1.5 text-[10.5px] font-bold text-white hover:bg-brand-600"
                >
                  <Download className="h-3 w-3" /> {labels.pdf}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canGenerate && (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 bg-brand-50/60 px-3 py-2.5 text-[11.5px] font-bold text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {invoices.length === 0 ? labels.generate : labels.reissue}
        </button>
      )}

      {error && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-[11px] font-medium text-red-700">{error}</p>}

      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-400">
        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
        {labels.immutable}
      </p>
    </div>
  );
}
