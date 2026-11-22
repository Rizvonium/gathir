import { escapeHtml, initials, safeImageSrc } from '../html';
import { itemsPerPage, paginateCatalogue } from '../paginate';
import { renderCatalogueHtml } from '../templates/catalogue';
import { catalogue, item } from './fixtures';

const pageCount = (html: string) => (html.match(/<section class="page /g) ?? []).length;

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&\`</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&#96;&lt;/a&gt;');
  });
  it('handles null, numbers and plain text', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml('Sozni stole')).toBe('Sozni stole');
  });
  it('only lets image data URIs through as photo sources', () => {
    expect(safeImageSrc('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA');
    expect(safeImageSrc('javascript:alert(1)')).toBeNull();
    expect(safeImageSrc('file:///etc/passwd')).toBeNull();
  });
  it('makes initials', () => {
    expect(initials('Sozni stole')).toBe('SS');
    expect(initials('pashmina')).toBe('PA');
    expect(initials('  ')).toBe('');
  });
});

describe('pagination', () => {
  it('puts 4 cards per page for 2 columns and 6 for 3 columns', () => {
    expect(itemsPerPage(2)).toBe(4);
    expect(itemsPerPage(3)).toBe(6);
  });
  it('lays out cover, product pages and order page with stable numbers', () => {
    const items = Array.from({ length: 9 }, (_, i) => i);
    const { pages, total } = paginateCatalogue(items, 2);
    expect(total).toBe(5); // cover + 3 product pages + order
    expect(pages.map((p) => p.kind)).toEqual(['cover', 'products', 'products', 'products', 'order']);
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4, 5]);
    const product = pages.filter((p) => p.kind === 'products');
    expect(product.map((p) => (p.kind === 'products' ? p.items.length : 0))).toEqual([4, 4, 1]);
    expect(paginateCatalogue(items, 3).total).toBe(4);
    expect(paginateCatalogue([], 2).total).toBe(2);
  });
  it('renders one footer with "Page n of N" on every page', () => {
    const items = Array.from({ length: 7 }, (_, i) => item({ id: `p${i}`, name: `Shawl ${i}` }));
    const html = renderCatalogueHtml(catalogue({ items }));
    expect(pageCount(html)).toBe(4);
    for (let p = 1; p <= 4; p++) expect(html).toContain(`Page ${p} of 4`);
    expect((html.match(/<footer class="foot">/g) ?? []).length).toBe(4);
  });
});

describe('catalogue options', () => {
  it('shows rates in Indian format by default', () => {
    const html = renderCatalogueHtml(catalogue());
    expect(html).toContain('₹6,500');
    expect(html).toContain('₹1,25,000');
  });
  it('hides every rupee amount when rates are off', () => {
    const html = renderCatalogueHtml(catalogue({ options: { ...catalogue().options, showRates: false } }));
    expect(html).not.toContain('₹');
    expect(html).not.toContain('class="rate');
  });
  it('shows "Only n left" or exact counts depending on options', () => {
    const base = catalogue();
    expect(renderCatalogueHtml(base)).toContain('Only 2 left');

    const noFew = renderCatalogueHtml(catalogue({ options: { ...base.options, showOnlyLeft: false } }));
    expect(noFew).not.toContain('Only 2 left');

    const counted = catalogue({
      options: { ...base.options, showExactCounts: true },
      items: [item({ totalPieces: 5, colours: [{ name: 'Red', hex: '#C0262D', pieces: 3 }, { name: 'Beige', hex: '#D8C3A5', pieces: 2 }] })],
    });
    const html = renderCatalogueHtml(counted);
    expect(html).toContain('5 pieces');
    expect(html).toContain('Red 3');
    expect(html).toContain('Beige 2');

    const hiddenCounts = renderCatalogueHtml({ ...counted, options: { ...counted.options, showExactCounts: false } });
    expect(hiddenCounts).not.toContain('5 pieces');
    expect(hiddenCounts).not.toContain('Red 3');
  });
  it('leaves sold-out items out when asked, and tags them otherwise', () => {
    const hidden = renderCatalogueHtml(catalogue());
    expect(hidden).not.toContain('Aari Wrap');
    expect(hidden).toContain('2 designs');
    const shown = renderCatalogueHtml(catalogue({ options: { ...catalogue().options, hideSoldOut: false } }));
    expect(shown).toContain('Aari Wrap');
    expect(shown).toContain('Sold out');
  });
  it('escapes the customer name and all other user text', () => {
    const html = renderCatalogueHtml(
      catalogue({
        customerName: '<script>alert(1)</script>',
        personalNote: 'Line one\n"quoted" & <b>bold</b>',
        discountLine: '<img src=x onerror=alert(1)>',
        items: [item({ name: '<i>Evil</i>' }), item({ id: 'p9', name: 'No photo <x>', photoDataUri: null })],
      }),
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<i>Evil</i>');
    expect(html).toContain('Prepared for &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Line one<br>&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain('&lt;i&gt;Evil&lt;/i&gt;');
  });
  it('draws a pattern placeholder with initials when there is no photo', () => {
    const html = renderCatalogueHtml(catalogue());
    expect(html).toMatch(/<text[^>]*>KS<\/text>/);
  });
  it('supports both styles and both column counts', () => {
    for (const style of ['bazaar', 'ivory'] as const) {
      for (const columns of [2, 3] as const) {
        const html = renderCatalogueHtml(catalogue({ options: { ...catalogue().options, style, columns } }));
        expect(html).toContain(`class="s-${style} c${columns}"`);
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
      }
    }
  });
  it('shows the how-to-order page with WhatsApp, UPI, address and validity', () => {
    const html = renderCatalogueHtml(catalogue());
    expect(html).toContain('How to order');
    expect(html).toContain('+91 98765 43210');
    expect(html).toContain('kashmirlooms@upi');
    expect(html).toContain('Polo View, Srinagar');
    expect(html).toContain('Rates are valid till 30 Nov 2026.');
  });
  it('is deterministic', () => {
    expect(renderCatalogueHtml(catalogue())).toBe(renderCatalogueHtml(catalogue()));
  });
});
