/**
 * HTML → PDF on the phone with expo-print, then moved into the shared exports folder
 * (`<cache>/exports`, see src/lib/files.ts; cleaned after 24 h) with a friendly
 * name so WhatsApp shows "Catalogue - Kashmir Looms - 22 Nov 2026.pdf" instead of a random id.
 */
import { Directory, File } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';

import { exportsDir } from '@/lib/files';

import { sanitizeFileName } from './fileNames';

/** Re-exported for callers that imported it from '@/pdf'; the single source is src/lib/files.ts. */
export { exportsDir };

/** Paper sizes in PostScript points (1/72 inch), as expo-print expects. */
export const PAGE_SIZES = {
  A4: { width: 595, height: 842 },
  A5: { width: 420, height: 595 },
} as const;
export type PageSizeName = keyof typeof PAGE_SIZES;

export type RenderPdfOptions = {
  /** Name without extension; sanitised here. See ./fileNames.ts for the standard names. */
  fileBaseName: string;
  /** Default 'A4'. Bills use 'A5'. */
  page?: PageSizeName;
};

export type RenderedPdf = { uri: string; sizeBytes: number; pages: number | null };

/** First free "<base>.pdf", "<base> (2).pdf", … inside `dir`. */
export function uniqueFile(dir: Directory, base: string, extension: string): File {
  let candidate = new File(dir, `${base}.${extension}`);
  for (let i = 2; candidate.exists && i < 1000; i++) {
    candidate = new File(dir, `${base} (${i}).${extension}`);
  }
  return candidate;
}

/**
 * Prints `html` to a PDF and moves it into the exports folder with a friendly name.
 * Throws if printing fails; if only the move fails, the printed file in cache is returned.
 */
export async function renderPdf(html: string, options: RenderPdfOptions): Promise<RenderedPdf> {
  const size = PAGE_SIZES[options.page ?? 'A4'];
  const printed = await printToFileAsync({ html, width: size.width, height: size.height, base64: false });
  const source = new File(printed.uri);
  const pages = Number.isFinite(printed.numberOfPages) && printed.numberOfPages > 0 ? printed.numberOfPages : null;
  try {
    const target = uniqueFile(exportsDir(), sanitizeFileName(options.fileBaseName), 'pdf');
    source.moveSync(target);
    return { uri: target.uri, sizeBytes: target.size, pages };
  } catch {
    return { uri: source.uri, sizeBytes: source.size, pages };
  }
}
