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
jest.mock('react-native', () => ({ Linking: { openURL: (u: string) => mockOpenURL(u) } }));

import {
  chooseWhatsAppTarget,
  detectWhatsApp,
  openWhatsAppChat,
  shareFileToWhatsApp,
  shareImagesToWhatsApp,
  whatsAppChatUrl,
  whatsAppDigits,
} from '../whatsapp';

const installed = (apps: string[]) => mockIsInstalled.mockImplementation((p: string) => Promise.resolve({ isInstalled: apps.includes(p), message: '' }));
const file = { fileUri: 'file:///exports/Report.pdf', mimeType: 'application/pdf', message: 'PDF attached.' };

beforeEach(() => {
  jest.clearAllMocks();
  mockShareSingle.mockResolvedValue({ success: true, message: 'OK' });
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
    const urls = Array.from({ length: 65 }, (_, i) => `file:///p${i}.jpg`);
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
    mockShareSingle.mockResolvedValueOnce({ success: true, message: '' }).mockRejectedValueOnce(new Error('User did not share'));
    const urls = Array.from({ length: 40 }, (_, i) => `file:///p${i}.jpg`);
    await expect(shareImagesToWhatsApp({ urls })).resolves.toEqual({ status: 'dismissed', batchesSent: 1, batches: 2 });
  });
  it('is unavailable without WhatsApp and trivially done with no photos', async () => {
    installed([]);
    await expect(shareImagesToWhatsApp({ urls: ['file:///a.jpg'] })).resolves.toMatchObject({ status: 'unavailable' });
    await expect(shareImagesToWhatsApp({ urls: [] })).resolves.toMatchObject({ status: 'sent', batches: 0 });
  });
});
