/**
 * Add / Edit product wizard: draft (auto-saved in the draft store), photo picking, step
 * navigation, inline validation and Save. Screens render; this hook decides.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useCategories, useProductDetail } from '@/db/hooks';
import { deletePhotoFiles, pickFromCamera, pickFromGallery, recoverPendingPick, savePhoto, type PickResult } from '@/lib/photos';
import { playHaptic, useToast } from '@/ui/components';

import {
  addPhotos,
  draftFromDetail,
  draftHasContent,
  emptyDraft,
  firstErrorStep,
  hasErrors,
  MAX_DRAFT_PHOTOS,
  resolvedName,
  setStep,
  validateDraft,
  WIZARD_STEPS,
  type DraftPhoto,
  type ProductDraft,
} from '../logic/draft';
import { productHref } from '../logic/links';
import { suggestNames } from '../logic/naming';
import { filesOfDiscardedDraft, saveDraft } from '../logic/saveDraft';
import { draftKeyFor, useDraftStore } from '../store/draftStore';
import { errorKeyOf } from './useStockActions';

/** Delay before a discarded draft's photo files are deleted (covers the Undo toast). */
const DISCARD_GRACE_MS = 9000;

export function useProductWizard(productId: string | undefined) {
  const { t } = useTranslation('stock');
  const toast = useToast();
  const key = draftKeyFor(productId);
  const stored = useDraftStore((s) => s.drafts[key]);
  const put = useDraftStore((s) => s.put);
  const updateStore = useDraftStore((s) => s.update);
  const clear = useDraftStore((s) => s.clear);
  const markSaved = useDraftStore((s) => s.markSaved);
  const detail = useProductDetail(productId);
  const categories = useCategories();
  const [busy, setBusy] = useState<'photos' | 'save' | null>(null);
  const [attempted, setAttempted] = useState(false);

  const editing = productId !== undefined;
  const missing = editing && !detail;

  // No draft is stored until the first change: "new" starts empty, "edit" from the saved
  // values (read fresh until the seller changes something). After Save or Discard nothing
  // re-creates it behind the seller's back.
  const base: ProductDraft | null = stored ?? (editing ? (detail ? draftFromDetail(detail) : null) : emptyDraft());
  const draft: ProductDraft = base ?? emptyDraft();
  const update = (fn: (d: ProductDraft) => ProductDraft) => updateStore(key, fn, draft);

  const categoryName = categories.find((c) => c.id === draft.categoryId)?.name ?? null;
  const suggestions = suggestNames({ craft: draft.craft, material: draft.material, categoryName, size: draft.size });
  const errors = validateDraft(draft, suggestions[0]);
  const visibleErrors = attempted ? errors : {};

  const addPicked = async (result: PickResult | null) => {
    if (!result) return;
    if (result.status === 'denied') {
      toast.show({ message: t('wizard.photos.denied'), tone: 'danger' });
      return;
    }
    if (result.status === 'error') {
      toast.show({ message: t('wizard.photos.failed'), tone: 'danger' });
      return;
    }
    if (result.status !== 'ok' || result.uris.length === 0) return;
    setBusy('photos');
    const saved: DraftPhoto[] = [];
    let failed = false;
    for (const uri of result.uris) {
      try {
        saved.push(await savePhoto(uri));
      } catch {
        failed = true;
      }
    }
    setBusy(null);
    let overflow: DraftPhoto[] = [];
    update((d) => {
      const res = addPhotos(d, saved);
      overflow = res.overflow;
      return res.draft;
    });
    if (overflow.length > 0) {
      deletePhotoFiles(overflow.flatMap((p) => [p.fileName, p.thumbName]));
      toast.show({ message: t('wizard.photos.full') });
    }
    if (failed) toast.show({ message: t('backup:errors.photoSaveFailed'), tone: 'danger' });
    else if (saved.length > 0) playHaptic('light');
  };

  // A photo taken just before Android closed the app comes back here.
  useEffect(() => {
    let alive = true;
    void recoverPendingPick().then((r) => {
      if (alive) void addPicked(r);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, []);

  const room = MAX_DRAFT_PHOTOS - draft.photos.length;

  const close = () => {
    if (draftHasContent(draft) && !editing) toast.show({ message: t('wizard.draftKept') });
    if (router.canGoBack()) router.back();
    else router.replace('/stock');
  };

  const discard = () => {
    const snapshot = draft;
    clear(key);
    let undone = false;
    const timer = setTimeout(() => {
      if (!undone) deletePhotoFiles(filesOfDiscardedDraft(db, snapshot));
    }, DISCARD_GRACE_MS);
    toast.show({
      message: t('wizard.discarded'),
      actionLabel: t('common:actions.undo'),
      onAction: () => {
        undone = true;
        clearTimeout(timer);
        put(key, snapshot);
      },
    });
    if (router.canGoBack()) router.back();
    else router.replace('/stock');
  };

  const save = () => {
    if (busy) return;
    const errs = validateDraft(draft, suggestions[0]);
    if (hasErrors(errs)) {
      setAttempted(true);
      playHaptic('error');
      const step = firstErrorStep(errs);
      if (step !== null) update((d) => setStep(d, step));
      return;
    }
    setBusy('save');
    try {
      const result = saveDraft(db, draft, resolvedName(draft, suggestions[0]));
      deletePhotoFiles(result.filesToDelete);
      clear(key);
      playHaptic('success');
      if (result.created) {
        markSaved(result.productId);
        router.replace(productHref(result.productId));
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(productHref(result.productId));
      }
    } catch (e) {
      playHaptic('error');
      toast.show({ message: t(errorKeyOf(e)), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const next = () => {
    if (draft.step >= WIZARD_STEPS - 1) save();
    else update((d) => setStep(d, d.step + 1));
  };
  const back = () => (draft.step === 0 ? close() : update((d) => setStep(d, d.step - 1)));

  return {
    draft,
    ready: base !== null,
    missing,
    editing,
    update,
    categories,
    suggestions,
    errors: visibleErrors,
    busy,
    room,
    takePhoto: async () => addPicked(await pickFromCamera()),
    pickPhotos: async () => addPicked(await pickFromGallery({ multiple: true, max: Math.max(1, room) })),
    next,
    back,
    goTo: (step: number) => update((d) => setStep(d, step)),
    save,
    close,
    discard,
    canDiscard: draftHasContent(draft),
  };
}

export type ProductWizard = ReturnType<typeof useProductWizard>;
