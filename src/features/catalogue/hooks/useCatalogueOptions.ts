/** Step 2 "How it looks": the remembered options, edited in memory and saved on "Preview". */
import { useEffect } from 'react';

import { db } from '@/db/client';
import { useSettings } from '@/db/hooks';
import { updateSettings } from '@/db/repo/settings';

import { parseStoredForm, storedFormJson, type CatalogueForm } from '../logic/options';
import { useCatalogueFlow } from '../store';

/** Loads the remembered options into the run once settings are readable. */
export function useLoadedForm(): CatalogueForm | null {
  const settings = useSettings();
  const form = useCatalogueFlow((s) => s.form);
  const setForm = useCatalogueFlow((s) => s.setForm);
  useEffect(() => {
    if (!form && settings) {
      const stored = parseStoredForm(settings.catalogueOptionsJson, settings.catalogueStyle);
      // A customer's own catalogue leaves sold-out pieces out by default (they stay flagged on their page).
      const personal = useCatalogueFlow.getState().source.kind === 'customer';
      setForm(personal ? { ...stored, hideSoldOut: true } : stored);
    }
  }, [form, settings, setForm]);
  return form;
}

export function useCatalogueOptions() {
  const form = useLoadedForm();
  const setForm = useCatalogueFlow((s) => s.setForm);

  const update = (patch: Partial<CatalogueForm>) => {
    const current = useCatalogueFlow.getState().form;
    if (current) setForm({ ...current, ...patch });
  };

  /** Remembers the options for next time (the personal note is never stored). */
  const settings = useSettings();
  const remember = () => {
    const { form: current, source } = useCatalogueFlow.getState();
    if (!current) return;
    // The sold-out default of a personal catalogue is not a general preference: keep the stored one.
    const toStore =
      source.kind === 'customer' && settings ? { ...current, hideSoldOut: parseStoredForm(settings.catalogueOptionsJson).hideSoldOut } : current;
    try {
      updateSettings(db, { catalogueOptionsJson: storedFormJson(toStore), catalogueStyle: current.style });
    } catch {
      // Remembering is a convenience; the catalogue still uses the options in memory.
    }
  };

  return { form, update, remember };
}
