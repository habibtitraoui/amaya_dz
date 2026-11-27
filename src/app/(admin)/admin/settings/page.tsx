import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { SettingsForm } from '@/components/admin/settings-form';
import { CatalogMigrationCard } from '@/components/admin/catalog-migration-card';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/admin');

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = dict.admin.settings;

  const rows = await prisma.siteSetting.findMany();
  const values: Record<string, unknown> = {};
  for (const row of rows) values[row.key] = row.value;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{copy.title}</h1>
        <p className="text-[12.5px] text-ink-500">{copy.subtitle}</p>
      </div>
      <SettingsForm values={values} labels={copy} />
      <CatalogMigrationCard labels={copy.migration} />
    </div>
  );
}
