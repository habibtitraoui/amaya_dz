import { PageLoading } from '@/components/ui/page-loading';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';

export default async function Loading() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return <PageLoading label={dict.common.loading} />;
}
