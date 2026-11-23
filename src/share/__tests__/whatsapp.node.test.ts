const mockIsInstalled = jest.fn();
const mockShareSingle = jest.fn();
const mockShareAsync = jest.fn();
const mockIsAvailable = jest.fn();
const mockSetString = jest.fn();
const mockOpenURL = jest.fn();

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { isPackageInstalled: (p: string) => mockIsInstalled(p), shareSingle: (o: unknown) => mockShareSingle(o) },
  Social: { Whatsapp: 'whatsapp', Whatsappbusiness: 'whatsappbusiness' },
}));
jest.mock('expo-sharing', () => ({ shareAsync: (...a: unknown[]) => mockShareAsync(...a), isAvailableAsync: () => mockIsAvailable() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: (s: string) => mockSetString(s) }));
const mockAppStateListeners = new Set<(s: string) => void>();
jest.mock('react-native', () => ({
  Linking: { openURL: (u: string) => mockOpenURL(u) },
  AppState: {
    addEventListener: (_: string, fn: (s: string) => void) => {
      mockAppStateListeners.add(fn);
      return { remove: () => mockAppStateListeners.delete(fn) };
    },
  },
}));
const appState = (s: string) => [...mockAppStateListeners].forEach((fn) => fn(s));
/** What Android really does: WhatsApp comes up (Gathir goes to the background), and shareSingle resolves at once. */
const launchesWhatsApp = (backAfterMs: number | null = 0) => async () => {
  appState('background');
  if (backAfterMs !== null) setTimeout(() => appState('active'), backAfterMs);
  return { success: true, message: 'OK' };
};
jest.mock('expo-file-system', () => require('@/lib/__tests__/fakeFileSystem'));

import { File } from 'expo-file-system';

import { listFiles, resetFakeFs } from '@/lib/__tests__/fakeFileSystem';
import { photosDir } from '@/lib/files';

import {
  LEAVE_TIMEOUT_MS,
  chooseWhatsAppTarget,
  detectWhatsApp,
  openWhatsAppChat,
  shareFileToWhatsApp,
  shareImagesToWhatsApp,
  whatsAppChatUrl,
  whatsAppDigits,
} from '../whatsapp';

const installed = (apps: string[]) => mockIsInstalled.mockImplementation((p: string) => Promise.resolve({ isInstalled: apps.includes(p), message: '' }));
const file = { fileUri: 'file:///cache/exports/Report.pdf', mimeType: 'application/pdf', message: 'PDF attached.' };

beforeEach(() => {
  jest.clearAllMocks();
  resetFakeFs();
  mockAppStateListeners.clear();
  mockShareSingle.mockImplementation(launchesWhatsApp());
  mockIsAvailable.mockResolvedValue(true);
  mockShareAsync.mockResolvedValue(undefined);
  mockSetString.mockResolvedValue(true);
  mockOpenURL.mockResolvedValue(true);
});

describe('phone and links', () => {
  it('turns phones into WhatsApp digits', () => {
    expect(whatsAppDigits('+91 98765-43210')).toBe('919876543210');
    expect(whatsAppDigits('98765 43210')).toBe('919876543210');
    expect(whatsAppDigits('+44 7400 123456')).toBe('447400123456');
    expect(whatsAppDigits('')).toBeNull();
    expect(whatsAppDigits('123')).toBeNull();
  });
  it('builds wa.me links with encoded text', () => {
    expect(whatsAppChatUrl('+919876543210', 'Namaste & hi')).toBe('https://wa.me/919876543210?text=Namaste%20%26%20hi');
    expect(whatsAppChatUrl(null, 'Hi')).toBe('https://wa.me/?text=Hi');
  });
  it('opens a chat and reports failure without throwing', async () => {
    await expect(openWhatsAppChat('+919876543210', 'Hi')).resolves.toBe(true);
    expect(mockOpenURL).toHaveBeenCalledWith('https://wa.me/919876543210?text=Hi');
    mockOpenURL.mockRejectedValueOnce(new Error('no handler'));
    await expect(openWhatsAppChat('+919876543210', 'Hi')).resolves.toBe(false);
  });
});

describe('detection', () => {
  it('detects both apps and survives errors', async () => {
    installed(['com.whatsapp.w4b']);
    await expect(detectWhatsApp()).resolves.toEqual({ whatsapp: false, business: true });
    mockIsInstalled.mockRejectedValue(new Error('boom'));
    await expect(detectWhatsApp()).resolves.toEqual({ whatsapp: false, business: false });
  });
  it('honours the preference with fallback', () => {
    expect(chooseWhatsAppTarget({ whatsapp: true, business: true }, 'auto')).toBe('whatsapp');
    expect(chooseWhatsAppTarget({ whatsapp: true, business: true }, 'business')).toBe('business');
    expect(chooseWhatsAppTarget({ whatsapp: true, business: false }, 'business')).toBe('whatsapp');
    expect(chooseWhatsAppTarget({ whatsapp: false, business: false }, 'auto')).toBeNull();
  });
});

describe('shareFileToWhatsApp', () => {
  it('opens the chat directly with digits only', async () => {
    installed(['com.whatsapp']);
    await expect(shareFileToWhatsApp({ ...file, phoneE164: '+919876543210' })).resolves.toEqual({ status: 'sent' });
    expect(mockShareSingle).toHaveBeenCalledWith(
      expect.objectContaining({ social: 'whatsapp', url: file.fileUri, type: 'application/pdf', message: 'PDF attached.', whatsAppNumber: '919876543210' }),
    );
  });
  it('uses WhatsApp Business when preferred', async () => {
    installed(['com.whatsapp', 'com.whatsapp.w4b']);
    await shareFileToWhatsApp({ ...file, prefer: 'business' });
    expect(mockShareSingle).toHaveBeenCalledWith(expect.objectContaining({ social: 'whatsappbusiness' }));
    expect(mockShareSingle.mock.calls[0][0]).not.toHaveProperty('whatsAppNumber');
  });
  it('reports a cancelled share as dismissed', async () => {
    installed(['com.whatsapp']);
    mockShareSingle.mockRejectedValue(new Error('User did not share'));
    await expect(shareFileToWhatsApp(file)).resolves.toEqual({ status: 'dismissed' });
    expect(mockShareAsync).not.toHaveBeenCalled();
  });
  it('falls back to the share sheet and copies the number when WhatsApp fails', async () => {
    installed(['com.whatsapp']);
    mockShareSingle.mockRejectedValue(new Error('ActivityNotFound'));
    await expect(shareFileToWhatsApp({ ...file, phoneE164: '+919876543210' })).resolves.toEqual({ status: 'fallback_shared' });
    expect(mockSetString).toHaveBeenCalledWith('+919876543210');
    expect(mockShareAsync).toHaveBeenCalledWith(file.fileUri, expect.objectContaining({ mimeType: 'application/pdf' }));
  });
  it('falls back when WhatsApp is not installed, and reports unavailable/error', async () => {
    installed([]);
    await expect(shareFileToWhatsApp(file)).resolves.toEqual({ status: 'fallback_shared' });
    expect(mockShareSingle).not.toHaveBeenCalled();
    mockIsAvailable.mockResolvedValue(false);
    await expect(shareFileToWhatsApp(file)).resolves.toEqual({ status: 'unavailable' });
    mockIsAvailable.mockResolvedValue(true);
    mockShareAsync.mockRejectedValue(new Error('denied'));
    await expect(shareFileToWhatsApp(file)).resolves.toEqual({ status: 'error', error: 'denied' });
  });
});

describe('shareImagesToWhatsApp', () => {
  it('sends photos in batches of 30 with the caption on the first batch', async () => {
    installed(['com.whatsapp']);
    const urls = Array.from({ length: 65 }, (_, i) => `file:///cache/p${i}.jpg`);
    await expect(shareImagesToWhatsApp({ urls, message: 'Sold today', phoneE164: '+919876543210' })).resolves.toEqual({
      status: 'sent',
      batchesSent: 3,
      batches: 3,
    });
    const calls = mockShareSingle.mock.calls.map((c) => c[0] as { urls: string[]; message?: string });
    expect(calls.map((c) => c.urls.length)).toEqual([30, 30, 5]);
    expect(calls[0].message).toBe('Sold today');
    expect(calls[1].message).toBeUndefined();
  });
  it('stops at the first dismissed batch', async () => {
    installed(['com.whatsapp']);
    mockShareSingle.mockImplementationOnce(launchesWhatsApp()).mockRejectedValueOnce(new Error('User did not share'));
    const urls = Array.from({ length: 40 }, (_, i) => `file:///cache/p${i}.jpg`);
    await expect(shareImagesToWhatsApp({ urls })).resolves.toEqual({ status: 'dismissed', batchesSent: 1, batches: 2 });
  });
  it('copies app photos (documents folder, not served by the share FileProvider) into the cache first', async () => {
    installed(['com.whatsapp']);
    await new File(photosDir(), 'p1.jpg').write(new Uint8Array([1, 2, 3]));
    await expect(shareImagesToWhatsApp({ urls: ['file:///doc/photos/p1.jpg', 'file:///cache/exports/card.jpg'] })).resolves.toMatchObject({ status: 'sent' });
    const sent = (mockShareSingle.mock.calls[0][0] as { urls: string[] }).urls;
    expect(sent).toEqual(['file:///cache/exports/share-p1.jpg', 'file:///cache/exports/card.jpg']);
    expect(sent.every((u) => u.startsWith('file:///cache/'))).toBe(true);
    expect([...(await new File(sent[0]).bytes())]).toEqual([1, 2, 3]);
    // The original photo stays where it was.
    expect(listFiles('file:///doc/')).toEqual(['file:///doc/photos/p1.jpg']);
  });
  it('copies a file outside the cache (e.g. a card in the external cache) before sharing it', async () => {
    installed(['com.whatsapp']);
    await new File(photosDir(), 'card.jpg').write(new Uint8Array([9]));
    await shareFileToWhatsApp({ ...file, fileUri: 'file:///doc/photos/card.jpg', mimeType: 'image/jpeg' });
    expect((mockShareSingle.mock.calls[0][0] as { url: string }).url).toBe('file:///cache/exports/share-card.jpg');
    // A missing file is an error, never a null attachment.
    await expect(shareImagesToWhatsApp({ urls: ['file:///doc/photos/gone.jpg'] })).resolves.toMatchObject({ status: 'error' });
  });
  it('is unavailable without WhatsApp and trivially done with no photos', async () => {
    installed([]);
    await expect(shareImagesToWhatsApp({ urls: ['file:///cache/a.jpg'] })).resolves.toMatchObject({ status: 'unavailable' });
    await expect(shareImagesToWhatsApp({ urls: [] })).resolves.toMatchObject({ status: 'sent', batches: 0 });
  });
});

describe('waiting for the seller to come back', () => {
  const flush = () => new Promise((r) => setImmediate(r));

  it('does not report a file as sent while the seller is still in WhatsApp', async () => {
    installed(['com.whatsapp']);
    mockShareSingle.mockImplementation(launchesWhatsApp(null));
    let done: unknown = null;
    const p = shareFileToWhatsApp(file).then((r) => (done = r));
    for (let i = 0; i < 5; i++) await flush();
    expect(mockShareSingle).toHaveBeenCalledTimes(1);
    expect(done).toBeNull();
    appState('active');
    await p;
    expect(done).toEqual({ status: 'sent' });
    expect(mockAppStateListeners.size).toBe(0);
  });

  it('opens the next photo batch only after the seller is back from the previous one', async () => {
    installed(['com.whatsapp']);
    mockShareSingle.mockImplementation(launchesWhatsApp(null));
    const urls = Array.from({ length: 40 }, (_, i) => `file:///cache/p${i}.jpg`);
    let done: unknown = null;
    const p = shareImagesToWhatsApp({ urls }).then((r) => (done = r));
    for (let i = 0; i < 5; i++) await flush();
    expect(mockShareSingle).toHaveBeenCalledTimes(1);
    appState('active');
    for (let i = 0; i < 5; i++) await flush();
    expect(mockShareSingle).toHaveBeenCalledTimes(2);
    expect(done).toBeNull();
    appState('active');
    await p;
    expect(done).toEqual({ status: 'sent', batchesSent: 2, batches: 2 });
  });

  it('does not wait forever when WhatsApp never came to the front', async () => {
    jest.useFakeTimers();
    try {
      installed(['com.whatsapp']);
      mockShareSingle.mockResolvedValue({ success: true, message: 'OK' });
      const p = shareFileToWhatsApp(file);
      await jest.advanceTimersByTimeAsync(LEAVE_TIMEOUT_MS + 10);
      await expect(p).resolves.toEqual({ status: 'sent' });
      expect(mockAppStateListeners.size).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('never hands WhatsApp a URI its FileProvider cannot serve', async () => {
    installed(['com.whatsapp']);
    await expect(shareImagesToWhatsApp({ urls: ['https://example.com/a.jpg'] })).resolves.toMatchObject({ status: 'error', batchesSent: 0 });
    await expect(shareFileToWhatsApp({ ...file, fileUri: '' })).resolves.toMatchObject({ status: 'error' });
    expect(mockShareSingle).not.toHaveBeenCalled();
  });
});
