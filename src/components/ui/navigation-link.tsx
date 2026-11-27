'use client';

import * as React from 'react';
import NextLink, { useLinkStatus } from 'next/link';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

export function NavigationIndicator({ pending }: { pending: boolean }) {
  if (!pending) return null;
  const label = document.documentElement.lang === 'ar' ? 'جارٍ التحميل' : document.documentElement.lang === 'fr' ? 'Chargement' : 'Loading';
  return createPortal(
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-5 end-5 z-[110] flex items-center gap-2 rounded-full bg-ink-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}…</span>
    </div>,
    document.body,
  );
}

function LinkIndicator() {
  const { pending } = useLinkStatus();
  return <NavigationIndicator pending={pending} />;
}

export default function NavigationLink({ children, ...props }: React.ComponentProps<typeof NextLink>) {
  return <NextLink {...props}>{children}<LinkIndicator /></NextLink>;
}
