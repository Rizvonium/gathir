import type { CatalogueData } from '@/db/repo/reports';

import { CATALOGUE_PHOTO, catalogueDocFromData, cataloguePhotoNames, loadPhotoMap } from '../adapters';
import { renderCatalogueHtml } from '../templates/catalogue';
import { NOW, TINY_JPEG } from './fixtures';

const data: CatalogueData = {
  shop: { shopName: 'Kashmir Looms', sellerName: 'Bilal', sellerCode: 'S1', phone: '+919876543210', address: '', upiId: '', ownerWhatsapp: '' },
  generatedAt: NOW,
  options: { hideSoldOut: true, showRates: false, showCounts: false },
  products: [
    {
      id: 'p1',
      code: 'GTH-0001',
      name: 'Sozni Stole',
      categoryName: null,
      craft: 'Sozni',
      material: 'Pashmina',
      size: '',
      ratePaise: null,
      totalPieces: null,
      availability: { kind: 'few', count: 1 },
      colours: [{ name: 'Red', hex: '#C0262D', pieces: null }],
      cover: { fileName: 'a.jpg', thumbName: 'a_t.jpg' },
      photoFileNames: ['a.jpg'],
    },
    {
      id: 'p2',
      code: 'GTH-0002',
      name: 'Kani Shawl',
      categoryName: null,
      craft: 'Kani',
      material: '',
      size: '',
      ratePaise: null,
      totalPieces: null,
      availability: { kind: 'available' },
      colours: [],
      cover: { fileName: 'missing.jpg', thumbName: 'm_t.jpg' },
      photoFileNames: ['missing.jpg'],
    },
  ],
};

describe('adapters', () => {
  it('loads photos at catalogue size and tolerates missing ones', async () => {
    const loader = jest.fn((name: string) => (name === 'a.jpg' ? Promise.resolve(TINY_JPEG) : Promise.reject(new Error('gone'))));
    const photos = await loadPhotoMap([...cataloguePhotoNames(data), 'a.jpg', null], loader, CATALOGUE_PHOTO);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenCalledWith('a.jpg', 800, 0.72);
    expect(photos.get('a.jpg')).toBe(TINY_JPEG);
    expect(photos.has('missing.jpg')).toBe(false);

    const doc = catalogueDocFromData(data, { title: 'Winter', layout: { style: 'ivory', columns: 3, showOnlyLeft: true } }, photos);
    expect(doc.options).toEqual({ showRates: false, showExactCounts: false, hideSoldOut: true, style: 'ivory', columns: 3, showOnlyLeft: true });
    expect(doc.items[0].photoDataUri).toBe(TINY_JPEG);
    expect(doc.items[1].photoDataUri).toBeNull();
    const html = renderCatalogueHtml(doc);
    expect(html).toContain('Only 1 left');
    expect(html).not.toContain('₹');
  });
});
