import * as React from 'react';
import Link from '@/components/ui/navigation-link';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 select-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-[0_6px_20px_-8px_rgba(245,102,0,0.7)] hover:bg-brand-600 hover:shadow-[0_10px_26px_-8px_rgba(245,102,0,0.8)] active:scale-[0.985]',
  secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-100',
  outline: 'border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  dark: 'bg-ink-900 text-white hover:bg-ink-800',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-6 text-sm',
  lg: 'h-13 px-8 text-base',
  icon: 'h-10 w-10',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', ...props },
  ref,
) {
  return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
});

export type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({ className, variant = 'primary', size = 'md', ...props }: ButtonLinkProps) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export { base as buttonBase, variants as buttonVariants, sizes as buttonSizes };
