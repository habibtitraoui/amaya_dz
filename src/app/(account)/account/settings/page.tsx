import { Building2, KeyRound } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { ProfileForm } from '@/components/account/profile-form';
import { PasswordForm } from '@/components/account/password-form';

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    include: { profile: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-ink-900">{dict.account.profileSettings}</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-500">{dict.account.profileSettingsSubtitle}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <Building2 className="h-4 w-4 text-brand-500" />
            {dict.account.info}
          </h3>
          <ProfileForm
            locale={locale}
            initial={{
              name: record?.name ?? user.name,
              phone: record?.phone ?? '',
              businessName: record?.profile?.businessName ?? '',
              address: record?.profile?.address ?? '',
              city: record?.profile?.city ?? '',
              wilaya: record?.profile?.wilaya ?? '',
            }}
            labels={{
              name: dict.common.name,
              phone: dict.common.phone,
              businessName: dict.account.businessName,
              address: dict.common.address,
              city: dict.common.city,
              wilaya: dict.common.wilaya,
              selectWilaya: dict.common.selectWilaya,
              save: dict.common.save,
              saving: dict.common.saving,
              updated: dict.account.profileUpdated,
              error: dict.common.error,
              tier: dict.account.customerType,
              tierValue: dict.tier[user.tier as 'WHOLESALE' | 'SUPER_WHOLESALE'] ?? dict.tier.RETAIL,
              tierNote: dict.account.cannotChangeTier,
              email: dict.common.email,
              emailValue: user.email,
            }}
          />
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <KeyRound className="h-4 w-4 text-brand-500" />
            {dict.auth.changePassword}
          </h3>
          <PasswordForm
            labels={{
              current: dict.auth.currentPassword,
              next: dict.auth.newPassword,
              confirm: dict.auth.confirmPassword,
              save: dict.common.save,
              mismatch: dict.auth.passwordMismatch,
              tooShort: dict.auth.passwordTooShort,
              wrong: dict.auth.passwordWrong,
              changed: dict.auth.passwordChanged,
            }}
          />
        </section>
      </div>
    </div>
  );
}
