/** Add / edit customer form: draft state, contact picking, live duplicate guard and save. */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { db } from '@/db/client';
import { useCustomerProfile } from '@/db/hooks';
import { createCustomer, findByPhone, updateCustomer } from '@/db/repo/customers';
import { DuplicateCustomerError, RepoError } from '@/db/repo/errors';
import type { Customer } from '@/db/schema';
import { toE164 } from '@/lib/phone';
import { playHaptic, useToast } from '@/ui/components';

import { draftChanged, draftToInput, emptyDraft, safeReturnTo, validateDraft, type CustomerDraft, type DraftErrors } from '../logic/customerLogic';
import { customerHref } from '../logic/links';
import { pickContact } from '../pickContact';

export type FormParams = { id?: string; name?: string; phone?: string; returnTo?: string };

function draftFromCustomer(c: Customer, likes: CustomerDraft['likes']): CustomerDraft {
  return {
    name: c.name,
    phone: c.phone ?? '',
    phoneText: c.phone ?? '',
    city: c.city,
    address: c.address,
    tag: c.tag,
    notes: c.notes,
    likes,
    whatsappOk: c.whatsappOk,
  };
}

export function useCustomerForm(params: FormParams) {
  const { t } = useTranslation('customers');
  const toast = useToast();
  const editing = !!params.id;
  const profile = useCustomerProfile(params.id);
  const [initial] = useState<CustomerDraft>(() =>
    profile ? draftFromCustomer(profile.customer, profile.likes) : emptyDraft({ name: params.name, phone: toE164(params.phone ?? '') ?? '' }),
  );
  const [draft, setDraft] = useState<CustomerDraft>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<CustomerDraft>) => setDraft((d) => ({ ...d, ...patch }));

  /** Live duplicate check as soon as the number is complete (before Save). */
  const checkDuplicate = (phone: string) => {
    const other = phone ? findByPhone(db, phone) : null;
    setDuplicate(other && other.id !== params.id ? { id: other.id, name: other.name } : null);
  };

  const setPhone = (e164: string | null, text: string) => {
    update({ phone: e164 ?? '', phoneText: text });
    checkDuplicate(e164 ?? '');
  };

  const fromContacts = async () => {
    const res = await pickContact();
    if (res.status === 'cancelled') return;
    if (res.status === 'denied') return void toast.show({ message: t('form.contactsDenied') });
    if (res.status === 'error') return void toast.show({ message: t('form.contactsError'), tone: 'danger' });
    playHaptic('selection');
    update({ name: res.name || draft.name, ...(res.phone ? { phone: res.phone, phoneText: res.phone } : {}) });
    if (res.phone) checkDuplicate(res.phone);
    else toast.show({ message: t('form.contactNoPhone') });
  };

  const errors: DraftErrors = showErrors ? validateDraft(draft) : {};

  const leave = (savedId: string) => {
    const back = safeReturnTo(params.returnTo);
    if (back) {
      router.dismissTo({ pathname: back, params: { customerId: savedId } } as unknown as Href);
      return;
    }
    if (editing) router.back();
    else router.replace(customerHref(savedId));
  };

  const save = () => {
    if (saving) return;
    const v = validateDraft(draft);
    if (v.name || v.phone || duplicate) {
      setShowErrors(true);
      playHaptic('error');
      return;
    }
    setSaving(true);
    try {
      const input = draftToInput(draft);
      const savedId = params.id ?? createCustomer(db, input);
      if (params.id) updateCustomer(db, params.id, input);
      playHaptic('success');
      toast.show({ message: t('form.saved', { name: input.name }), tone: 'success' });
      leave(savedId);
    } catch (e) {
      if (e instanceof DuplicateCustomerError) setDuplicate({ id: e.existingId, name: e.existingName });
      else if (e instanceof RepoError && e.code === 'invalid') setShowErrors(true);
      else toast.show({ message: t('form.error'), tone: 'danger' });
      playHaptic('error');
    } finally {
      setSaving(false);
    }
  };

  /** In the Sell flow "Use Name" picks the saved customer; elsewhere it opens their profile. */
  const returning = safeReturnTo(params.returnTo) !== null;
  const openDuplicate = () => {
    if (!duplicate) return;
    if (returning) leave(duplicate.id);
    else router.replace(customerHref(duplicate.id));
  };

  return {
    editing,
    missing: editing && !profile,
    draft,
    update,
    setPhone,
    fromContacts,
    errors,
    duplicate,
    openDuplicate,
    returning,
    save,
    saving,
    dirty: draftChanged(draft, initial),
  };
}
