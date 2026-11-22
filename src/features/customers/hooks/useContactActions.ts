/** WhatsApp and phone-call actions with friendly fallbacks (never throw). */
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';

import { openWhatsAppChat } from '@/share';
import { useToast } from '@/ui/components';

export function useContactActions() {
  const { t } = useTranslation('customers');
  const toast = useToast();

  const whatsapp = async (phone: string | null) => {
    if (!phone) return;
    const ok = await openWhatsAppChat(phone, '');
    if (!ok) toast.show({ message: t('contact.noWhatsApp'), tone: 'danger' });
  };

  const call = async (phone: string | null) => {
    if (!phone) return;
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      toast.show({ message: t('contact.callFailed'), tone: 'danger' });
    }
  };

  return { whatsapp, call };
}
