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

export default async function LoginPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const [user, contact] = await Promise.all([getCurrentUser(), getContactSettings(dict)]);
  if (user) redirect(user.role === 'CUSTOMER' ? '/account' : '/admin');

  return (
    <LoginForm
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
      }}
    />
  );
}
