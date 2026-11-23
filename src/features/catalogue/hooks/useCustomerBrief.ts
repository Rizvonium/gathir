import { and, eq, isNull } from 'drizzle-orm';

import { useDbQuery } from '@/db/hooks';
import { customers } from '@/db/schema';

export type CustomerBrief = { id: string; name: string; phone: string | null; whatsappOk: boolean };

/** Name, number and catalogue consent of a live customer (null when missing or deleted). */
export function useCustomerBrief(customerId: string | null | undefined): CustomerBrief | null {
  return useDbQuery(
    (d) =>
      customerId
        ? (d
            .select({ id: customers.id, name: customers.name, phone: customers.phone, whatsappOk: customers.whatsappOk })
            .from(customers)
            .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
            .get() ?? null)
        : null,
    [customerId ?? null],
  );
}
