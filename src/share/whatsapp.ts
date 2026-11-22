/**
 * Sending files and texts to WhatsApp (PLAN §7 "How sending to WhatsApp works").
 * Primary path: react-native-share `shareSingle` straight into a chat (WhatsApp or Business).
 * Fallback: the Android share sheet (expo-sharing), with the phone number copied to the
 * clipboard so the seller can paste it. Nothing here throws: every function returns a status.
 */
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import Share, { Social, type ShareSingleOptions } from 'react-native-share';

import { chunk } from '@/pdf/html';
import { toWhatsAppNumber } from '@/lib/phone';

export const WHATSAPP_PACKAGE = 'com.whatsapp';
export const WHATSAPP_BUSINESS_PACKAGE = 'com.whatsapp.w4b';
/** WhatsApp accepts about 30 media per share. */
export const WHATSAPP_MAX_MEDIA = 30;

export type WhatsAppAvailability = { whatsapp: boolean; business: boolean };
export type WhatsAppPreference = 'whatsapp' | 'business' | 'auto';
export type ShareStatus = 'sent' | 'dismissed' | 'fallback_shared' | 'unavailable' | 'error';
export type ShareResult = { status: ShareStatus; error?: string };

/**
 * react-native-share's Android code reads `whatsAppNumber` (opens that chat directly) but its
 * TypeScript types do not declare it yet.
 */
type WhatsAppShareOptions = ShareSingleOptions & { whatsAppNumber?: string };

async function isInstalled(pkg: string): Promise<boolean> {
  try {
    return (await Share.isPackageInstalled(pkg)).isInstalled;
  } catch {
    return false;
  }
}

/** Which WhatsApp apps are installed (needs the <queries> entries set in app.json). */
export async function detectWhatsApp(): Promise<WhatsAppAvailability> {
  const [whatsapp, business] = await Promise.all([isInstalled(WHATSAPP_PACKAGE), isInstalled(WHATSAPP_BUSINESS_PACKAGE)]);
  return { whatsapp, business };
}

/** Picks the app to open, honouring the preference and falling back to the other one. */
export function chooseWhatsAppTarget(available: WhatsAppAvailability, prefer: WhatsAppPreference): 'whatsapp' | 'business' | null {
  const order: ('whatsapp' | 'business')[] = prefer === 'business' ? ['business', 'whatsapp'] : ['whatsapp', 'business'];
  return order.find((app) => available[app]) ?? null;
}

/**
 * "+91 98765-43210" → "919876543210" (WhatsApp wants digits only, no "+").
 * Valid numbers are normalised (India is the default country); otherwise the raw digits are used
 * when they look like an international number. Null when there is nothing usable.
 */
export function whatsAppDigits(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const valid = toWhatsAppNumber(phone);
  if (valid) return valid;
  const digits = phone.replace(/\D/g, '').replace(/^00/, '');
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

/** https://wa.me/<digits>?text=… (or https://wa.me/?text=… to let the user pick a chat). */
export function whatsAppChatUrl(phone: string | null | undefined, text?: string): string {
  const digits = whatsAppDigits(phone) ?? '';
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** react-native-share rejects with this kind of message when the user backs out. */
function isUserCancel(e: unknown): boolean {
  return /cancel|did not share|dismiss/i.test(errorMessage(e));
}

/** Android share sheet + number on the clipboard. */
async function fallbackShare(fileUri: string, mimeType: string, digits: string | null, dialogTitle?: string): Promise<ShareResult> {
  if (digits) {
    try {
      await Clipboard.setStringAsync(`+${digits}`);
    } catch {
      // Clipboard is only a convenience.
    }
  }
  try {
    if (!(await Sharing.isAvailableAsync())) return { status: 'unavailable' };
    await Sharing.shareAsync(fileUri, { mimeType, dialogTitle });
    return { status: 'fallback_shared' };
  } catch (e) {
    return { status: 'error', error: errorMessage(e) };
  }
}

export type ShareFileOptions = {
  /** file:// URI of the PDF or image. */
  fileUri: string;
  /** e.g. 'application/pdf' or 'image/jpeg'. */
  mimeType: string;
  /** Opens this chat directly when given (E.164 or any format with the country code). */
  phoneE164?: string | null;
  /** Caption / pre-filled text. */
  message: string;
  prefer?: WhatsAppPreference;
  /** Title of the Android share sheet used as the fallback. */
  dialogTitle?: string;
  /** Friendly file name shown in WhatsApp. */
  filename?: string;
};

/**
 * Sends one file to WhatsApp, straight into the chat when a phone number is given.
 * 'sent' means WhatsApp opened with the file (we cannot see whether the user pressed send).
 * Falls back to the share sheet ('fallback_shared', number copied) when WhatsApp is missing or fails.
 */
export async function shareFileToWhatsApp(opts: ShareFileOptions): Promise<ShareResult> {
  const digits = whatsAppDigits(opts.phoneE164);
  const target = chooseWhatsAppTarget(await detectWhatsApp(), opts.prefer ?? 'auto');
  if (!target) return fallbackShare(opts.fileUri, opts.mimeType, digits, opts.dialogTitle);

  const options: WhatsAppShareOptions = {
    social: target === 'business' ? Social.Whatsappbusiness : Social.Whatsapp,
    url: opts.fileUri,
    type: opts.mimeType,
    message: opts.message,
    ...(opts.filename ? { filename: opts.filename } : {}),
    ...(digits ? { whatsAppNumber: digits } : {}),
  };
  try {
    const result = await Share.shareSingle(options);
    return { status: result.success ? 'sent' : 'dismissed' };
  } catch (e) {
    if (isUserCancel(e)) return { status: 'dismissed' };
    return fallbackShare(opts.fileUri, opts.mimeType, digits, opts.dialogTitle);
  }
}

export type ShareImagesOptions = {
  /** file:// URIs of the photos. */
  urls: readonly string[];
  phoneE164?: string | null;
  /** Caption sent with the first batch only. */
  message?: string;
  prefer?: WhatsAppPreference;
  mimeType?: string;
};

/**
 * "Also send photos": shares images in batches of 30 (WhatsApp's limit), one batch after another.
 * Stops at the first batch that is not sent. `batchesSent` says how far it got.
 */
export async function shareImagesToWhatsApp(opts: ShareImagesOptions): Promise<ShareResult & { batchesSent: number; batches: number }> {
  const batches = chunk(opts.urls, WHATSAPP_MAX_MEDIA);
  if (batches.length === 0) return { status: 'sent', batchesSent: 0, batches: 0 };
  const target = chooseWhatsAppTarget(await detectWhatsApp(), opts.prefer ?? 'auto');
  if (!target) return { status: 'unavailable', batchesSent: 0, batches: batches.length };
  const digits = whatsAppDigits(opts.phoneE164);

  let sent = 0;
  for (const batch of batches) {
    const options: WhatsAppShareOptions = {
      social: target === 'business' ? Social.Whatsappbusiness : Social.Whatsapp,
      urls: batch,
      type: opts.mimeType ?? 'image/jpeg',
      ...(sent === 0 && opts.message ? { message: opts.message } : {}),
      ...(digits ? { whatsAppNumber: digits } : {}),
    };
    try {
      const result = await Share.shareSingle(options);
      if (!result.success) return { status: 'dismissed', batchesSent: sent, batches: batches.length };
      sent++;
    } catch (e) {
      return isUserCancel(e)
        ? { status: 'dismissed', batchesSent: sent, batches: batches.length }
        : { status: 'error', error: errorMessage(e), batchesSent: sent, batches: batches.length };
    }
  }
  return { status: 'sent', batchesSent: sent, batches: batches.length };
}

/**
 * Opens a WhatsApp chat with pre-filled text (follow-ups, quick replies). Text only, no file.
 * Returns false when nothing could open the link.
 */
export async function openWhatsAppChat(phone: string | null | undefined, text: string): Promise<boolean> {
  try {
    await Linking.openURL(whatsAppChatUrl(phone, text));
    return true;
  } catch {
    return false;
  }
}
