import Link from '@/components/ui/navigation-link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * The supplied AMAYA mark. Orange on light surfaces, white on the dark/orange
 * surfaces — always rendered from the brand asset, never re-typeset.
 */
export function Logo({
  variant = 'orange',
  className,
  href = '/',
  priority = false,
}: {
  variant?: 'orange' | 'white';
  className?: string;
  href?: string | null;
  priority?: boolean;
}) {
  const src = variant === 'white' ? '/brand/amaya-logo-white.png' : '/brand/amaya-logo-orange.png';
  const mark = (
    <Image
      src={src}
      alt="AMAYA — Premium Accessories"
      width={1600}
      height={237}
      priority={priority}
      className={cn('h-7 w-auto sm:h-8', className)}
    />
  );
  if (!href) return mark;
  return (
    <Link href={href} aria-label="AMAYA home" className="inline-flex items-center">
      {mark}
    </Link>
  );
}

export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-start gap-1.5', className)}>
      <Image
        src="/brand/amaya-logo-white.png"
        alt="AMAYA"
        width={1600}
        height={237}
        className="h-8 w-auto"
      />
      <span className="text-[10px] font-bold uppercase tracking-[0.42em] text-white/70">Premium Accessories</span>
    </div>
  );
}
