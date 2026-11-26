import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from '@/lib/i18n';

/**
 * Language bootstrap (Next.js 16 proxy convention, formerly `middleware.ts`).
 *
 * Arabic is the default for Algeria, but a first-time visitor whose browser
 * explicitly asks for French or English gets that language instead. The choice
 * is then frozen in a cookie by the language switcher, so it persists and is
 * never re-guessed.
 */
const SKIP = ['/api', '/_next', '/invoices', '/favicon'];

function fromAcceptLanguage(header: string | null): string {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, quality] = part.trim().split(';q=');
      return { tag: tag.toLowerCase(), q: quality ? Number(quality) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    if (tag.startsWith('fr')) return 'fr';
    if (tag.startsWith('en')) return 'en';
    if (tag.startsWith('ar')) return 'ar';
  }
  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (SKIP.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(existing)) return NextResponse.next();

  const locale = fromAcceptLanguage(request.headers.get('accept-language'));
  const response = NextResponse.next();
  // Persist the resolved language. The current request already renders with the
  // default, which is correct for Arabic and gracefully re-renders for fr/en.
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
