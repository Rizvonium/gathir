/** Route builders for links out of the stock feature (ROUTE CONTRACT paths only). */
import type { Href } from 'expo-router';

type ColourLike = { id: string; pieces: number };

/**
 * Sell sheet for a product. Pre-picks the colour when exactly one colour has pieces left
 * (one tap fewer); otherwise the sheet asks.
 */
export function sellHref(productId: string, colours: readonly ColourLike[], colourId?: string): Href {
  const inStock = colours.filter((c) => c.pieces > 0);
  const picked = colourId ?? (inStock.length === 1 ? inStock[0].id : undefined);
  const params: Record<string, string> = picked ? { productId, colourId: picked } : { productId };
  return { pathname: '/sell', params } as unknown as Href;
}

/** Catalogue flow with these products pre-picked. */
export function catalogueHref(productIds: readonly string[]): Href {
  return { pathname: '/catalogue', params: { productIds: productIds.join(',') } } as unknown as Href;
}

/** Product card image for one product. */
export function productCardHref(productId: string): Href {
  return { pathname: '/catalogue/card', params: { productId } } as unknown as Href;
}

export function productHref(productId: string): Href {
  return { pathname: '/product/[id]', params: { id: productId } } as unknown as Href;
}

export function editProductHref(productId: string): Href {
  return { pathname: '/product/[id]/edit', params: { id: productId } } as unknown as Href;
}

export function saleHref(saleId: string): Href {
  return { pathname: '/sale/[id]', params: { id: saleId } } as unknown as Href;
}
