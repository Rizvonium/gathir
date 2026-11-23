/**
 * Cold start after Android closed Gathir while the camera or gallery was open from a product
 * wizard: reopens that wizard, so the picked photo and the typed draft come back together
 * (useProductWizard restores the draft from the marker and adds the photo). Mount once in the
 * root layout.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';

import { editProductHref } from '../logic/links';
import { NEW_DRAFT_KEY } from '../store/draftStore';
import { readPendingPick } from '../logic/pendingPick';

export function usePendingPickRouting(): void {
  useEffect(() => {
    const marker = readPendingPick();
    if (!marker) return;
    if (marker.key === NEW_DRAFT_KEY) router.push('/product/new');
    else if (marker.productId) router.push(editProductHref(marker.productId));
  }, []);
}
