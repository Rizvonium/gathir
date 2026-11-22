/**
 * Categories: add, rename, move up/down, delete when unused (with Undo, no confirm dialog).
 * Every change is one repo call; the list re-reads live.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/hooks';
import { createCategory, deleteCategory, listCategoriesWithCounts, renameCategory, reorderCategories, type CategoryWithCount } from '@/db/repo/categories';
import { RepoError } from '@/db/repo/errors';
import { playHaptic, useToast } from '@/ui/components';

import { cleanCategoryName, isDuplicateName, moveItem, orderWithReplacement } from '../settingsLogic';

export type NameError = 'required' | 'duplicate' | undefined;

export function checkName(raw: string, list: readonly { id: string; name: string }[], exceptId?: string): { name: string | null; error: NameError } {
  const name = cleanCategoryName(raw);
  if (!name) return { name: null, error: 'required' };
  if (isDuplicateName(name, list, exceptId)) return { name: null, error: 'duplicate' };
  return { name, error: undefined };
}

export function useCategoryEditor() {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const list = useDbQuery(listCategoriesWithCounts, []);
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<NameError>();
  const [renaming, setRenaming] = useState<CategoryWithCount | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renameError, setRenameError] = useState<NameError>();

  const fail = () => toast.show({ message: t('saveFailed'), tone: 'danger' });

  const add = () => {
    const { name, error } = checkName(draft, list);
    if (!name) {
      setDraftError(error);
      playHaptic('error');
      return;
    }
    try {
      createCategory(db, { name });
      setDraft('');
      setDraftError(undefined);
      playHaptic('light');
      toast.show({ message: t('stock.added', { name }) });
    } catch {
      fail();
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const ids = moveItem(list.map((c) => c.id), index, dir);
    try {
      reorderCategories(db, ids);
      playHaptic('selection');
    } catch {
      fail();
    }
  };

  const remove = (c: CategoryWithCount) => {
    if (c.productCount > 0) {
      playHaptic('error');
      toast.show({ message: t('stock.inUse', { count: c.productCount }), tone: 'danger' });
      return;
    }
    const order = list.map((x) => x.id);
    try {
      deleteCategory(db, c.id);
    } catch (e) {
      playHaptic('error');
      if (e instanceof RepoError && e.code === 'in_use') toast.show({ message: t('stock.inUseDeleted'), tone: 'danger' });
      else fail();
      return;
    }
    playHaptic('medium');
    toast.show({
      message: t('stock.deleted', { name: c.name }),
      actionLabel: t('common:actions.undo'),
      onAction: () => {
        try {
          const newId = createCategory(db, { name: c.name, icon: c.icon });
          reorderCategories(db, orderWithReplacement(order, c.id, newId));
        } catch {
          fail();
        }
      },
    });
  };

  const startRename = (c: CategoryWithCount) => {
    setRenaming(c);
    setRenameText(c.name);
    setRenameError(undefined);
  };

  const saveRename = () => {
    if (!renaming) return;
    const { name, error } = checkName(renameText, list, renaming.id);
    if (!name) {
      setRenameError(error);
      playHaptic('error');
      return;
    }
    try {
      if (name !== renaming.name) renameCategory(db, renaming.id, name, renaming.icon);
      setRenaming(null);
    } catch {
      fail();
    }
  };

  return {
    list,
    draft,
    draftError,
    setDraft: (v: string) => {
      setDraft(v);
      if (draftError) setDraftError(undefined);
    },
    add,
    move,
    remove,
    renaming,
    renameText,
    renameError,
    setRenameText: (v: string) => {
      setRenameText(v);
      if (renameError) setRenameError(undefined);
    },
    startRename,
    saveRename,
    cancelRename: () => setRenaming(null),
  };
}
