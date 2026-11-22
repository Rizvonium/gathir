/** Data for CustomerPickerField: search results and the duplicate-phone lookup. */
import { db } from '@/db/client';
import { useCustomers } from '@/db/hooks';
import type { CustomerListRow } from '@/db/repo/customerQueries';
import { findByPhone } from '@/db/repo/customerWrites';

export const CUSTOMER_RESULTS = 5;

export function useCustomerPicker(search: string): {
  results: CustomerListRow[];
  findSavedByPhone: (e164: string) => { id: string; name: string; phone: string | null } | null;
} {
  const q = search.trim();
  const rows = useCustomers({ search: q || undefined, sort: 'recent' });
  return {
    results: rows.slice(0, CUSTOMER_RESULTS),
    findSavedByPhone: (e164) => {
      const c = findByPhone(db, e164);
      return c ? { id: c.id, name: c.name, phone: c.phone } : null;
    },
  };
}
