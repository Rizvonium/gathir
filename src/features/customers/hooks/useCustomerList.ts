/** Customers tab state: search, tag chip, filters and sort over the live customer list. */
import { useDeferredValue, useState } from 'react';

import { useCustomers, useDbQuery } from '@/db/hooks';
import { listCustomers, type CustomerSort } from '@/db/repo/customerQueries';
import type { CustomerTag } from '@/db/schema';

import { INACTIVE_DAYS } from '../logic/customerLogic';

export function useCustomerList() {
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<CustomerTag | null>(null);
  const [followUpDue, setFollowUpDue] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [sort, setSort] = useState<CustomerSort>('recent');
  const deferredSearch = useDeferredValue(search);

  const rows = useCustomers({
    search: deferredSearch.trim() || undefined,
    tag: tag ?? undefined,
    followUpDue: followUpDue || undefined,
    inactiveDays: inactive ? INACTIVE_DAYS : undefined,
    sort,
  });

  const filtered = search.trim() !== '' || tag !== null || followUpDue || inactive;
  // Total book size, only queried while a filter hides rows (tells "empty book" from "no match").
  const total = useDbQuery((d) => (filtered ? listCustomers(d).length : -1), [filtered]);
  const totalCount = filtered ? total : rows.length;

  const clearFilters = () => {
    setSearch('');
    setTag(null);
    setFollowUpDue(false);
    setInactive(false);
  };

  return {
    rows,
    totalCount,
    anyCustomers: totalCount > 0,
    filtered,
    search,
    setSearch,
    tag,
    setTag,
    followUpDue,
    toggleFollowUpDue: () => setFollowUpDue((v) => !v),
    inactive,
    toggleInactive: () => setInactive((v) => !v),
    sort,
    setSort,
    clearFilters,
  };
}
