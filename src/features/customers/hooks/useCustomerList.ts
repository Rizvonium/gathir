/** Customers tab state: search, tag chip, filters and sort over the live customer list. */
import { useDeferredValue, useState } from 'react';

import { useCustomers, useDbQuery } from '@/db/hooks';
import { listCustomers, type CustomerSort } from '@/db/repo/customerQueries';
import type { CustomerTag } from '@/db/schema';

import { INACTIVE_DAYS } from '../logic/customerLogic';
import type { CustomerListSeed } from '../logic/links';

/** `seed` comes from the tab's link (e.g. Home's "See all" follow-ups) and is applied once per link. */
export function useCustomerList(seed: CustomerListSeed | null = null) {
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<CustomerTag | null>(null);
  const [followUpDue, setFollowUpDue] = useState(seed?.followUpDue ?? false);
  const [inactive, setInactive] = useState(false);
  const [sort, setSort] = useState<CustomerSort>('recent');
  // A new link while the tab is already open: turn its filter on (adjusting state during render).
  const [seedKey, setSeedKey] = useState(seed?.key ?? null);
  if (seed && seed.key !== seedKey) {
    setSeedKey(seed.key);
    setSearch('');
    setTag(null);
    setInactive(false);
    setFollowUpDue(seed.followUpDue);
  }
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
