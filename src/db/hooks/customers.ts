/** Customer book hooks. */
import {
  getCustomerProfile,
  listCustomers,
  suggestedProducts,
  type CustomerListFilters,
  type CustomerListRow,
  type CustomerProfile,
  type SuggestedProduct,
} from '../repo/customerQueries';
import { dueFollowUps, type DueFollowUp } from '../repo/events';
import { useDbQuery } from './useDbQuery';
import { useToday } from './useToday';

/** Customer list with lifetime totals. `now` (for follow-up/inactive filters) is read at query time. */
export function useCustomers(filters: CustomerListFilters = {}): CustomerListRow[] {
  const { search, tag, followUpDue, inactiveDays, sort } = filters;
  return useDbQuery(
    (d) => listCustomers(d, { search, tag, followUpDue, inactiveDays, sort }, Date.now()),
    [search, tag, followUpDue, inactiveDays, sort],
  );
}

/** Full customer profile, or null. */
export function useCustomerProfile(customerId: string | undefined): CustomerProfile | null {
  return useDbQuery((d) => (customerId ? getCustomerProfile(d, customerId) : null), [customerId]);
}

/** In-stock products matching the customer's likes, best first. */
export function useSuggestedProducts(customerId: string | undefined, limit = 12): SuggestedProduct[] {
  return useDbQuery((d) => (customerId ? suggestedProducts(d, customerId, limit) : []), [customerId, limit]);
}

/** Open follow-ups due by the end of today. */
export function useDueFollowUps(): DueFollowUp[] {
  const today = useToday();
  return useDbQuery((d) => dueFollowUps(d, Date.now()), [today]);
}
