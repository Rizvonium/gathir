/**
 * i18n bootstrap. Each feature owns ONE namespace file: src/i18n/en/<namespace>.json.
 * Use it with `useTranslation('<namespace>')`. Shared words live in `common`.
 * Urdu (RTL) and Hindi arrive in 1.1: add src/i18n/ur/*, src/i18n/hi/* with the same keys.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from './en/common.json';
import ui from './en/ui.json';
import home from './en/home.json';
import onboarding from './en/onboarding.json';
import stock from './en/stock.json';
import sales from './en/sales.json';
import customers from './en/customers.json';
import catalogue from './en/catalogue.json';
import showroom from './en/showroom.json';
import report from './en/report.json';
import backup from './en/backup.json';
import settings from './en/settings.json';
import lock from './en/lock.json';

export const resources = {
  en: {
    common,
    ui,
    home,
    onboarding,
    stock,
    sales,
    customers,
    catalogue,
    showroom,
    report,
    backup,
    settings,
    lock,
  },
} as const;

export const defaultNS = 'common';

// eslint-disable-next-line import/no-named-as-default-member -- i18next's documented setup
void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  ns: Object.keys(resources.en),
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
