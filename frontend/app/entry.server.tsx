import { ServerRouter } from "react-router";
import { renderToReadableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { isbot } from "isbot";
import { createInstance } from "i18next";
import i18n from "./i18n";
import i18next from "./i18next.server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import { initializeRegistry } from "./lib/core";
import { EventEmitter } from "node:events";

// Force increase EventEmitter limit in dev to stop MaxListenersExceededWarning
if (process.env.NODE_ENV === "development") {
  process.setMaxListeners(100);
  EventEmitter.defaultMaxListeners = 100;
}

// Initialize registry on server startup
let registryPromise: Promise<any> | null = null;
function ensureRegistry() {
  if (!registryPromise) registryPromise = initializeRegistry();
  return registryPromise;
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: AppLoadContext
) {
  const url = new URL(request.url);
  console.log(`[ENTRY-SERVER] handleRequest called for: ${request.method} ${url.pathname}`);
  
  // CRITICAL: Route /api/* directly to Brain handler to avoid SSR HTML
  if (url.pathname.startsWith('/api/')) {
    console.log(`[ENTRY-SERVER] Routing API request to Brain handler`);
    const { handleBrainRequest } = await import("./brain.server");
    const env = (loadContext as any).cloudflare?.env || (process as any).env;
    const ctx = (loadContext as any).cloudflare?.ctx;
    const response = await handleBrainRequest(request, env, ctx);
    console.log(`[ENTRY-SERVER] API response: ${response.status}`);
    return response;
  }

  
  // Ensure registry is ready before any rendering
  await ensureRegistry();
  
  const userAgent = request.headers.get("user-agent");
  const isBotRequest = userAgent ? isbot(userAgent) : false;

  const instance = createInstance();
  const lng = await i18next.getLocale(request);
  const ns = i18next.getRouteNamespaces(routerContext as any);

  await instance
    .use(initReactI18next) // Tell our instance to use react-i18next
    .use(Backend) // Setup our backend
    .init({
      ...i18n, // spread the configuration
      lng, // The locale we detected above
      ns, // The namespaces the routes about to render wants
      backend: { loadPath: "./public/locales/{{lng}}/{{ns}}.json" },
    });

  // Inject registry resources into server instance
  const REGISTRY_BASELINE = await initializeRegistry();
  if (REGISTRY_BASELINE.I18N) {
    Object.entries(REGISTRY_BASELINE.I18N).forEach(([lang, data]: [string, any]) => {
      if (!data || typeof data !== 'object') return;
      const hasNamespaces = Object.values(data).some(v => v !== null && typeof v === 'object' && !Array.isArray(v));
      
      if (hasNamespaces) {
        Object.entries(data).forEach(([ns, nsData]) => {
          if (nsData && typeof nsData === 'object') {
            instance.addResourceBundle(lang, ns, nsData, true, true);
          }
        });
      } else {
        instance.addResourceBundle(lang, 'common', data, true, true);
      }
    });
  }

  const body = await renderToReadableStream(
    <I18nextProvider i18n={instance}>
      <ServerRouter context={routerContext} url={request.url} />
    </I18nextProvider>,
    {
      signal: request.signal,
      onError(error: unknown) {
        console.error(error);
        responseStatusCode = 500;
      },
    }
  );

  if (isBotRequest) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");

  return new Response(body, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
