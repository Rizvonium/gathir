/** Public API of the PDF module. Templates are pure; render/fonts touch the device. */
export * from './types';
export { escapeHtml, escapeMultiline, initials, chunk } from './html';
export { renderCatalogueHtml, availabilityTag } from './templates/catalogue';
export { renderOwnerReportHtml } from './templates/ownerReport';
export { renderBillHtml } from './templates/bill';
export { itemsPerPage, paginateCatalogue, visibleCatalogueItems } from './paginate';
export { botehBorderSvg, sozniVineSvg, kaniCornerSvg, placeholderSvg, mulberry32, hashSeed, patternPalettes } from './patterns';
export { getPdfFontCss, clearPdfFontCache, buildFontFaceCss } from './fonts';
export { renderPdf, exportsDir, PAGE_SIZES } from './render';
export { estimateCatalogueSize, splitForSize, formatBytes, MAX_ITEMS_PER_PART } from './size';
export { sanitizeFileName, catalogueFileBaseName, ownerReportFileBaseName, billFileBaseName, productCardFileBaseName } from './fileNames';
export { ownerReportMessage, catalogueMessage, billMessage } from './text';
export {
  catalogueDocFromData,
  billDocFromSale,
  ownerReportDocFromData,
  cataloguePhotoNames,
  ownerReportPhotoNames,
  loadPhotoMap,
  pdfShopFrom,
  CATALOGUE_PHOTO,
  REPORT_THUMB,
} from './adapters';
export type { PhotoLoader, CatalogueExtras } from './adapters';
