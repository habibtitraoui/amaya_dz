import Link from '@/components/ui/navigation-link';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

export function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel,
  icon,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-[19px] font-extrabold tracking-tight text-ink-900 sm:text-[22px]">
          {icon && <span className="text-brand-500">{icon}</span>}
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[13px] text-ink-500">{subtitle}</p>}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-700 transition-colors hover:text-brand-600"
        >
          {linkLabel}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
