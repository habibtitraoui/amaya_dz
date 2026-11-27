import Link from '@/components/ui/navigation-link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Pagination({
  page,
  totalPages,
  searchParams,
  labels,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
  labels: { previous: string; next: string; page: string };
}) {
  const buildHref = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || value === undefined) continue;
      query.set(key, Array.isArray(value) ? value[0] : value);
    }
    if (target > 1) query.set('page', String(target));
    const qs = query.toString();
    return `/products${qs ? `?${qs}` : ''}`;
  };

  const pages: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label={labels.page}>
      {page > 1 && (
        <Link
          href={buildHref(page - 1)}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-ink-200 bg-white px-3 text-[12.5px] font-semibold text-ink-700 hover:border-ink-300"
        >
          <ChevronLeft className="h-3.5 w-3.5 rtl:hidden" />
          <ChevronRight className="hidden h-3.5 w-3.5 rtl:block" />
          {labels.previous}
        </Link>
      )}
      {pages.map((value, index) =>
        value === '…' ? (
          <span key={`gap-${index}`} className="px-1.5 text-ink-300">…</span>
        ) : (
          <Link
            key={value}
            href={buildHref(value)}
            className={cn(
              'grid h-9 min-w-9 place-items-center rounded-full px-2 text-[12.5px] font-bold transition-colors',
              value === page ? 'bg-brand-500 text-white' : 'border border-ink-200 bg-white text-ink-700 hover:border-ink-300',
            )}
          >
            {value}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link
          href={buildHref(page + 1)}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-ink-200 bg-white px-3 text-[12.5px] font-semibold text-ink-700 hover:border-ink-300"
        >
          {labels.next}
          <ChevronRight className="h-3.5 w-3.5 rtl:hidden" />
          <ChevronLeft className="hidden h-3.5 w-3.5 rtl:block" />
        </Link>
      )}
    </nav>
  );
}
