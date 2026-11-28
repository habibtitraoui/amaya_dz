import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/auth';
import { getContactSettings } from '@/lib/settings';
import { LoginForm } from '@/components/auth/login-form';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return { title: dict.nav.login };
}

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@amaya.dz', password: 'Admin@2026', tone: 'bg-ink-900 text-white' },
  { role: 'Supervisor', email: 'superviseur@amaya.dz', password: 'Super@2026', tone: 'bg-ink-100 text-ink-800' },
  { role: 'Wholesale', email: 'gros@boutique.dz', password: 'Gros@2026', tone: 'bg-sky-50 text-sky-800' },
  { role: 'Super Wholesale', email: 'supergros@distrib.dz', password: 'Super@2026', tone: 'bg-violet-50 text-violet-800' },
];

export default async function LoginPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const [user, contact] = await Promise.all([getCurrentUser(), getContactSettings(dict)]);
  if (user) redirect(user.role === 'CUSTOMER' ? '/account' : '/admin');

  return (
    <LoginForm
      locale={locale}
      contactEmailHref={contact.emailHref}
      labels={{
        title: dict.auth.loginTitle,
        subtitle: dict.auth.loginSubtitle,
        email: dict.auth.email,
        emailPlaceholder: dict.auth.emailPlaceholder,
        password: dict.auth.password,
        signIn: dict.auth.signIn,
        signingIn: dict.auth.signingIn,
        invalidCredentials: dict.auth.invalidCredentials,
        suspended: dict.auth.suspended,
        noAccount: dict.auth.noAccount,
        noAccountText: dict.auth.noAccountText,
        contactUs: dict.auth.contactUs,
        demoTitle: dict.auth.demoTitle,
        demoText: dict.auth.demoText,
      }}
      demoAccounts={DEMO_ACCOUNTS}
    />
  );
}
