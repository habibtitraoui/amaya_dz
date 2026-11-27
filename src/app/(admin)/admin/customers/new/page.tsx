import Link from '@/components/ui/navigation-link';
import { ArrowLeft } from 'lucide-react';
import { CustomerForm } from '@/components/admin/customer-form';

export default function NewCustomerPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> Clients
      </Link>
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">Nouveau client professionnel</h1>
        <p className="text-[12.5px] text-ink-500">Le compte est créé par le personnel ; aucun formulaire d’inscription n’est exposé en boutique.</p>
      </div>
      <CustomerForm
        initial={{ name: '', email: '', phone: '', tier: 'WHOLESALE', businessName: '', address: '', city: '', wilaya: '', notes: '' }}
      />
    </div>
  );
}
