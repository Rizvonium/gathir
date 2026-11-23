/** "Make again" goes back to the open report screen (no second one), which takes the new dates. */
import { renderHook } from '@testing-library/react-native';

import '@/i18n';

import { startOfDay } from '@/lib/dates';

import { useReportHistory } from '../hooks/useReportHistory';
import { useReportVisit } from '../hooks/useReportVisit';
import { useReportFlow } from '../store';

const mockRouter = { push: jest.fn(), dismissTo: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('expo-file-system', () => ({ File: class {} }));
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/hooks', () => ({ useReports: () => [] }));
jest.mock('@/db/repo/settings', () => ({ getSettings: () => ({ ownerWhatsapp: null }) }));
jest.mock('@/lib/files', () => ({ exportsDir: () => 'file:///cache/exports' }));
jest.mock('@/share', () => ({ shareFileToWhatsApp: jest.fn() }));
jest.mock('@/ui/components', () => ({ playHaptic: jest.fn(), useToast: () => ({ show: jest.fn(), hide: jest.fn() }) }));

const DAY = 86_400_000;
const FROM = new Date(2026, 9, 1, 12).getTime();
const TO = FROM + 6 * DAY;

beforeEach(() => jest.clearAllMocks());

it('Make again returns to the report screen already open (never pushes a second one)', async () => {
  const { result } = await renderHook(() => useReportHistory());
  result.current.makeAgain({ id: 'r1', number: 3, sentAt: TO, from: FROM, to: TO } as never);
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(mockRouter.dismissTo).toHaveBeenCalledWith({ pathname: '/report', params: expect.objectContaining({ from: String(FROM), to: String(TO) }) });
});

it('the open report screen starts on "Since last report", then takes the dates of each new visit', async () => {
  const { rerender } = await renderHook((p: { from?: number; to?: number; visit?: string }) => useReportVisit(p.from, p.to, p.visit), {
    initialProps: {},
  });
  expect(useReportFlow.getState().kind).toBe('since');
  await rerender({ from: FROM, to: TO, visit: '1' });
  expect(useReportFlow.getState()).toMatchObject({ kind: 'custom', customFrom: startOfDay(FROM), customTo: startOfDay(TO) });
  // The seller changes the period, then taps Make again on the same dates: applied again.
  useReportFlow.getState().set({ kind: 'since' });
  await rerender({ from: FROM, to: TO, visit: '2' });
  expect(useReportFlow.getState().kind).toBe('custom');
});
