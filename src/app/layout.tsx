import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/outfit';
import '@fontsource-variable/cairo';
import './globals.css';
import { getLocale } from '@/lib/locale';
import { dir, getDictionary } from '@/lib/i18n';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'AMAYA — Premium Accessories',
    template: '%s · AMAYA',
  },
  description:
    'AMAYA Premium Accessories — accessoires de téléphonie mobile en Algérie. Prix détail, gros et super gros. Livraison dans les 58 wilayas.',
  applicationName: 'AMAYA',
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/brand/amaya-icon.png', type: 'image/png' }],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'AMAYA — Premium Accessories',
    description: 'Accessoires premium pour téléphones mobiles · Algérie',
    images: ['/brand/amaya-icon.png'],
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#f56600',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <html lang={locale} dir={dir(locale)} suppressHydrationWarning>
      <body className="min-h-dvh bg-white antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          {dict.common.next}
        </a>
        {children}
      </body>
    </html>
  );
}
