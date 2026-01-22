import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { StrictMode, startTransition } from "react";
import i18n from "./i18n";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { getInitialNamespaces } from "remix-i18next/client";
import { initializeRegistry } from "./lib/core";

async function prepare() {
  // Initialize registry FIRST
  const REGISTRY_BASELINE = await initializeRegistry();

  await i18next
    .use(initReactI18next) // Tell i18next to use the react-i18next plugin
    .use(LanguageDetector) // Setup a client-side language detector
    .use(Backend) // Setup your backend
    .init({
      ...i18n, // spread the configuration
      // This function detects the namespaces your routes rendered while SSR use
      ns: getInitialNamespaces(),
      backend: { loadPath: "/locales/{{lng}}/{{ns}}.json" },
      partialBundledLanguages: true,
      detection: {
        // Here we only enable htmlTag detection, we'll detect the language only
        // server-side with remix-i18next, then the server will add the lang
        // attribute to the html tag and i18next will use it here
        order: ["htmlTag"],
        // Because we only use htmlTag, there's no need to cache the language in
        // cookies or localStorage, so we can disable it
        caches: [],
      },
    });

  // Inject registry resources after init to avoid blocking backend file loading
  if (REGISTRY_BASELINE.I18N) {
    Object.entries(REGISTRY_BASELINE.I18N).forEach(([lang, data]: [string, any]) => {
      if (!data || typeof data !== 'object') return;
      const hasNamespaces = Object.values(data).some(v => v !== null && typeof v === 'object' && !Array.isArray(v));
      
      if (hasNamespaces) {
        Object.entries(data).forEach(([ns, nsData]) => {
          if (nsData && typeof nsData === 'object') {
            i18next.addResourceBundle(lang, ns, nsData, true, true);
          }
        });
      } else {
        i18next.addResourceBundle(lang, 'common', data, true, true);
      }
    });
  }
}

prepare().then(() => {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <I18nextProvider i18n={i18next}>
          <HydratedRouter />
        </I18nextProvider>
      </StrictMode>
    );
  });
});
