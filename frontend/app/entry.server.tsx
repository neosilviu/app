import { ServerRouter } from "react-router";
import { renderToReadableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { isbot } from "isbot";
import { createInstance } from "i18next";
import i18n from "./i18n";
import i18next from "./i18next.server";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import { REGISTRY_BASELINE as STATIC_REGISTRY } from "../../registry-baseline";
import { initRegistry } from './lib/registry';
import { EventEmitter } from "node:events";

// CRITICAL: Initialize registry with static baseline BEFORE any async work
// This prevents NAV Proxy errors on first request
initRegistry(STATIC_REGISTRY);

// Force increase EventEmitter limit in dev to stop MaxListenersExceededWarning
if (process.env.NODE_ENV === "development") {
  process.setMaxListeners(100);
  EventEmitter.defaultMaxListeners = 100;
}

// TURBO MODE: Return static registry immediately for SSR boot
// D1 merge happens async in background handlers
function getRegistry() {
  return Promise.resolve(STATIC_REGISTRY);
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: AppLoadContext
) {
  const url = new URL(request.url);
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  
  // console.log(`[ENTRY-START] [${requestId}] ${timestamp} ${request.method} ${url.pathname}`);
  
  // CRITICAL: Handle /api/* routes BEFORE React Router processes them
  if (url.pathname.startsWith('/api/')) {
    const { handleBrainRequest } = await import("./brain.server");
    const env = (loadContext as any).cloudflare?.env || (process as any).env;
    const ctx = (loadContext as any).cloudflare?.ctx;
    
    // console.log(`[ENTRY-API-START] [${requestId}] ${request.method} ${url.pathname}`);
    
    // We pass the request directly and let Brain handle body recovery ONCE.
    // Pre-parsing in entry.server.tsx often fails in dev because of RR7's internal request handling.
    const response = await handleBrainRequest(request, env, ctx);
    
    // console.log(`[ENTRY-API-END] [${requestId}] ${response.status}`);
    return response;
  }
  
  // Ensure registry is ready before any rendering (instant with static baseline)
  const REGISTRY_BASELINE = await getRegistry();
  
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
