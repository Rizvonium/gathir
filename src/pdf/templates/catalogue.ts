/**
 * Customer catalogue PDF (PLAN §6): a boutique lookbook on A4 portrait.
 * Cover → product pages (2×2 or 3×2 cards that never split) → "How to order" page,
 * with the shop name and "Page n of N" in every footer. Never shows cost price or history.
 */
import type { TFunction } from 'i18next';

import { formatDate } from '@/lib/dates';
import { formatINR, formatNumber } from '@/lib/money';
import { formatPhoneInternational } from '@/lib/phone';

import { escapeHtml, escapeMultiline, joinParts } from '../html';
import { paginateCatalogue, visibleCatalogueItems, type CataloguePage } from '../paginate';
import { botehBorderSvg, hashSeed, kaniCornerSvg, patternPalettes, sozniVineSvg } from '../patterns';
import { pdfDir, pdfLang, pdfT } from '../strings';
import { htmlDocument } from '../styles/base';
import { catalogueCss } from '../styles/catalogue';
import type { CatalogueDoc, CatalogueDocOptions, CatalogueItemDoc } from '../types';
import { colourDot, photoOrPlaceholder } from './fragments';

/** Availability tag shown on a card, or null when nothing should be said. */
export type AvailabilityTag = { kind: 'available' | 'few' | 'count' | 'sold_out'; text: string };

/** Decides the availability tag from the item and the catalogue options. */
export function availabilityTag(item: CatalogueItemDoc, options: CatalogueDocOptions, t: TFunction): AvailabilityTag {
  const a = item.availability;
  if (a.kind === 'sold_out') return { kind: 'sold_out', text: t('card.soldOut') };
  if (options.showExactCounts && item.totalPieces !== null) {
    return {
      kind: a.kind === 'few' ? 'few' : 'count',
      text: t('card.pieces', { count: item.totalPieces, n: formatNumber(item.totalPieces) }),
    };
  }
  if (a.kind === 'few' && options.showOnlyLeft) {
    return { kind: 'few', text: t('card.onlyLeft', { count: a.count, n: formatNumber(a.count) }) };
  }
  return { kind: 'available', text: t('card.available') };
}

type Ctx = { doc: CatalogueDoc; t: TFunction; total: number; seed: number; shopName: string; title: string };

function footer(ctx: Ctx, pageNumber: number): string {
  const vine =
    ctx.doc.options.style === 'bazaar'
      ? `<div class="vine">${sozniVineSvg({ seed: ctx.seed + 7, width: 240, height: 16, palette: patternPalettes.bazaar })}</div>`
      : '';
  const page = escapeHtml(ctx.t('footer.page', { page: pageNumber, total: ctx.total }));
  return `<footer class="foot"><span class="shop">${escapeHtml(ctx.shopName)}</span>${vine}<span class="num">${page}</span></footer>`;
}

function swatches(item: CatalogueItemDoc, options: CatalogueDocOptions, t: TFunction): string {
  const list = item.colours.filter((c) => c.pieces === null || c.pieces > 0);
  if (list.length === 0) return '';
  const items = list
    .map((c) => {
      const counted = options.showExactCounts && c.pieces !== null;
      const label = counted ? t('card.colourCount', { name: c.name, n: formatNumber(c.pieces ?? 0) }) : c.name;
      return `<span class="sw${counted ? ' counted' : ''}" title="${escapeHtml(c.name)}">${colourDot(c.hex)}<span class="lbl">${escapeHtml(label)}</span></span>`;
    })
    .join('');
  return `<div class="swatches">${items}</div>`;
}

function photo(item: CatalogueItemDoc, style: CatalogueDocOptions['style']): string {
  const code = item.code.trim() ? `<span class="code">${escapeHtml(item.code)}</span>` : '';
  const art = photoOrPlaceholder({
    dataUri: item.photoDataUri,
    name: item.name,
    seedKey: item.id,
    palette: patternPalettes[style],
    width: 180,
    height: 240,
  });
  return `<div class="photo">${art}${code}</div>`;
}

function card(item: CatalogueItemDoc, ctx: Ctx): string {
  const { options } = ctx.doc;
  const tag = availabilityTag(item, options, ctx.t);
  const showRate = options.showRates && item.ratePaise !== null;
  const rate = showRate ? `<span class="rate num">${escapeHtml(formatINR(item.ratePaise ?? 0))}</span>` : '';
  const special = showRate && item.specialPrice ? `<p class="special">${escapeHtml(ctx.t('card.specialPrice'))}</p>` : '';
  const meta = joinParts([item.craft, item.material, item.size]);
  return (
    `<article class="card">${photo(item, options.style)}<div class="body">` +
    `<h3 class="name">${escapeHtml(item.name)}</h3>` +
    (meta ? `<p class="meta">${escapeHtml(meta)}</p>` : '') +
    swatches(item, options, ctx.t) +
    special +
    `<div class="foot-row">${rate}<span class="tag ${tag.kind}">${escapeHtml(tag.text)}</span></div>` +
    `</div></article>`
  );
}

function terms(ctx: Ctx): string {
  const parts: string[] = [];
  if (ctx.doc.ratesValidTill) parts.push(ctx.t('cover.ratesValidTill', { date: formatDate(ctx.doc.ratesValidTill) }));
  if (ctx.doc.discountLine?.trim()) parts.push(ctx.doc.discountLine.trim());
  return parts.length ? `<div class="terms">${parts.map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : '';
}

function coverPage(ctx: Ctx, itemCount: number): string {
  const { doc, t } = ctx;
  const bazaar = doc.options.style === 'bazaar';
  const dateParts = [formatDate(doc.generatedAt)];
  if (doc.part && doc.part.total > 1) dateParts.push(t('cover.part', { index: doc.part.index, total: doc.part.total }));
  const customer = doc.customerName?.trim();
  const note = doc.personalNote?.trim();
  const phone = doc.shop.phone.trim() ? t('cover.whatsapp', { phone: formatPhoneInternational(doc.shop.phone) }) : '';

  const decoration = bazaar
    ? `<div class="frame">${botehBorderSvg({ seed: ctx.seed, width: 544, height: 770, palette: patternPalettes.bazaar, band: 40 })}</div>`
    : ['tl', 'tr', 'bl', 'br']
        .map((pos) => `<div class="corner ${pos}">${kaniCornerSvg({ seed: ctx.seed, size: 120, palette: patternPalettes.ivory })}</div>`)
        .join('');
  const divider = bazaar
    ? `<div class="divider">${sozniVineSvg({ seed: ctx.seed + 3, width: 260, height: 32, palette: patternPalettes.bazaar })}</div>`
    : '<div class="rule"></div>';

  return (
    `<section class="page cover">${decoration}<div class="inner">` +
    `<p class="dateline num">${escapeHtml(joinParts(dateParts))}</p>` +
    `<h1 class="shopname">${escapeHtml(ctx.shopName)}</h1>${divider}` +
    `<h2 class="collection">${escapeHtml(ctx.title)}</h2>` +
    `<p class="count num">${escapeHtml(t('cover.designs', { count: itemCount, n: formatNumber(itemCount) }))}</p>` +
    (customer ? `<p class="for">${escapeHtml(t('cover.preparedFor', { name: customer }))}</p>` : '') +
    (note ? `<p class="note">${escapeMultiline(note)}</p>` : '') +
    terms(ctx) +
    `<div class="seller">` +
    (doc.shop.sellerName.trim() ? `<p><strong>${escapeHtml(doc.shop.sellerName)}</strong></p>` : '') +
    (phone ? `<p class="num">${escapeHtml(phone)}</p>` : '') +
    (doc.shop.address.trim() ? `<p class="addr">${escapeMultiline(doc.shop.address)}</p>` : '') +
    `</div></div>${footer(ctx, 1)}</section>`
  );
}

function productPage(ctx: Ctx, page: Extract<CataloguePage<CatalogueItemDoc>, { kind: 'products' }>): string {
  return (
    `<section class="page products">` +
    `<header class="head"><span class="shop">${escapeHtml(ctx.shopName)}</span><span class="title">${escapeHtml(ctx.title)}</span></header>` +
    `<div class="grid">${page.items.map((i) => card(i, ctx)).join('')}</div>` +
    `${footer(ctx, page.pageNumber)}</section>`
  );
}

function orderPage(ctx: Ctx, pageNumber: number): string {
  const { doc, t } = ctx;
  const upi = doc.shop.upiId.trim();
  const rows: string[] = [];
  if (doc.shop.phone.trim()) {
    rows.push(`<dt>${escapeHtml(t('order.whatsapp'))}</dt><dd class="num">${escapeHtml(formatPhoneInternational(doc.shop.phone))}</dd>`);
  }
  if (upi) rows.push(`<dt>${escapeHtml(t('order.upi'))}</dt><dd>${escapeHtml(upi)}</dd>`);
  if (doc.shop.address.trim()) rows.push(`<dt>${escapeHtml(t('order.address'))}</dt><dd class="addr">${escapeMultiline(doc.shop.address)}</dd>`);

  const steps = [t('order.steps.choose'), t('order.steps.message'), upi ? t('order.steps.payUpi') : t('order.steps.pay')];
  const valid: string[] = [];
  if (doc.ratesValidTill) valid.push(t('order.ratesValidTill', { date: formatDate(doc.ratesValidTill) }));
  if (doc.discountLine?.trim()) valid.push(doc.discountLine.trim());
  const vine =
    doc.options.style === 'bazaar'
      ? `<div class="vine">${sozniVineSvg({ seed: ctx.seed + 11, width: 240, height: 30, palette: patternPalettes.bazaar })}</div>`
      : '';

  return (
    `<section class="page order"><div class="inner">` +
    `<h2>${escapeHtml(t('order.title'))}</h2><p class="lead">${escapeHtml(t('order.lead'))}</p>` +
    `<ol>${steps.map((s, i) => `<li><span class="step num">${i + 1}</span><span>${escapeHtml(s)}</span></li>`).join('')}</ol>` +
    (rows.length ? `<dl class="contact">${rows.join('')}</dl>` : '') +
    (valid.length ? `<div class="valid">${valid.map((v) => `<p>${escapeHtml(v)}</p>`).join('')}</div>` : '') +
    `<div class="thanks">${vine}<p>${escapeHtml(t('order.thanks'))}</p>` +
    `<span class="sign">${escapeHtml(t('order.signoff', { shop: ctx.shopName }))}</span></div>` +
    `</div>${footer(ctx, pageNumber)}</section>`
  );
}

/** Renders the whole catalogue as one HTML document for expo-print (A4, 595×842 pt). */
export function renderCatalogueHtml(doc: CatalogueDoc): string {
  const t = pdfT('catalogue');
  const items = visibleCatalogueItems(doc.items, doc.options);
  const { pages, total } = paginateCatalogue(items, doc.options.columns);
  const shopName = doc.shop.shopName.trim();
  const title = doc.title.trim() || t('cover.defaultTitle');
  const ctx: Ctx = { doc, t, total, seed: hashSeed(`${shopName}|${title}`), shopName, title };

  const body = pages
    .map((p) => {
      if (p.kind === 'cover') return coverPage(ctx, items.length);
      if (p.kind === 'products') return productPage(ctx, p);
      return orderPage(ctx, p.pageNumber);
    })
    .join('');

  return htmlDocument({
    lang: pdfLang(),
    dir: pdfDir(),
    title: escapeHtml(t('docTitle', { shop: shopName, title })),
    fontCss: doc.fontCss,
    css: catalogueCss,
    body: `<main class="s-${doc.options.style} c${doc.options.columns}">${body}</main>`,
  });
}
