/** Shop details printed on PDFs and cards. */
import type { DbOrTx } from '../types';
import { getSettings } from './settings';

export type ShopInfo = {
  shopName: string;
  sellerName: string;
  sellerCode: string;
  phone: string;
  address: string;
  upiId: string;
  ownerWhatsapp: string;
};

/** Shop details from settings. */
export function getShopInfo(db: DbOrTx): ShopInfo {
  const s = getSettings(db);
  return {
    shopName: s.shopName,
    sellerName: s.sellerName,
    sellerCode: s.sellerCode,
    phone: s.phone,
    address: s.address,
    upiId: s.upiId,
    ownerWhatsapp: s.ownerWhatsapp,
  };
}
