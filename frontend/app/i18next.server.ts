import { RemixI18Next } from "remix-i18next/server";
import i18n from "./i18n"; // your i18n configuration file

const i18next = new RemixI18Next({
  detection: {
    supportedLanguages: i18n.supportedLngs,
    fallbackLanguage: i18n.fallbackLng,
    // Add custom detector to pick up language from URL path
    async findLocale(request) {
      const url = new URL(request.url);
      const firstPart = url.pathname.split('/')[1];
      if (firstPart && i18n.supportedLngs.includes(firstPart)) {
        return firstPart;
      }
      return null;
    }
  },
  // This is the configuration for i18next used
  // when translating messages server-side only
  i18next: {
    ...i18n,
    backend: {
      loadPath: "./public/locales/{{lng}}/{{ns}}.json",
    },
  },
});

export default i18next;
