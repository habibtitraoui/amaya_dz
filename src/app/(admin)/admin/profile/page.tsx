import { redirect } from 'next/navigation';
import { KeyRound, User } from 'lucide-react';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { StaffProfileForm } from '@/components/admin/staff-profile-form';
import { PasswordForm } from '@/components/account/password-form';

export const dynamic = 'force-dynamic';

export default async function AdminProfilePage() {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) redirect('/admin');

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = dict.admin.profile;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{copy.title}</h1>
        <p className="text-[12.5px] text-ink-500">{copy.subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <User className="h-4 w-4 text-brand-500" />
            {copy.infoTitle}
          </h2>
          <StaffProfileForm
            initial={{
              name: user.name,
              email: user.email,
              role: user.role === 'ADMIN' ? dict.admin.shell.roleAdmin : dict.admin.shell.roleSupervisor,
            }}
            labels={{
              role: copy.roleLabel,
              name: dict.common.name,
              email: dict.common.email,
              save: dict.common.save,
              saving: dict.common.saving,
              updated: copy.updated,
              error: copy.error,
            }}
          />
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <KeyRound className="h-4 w-4 text-brand-500" />
            {dict.auth.changePassword}
          </h2>
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
