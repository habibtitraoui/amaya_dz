import Link from '@/components/ui/navigation-link';
import { ArrowLeft } from 'lucide-react';
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/lib/i18n';
import { CustomerForm } from '@/components/admin/customer-form';

export default async function NewCustomerPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = dict.admin.customers;

  return (
    <div className="space-y-4">
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {copy.backToCustomers}
      </Link>
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{copy.newTitle}</h1>
        <p className="text-[12.5px] text-ink-500">{copy.newSubtitle}</p>
      </div>
      <CustomerForm
        labels={copy.form}
        initial={{ name: '', email: '', phone: '', tier: 'WHOLESALE', businessName: '', address: '', city: '', wilaya: '', notes: '' }}
      />
    </div>
  );
}
