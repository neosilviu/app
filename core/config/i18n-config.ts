export const I18N_CONFIG = {
  defaultLanguage: 'ro',
  supportedLanguages: {
    en: { name: 'English', nativeName: 'English', direction: 'ltr' },
    ro: { name: 'Romanian', nativeName: 'Română', direction: 'ltr' },
  },
  timezone: {
    default: 'UTC',
    userSelectable: true,
  },
  dateFormat: {
    default: 'DD/MM/YYYY',
    locale: {
      en: 'MM/DD/YYYY',
      ro: 'DD/MM/YYYY',
      es: 'DD/MM/YYYY',
      fr: 'DD/MM/YYYY',
    },
  },
  currencyFormat: {
    default: 'USD',
    locale: {
      en: 'USD',
      ro: 'RON',
      es: 'EUR',
      fr: 'EUR',
    },
  },
} as const;
