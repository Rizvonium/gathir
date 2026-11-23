import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import '@/i18n';

import type { ReportPeriod } from '../hooks/useReportPeriod';
import { useReportSend } from '../hooks/useReportSend';
import { useReportFlow } from '../store';

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/ui', () => ({ Host: () => null, BottomSheet: () => null }));
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/hooks', () => ({ useDbVersion: () => 1 }));
const mockRepo = {
  createReportRecord: jest.fn(() => ({ id: 'r1', number: 7 })),
  markSent: jest.fn(),
  unmarkSent: jest.fn(),
};
jest.mock('@/db/repo/reports', () => ({
  createReportRecord: (...a: unknown[]) => (mockRepo.createReportRecord as jest.Mock)(...a),
  markSent: (...a: unknown[]) => mockRepo.markSent(...a),
  unmarkSent: (...a: unknown[]) => mockRepo.unmarkSent(...a),
}));
jest.mock('expo-file-system', () => ({
  File: class {
    exists = true;
  },
}));
jest.mock('@/lib/files', () => ({ photoFile: () => ({ exists: true }) }));
jest.mock('@/lib/photos', () => ({ photoUri: (n: string) => `file:///photos/${n}`, THUMB_SUFFIX: '_thumb.jpg' }));
const mockRenderPdf = jest.fn(async () => ({ uri: 'file:///cache/exports/Sales%20report%207.pdf', sizeBytes: 2048, pages: 3 }));
jest.mock('@/pdf', () => ({
  renderPdf: (...a: unknown[]) => (mockRenderPdf as jest.Mock)(...a),
  ownerReportFileBaseName: () => 'Sales report 7',
  ownerReportMessage: () => 'Gathir report — Valley',
}));
const mockShare = { file: jest.fn(), images: jest.fn() };
jest.mock('@/share', () => ({
  shareFileToWhatsApp: (...a: unknown[]) => mockShare.file(...a),
  shareImagesToWhatsApp: (...a: unknown[]) => mockShare.images(...a),
}));
const mockPrepared = {
  key: '',
  data: { shop: { shopName: 'Valley' }, reportNumber: 7, summary: { count: 2, pieces: 3, amountPaise: 900_000 }, sales: [{ items: [{ photoName: 'a_thumb.jpg' }] }] },
  doc: { summary: { saleCount: 2, amountPaise: 900_000 } },
  html: '<html></html>',
  fingerprint: 'abc',
};
jest.mock('../prepare', () => ({ prepareOwnerReport: jest.fn(async () => mockPrepared) }));
type ToastOpts = { message: string; actionLabel?: string; onAction?: () => void };
const mockToast = jest.fn<string, [ToastOpts]>(() => 'id');
jest.mock('@/ui/components/Toast', () => ({
  useToast: () => ({ show: mockToast, hide: jest.fn() }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  ToastOutlet: () => null,
}));

function period(owner: string): ReportPeriod {
  return {
    now: 1000,
    range: { from: 0, to: 1000 },
    includePhones: true,
    summary: { count: 2, pieces: 3, amountPaise: 900_000 },
    basics: { ownerWhatsapp: owner },
  } as unknown as ReportPeriod;
}

beforeEach(() => {
  jest.clearAllMocks();
  useReportFlow.getState().reset(1000);
});

describe('useReportSend', () => {
  it('asks for the owner number first when none is saved', async () => {
    const { result } = await renderHook(() => useReportSend(period('')));
    await act(async () => result.current.send());
    expect(result.current.needOwner).toBe(true);
    expect(mockRenderPdf).not.toHaveBeenCalled();
  });

  it('sends to the owner chat, marks as sent and offers Undo', async () => {
    mockShare.file.mockResolvedValue({ status: 'sent' });
    const { result } = await renderHook(() => useReportSend(period('+919906000999')));
    await act(async () => {
      result.current.send();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(mockShare.file).toHaveBeenCalledWith(expect.objectContaining({ phoneE164: '+919906000999', mimeType: 'application/pdf', message: 'Gathir report — Valley' }));
    expect(mockRepo.markSent).toHaveBeenCalledWith({}, 'r1');
    expect(useReportFlow.getState().celebrate).toBe(true);
    expect(useReportFlow.getState().sent?.photoNames).toEqual(['a.jpg']);
    const toast = mockToast.mock.calls[0][0];
    expect(toast.message).toBe('Marked as sent ✓');
    expect(toast.actionLabel).toBe('Undo');
    await act(async () => toast.onAction?.());
    expect(mockRepo.unmarkSent).toHaveBeenCalledWith({}, 'r1');
    expect(useReportFlow.getState().sent).toBeNull();
  });

  it('marks nothing when the seller backs out, and a retry reuses the same PDF and number', async () => {
    mockShare.file.mockResolvedValueOnce({ status: 'dismissed' }).mockResolvedValueOnce({ status: 'fallback_shared' });
    const { result } = await renderHook(() => useReportSend(period('+919906000999')));
    await act(async () => {
      result.current.send();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(mockRepo.markSent).not.toHaveBeenCalled();
    expect(mockToast.mock.calls[0][0].message).toBe('Not sent. Nothing was marked.');

    await act(async () => {
      result.current.send();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(mockRenderPdf).toHaveBeenCalledTimes(1);
    expect(mockRepo.createReportRecord).toHaveBeenCalledTimes(1);
    expect(mockRepo.markSent).toHaveBeenCalledWith({}, 'r1');
    expect(mockToast.mock.calls[1][0].message).toBe('Shared. Marked as sent ✓');
  });

  it('says so when nothing could share the file', async () => {
    mockShare.file.mockResolvedValue({ status: 'unavailable' });
    const { result } = await renderHook(() => useReportSend(period('+919906000999')));
    await act(async () => {
      result.current.send();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(mockRepo.markSent).not.toHaveBeenCalled();
    expect(mockToast.mock.calls[0][0].message).toBe('Could not open WhatsApp or the share menu. Try again.');
  });
});
