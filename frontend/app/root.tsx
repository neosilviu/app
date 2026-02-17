import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { useEffect } from "react";
import i18next from "./i18next.server";
import type { Route } from "./+types/root";
import "./app.css";
import { Toaster } from "~/components/ui/sonner";
import { SuperAdminGate } from "~/components/ControlGates";
import { ConfigProvider } from "~/hooks/useConfig";
import { AuthProvider } from "~/hooks/useAuth";
import { SystemProvider } from "~/hooks/useSystem";
import { ThemeProvider } from "~/hooks/useTheme";
import { SettingsProvider } from "~/hooks/useSettings";
import { ConnectionManager, ShortcutManager } from "~/components/SystemShell";
import { SearchDialog } from "~/components/search";

import { REGISTRY_BASELINE, renderString } from '~/lib/core';
import { formatForRender } from '~/lib/utils';

export const handle = {
  // In the handle export, we can add a i18n key with namespaces our route needs
  i18n: ["common", "settings", "changelog", "audit", "entity", "entities"],
};

export async function loader({ request }: Route.LoaderArgs) {
  const locale = await i18next.getLocale(request);

  // Server-side fast-path: fetch auth session during SSR so the client can hydrate
  // immediately and avoid a long "Checking session..." cold start.
  let initialSession: any = null;
  try {
    const sessionUrl = new URL('/api/auth/get-session', request.url).toString();
    const res = await fetch(sessionUrl, { headers: request.headers });
    if (res && res.ok) {
      const payload = await res.json().catch(() => null);
      initialSession = (payload as any)?.data ?? null;
    }
  } catch (err: any) {
    // Rate-limit noisy SSR warnings: warn once per process, debug afterwards
    const _errMsg = (err as any)?.message ?? String(err);
    if (!(globalThis as any).__ROOT_LOADER_SESSION_WARNED) {
      console.warn('[ROOT-LOADER] get-session failed during SSR:', _errMsg);
      (globalThis as any).__ROOT_LOADER_SESSION_WARNED = true;
    } else {
      console.debug('[ROOT-LOADER] get-session failed during SSR (suppressed):', _errMsg);
    }

    // Dev fallback: if Worker proxy isn't available during dev, try local Hono API on 8788
    try {
      const isDev = (process.env.NODE_ENV === 'development') || request.url.includes('localhost');
      if (isDev) {
        const fallbackUrl = new URL('http://127.0.0.1:8788/api/auth/get-session').toString();
        const fbRes = await fetch(fallbackUrl, { headers: request.headers });
        if (fbRes && fbRes.ok) {
          const fbPayload = await fbRes.json().catch(() => null);
          initialSession = (fbPayload as any)?.data ?? initialSession;
          if (initialSession) console.debug('[ROOT-LOADER] SSR: recovered session from local Hono fallback');
        }
      }
    } catch (fbErr) {
      // Silent - fallback best-effort only
      const _fbMsg = (fbErr as any)?.message ?? String(fbErr);
      console.debug('[ROOT-LOADER] local Hono fallback failed:', _fbMsg);
    }
  }

  return { locale, initialSession };
}

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>();
  const { i18n } = useTranslation();
  const location = useLocation();

  if (typeof window !== 'undefined') {
    // Enterprise Level 10: Force diagnostic logging for the user
    // console.log(`[STUDIO-V3] App Layout Mounting. Path: ${location.pathname} Locale: ${data?.locale}`);
    if (location.pathname.startsWith('/api')) {
      console.error(`[ROOT-ROUTING-ERROR] API request fell through to Root Layout! Path: ${location.pathname}`);
    }
  }

  // Enterprise Level 10: Global Error Reporting (Uncaught)
  useEffect(() => {
    if (typeof window === 'undefined' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'development')) return;

    const logError = (msg: string, extra: any = {}) => {
      fetch("/api/system/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          path: window.location.pathname,
          clientInfo: {
            userAgent: navigator.userAgent,
            ...extra
          }
        })
      }).catch(() => {});
    };

    const handleError = (event: ErrorEvent) => {
      logError(`Global Error: ${event.message}`, { 
        filename: event.filename, 
        lineno: event.lineno, 
        colno: event.colno,
        stack: event.error?.stack 
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      logError(`Unhandled Rejection: ${event.reason?.message || String(event.reason)}`, {
        stack: event.reason?.stack
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <html lang={data?.locale ?? "ro"} dir={i18n.dir()}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ConfigProvider>
          <AuthProvider>
            <SystemProvider>
              <ThemeProvider 
                defaultTheme={(REGISTRY_BASELINE?.THEME?.defaultTheme) || "light"} 
                storageKey={(REGISTRY_BASELINE?.THEME?.storageKey) || "studio-theme"}
              >
                <SettingsProvider>
                  <SuperAdminGate>
                    {children}
                  </SuperAdminGate>
                  <ShortcutManager />
                  <ConnectionManager />
                  <SearchDialog />
                  <Toaster 
                    position="top-right" 
                    closeButton 
                    richColors 
                    duration={4000}
                  />
                </SettingsProvider>
              </ThemeProvider>
            </SystemProvider>
          </AuthProvider>
        </ConfigProvider>
        {/* Server-injected initial session (fast-path for auth) */}
        {typeof window === 'undefined' && (data as any)?.initialSession && (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__INITIAL_SESSION__ = ${JSON.stringify((data as any).initialSession)};`
            }}
          />
        )}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "ro";
  let message = renderString(t("common:error_oops"), lang);
  let details = renderString(t("common:error_unexpected"), lang);
  let stack: string | undefined;

  const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV === 'development' : (typeof import.meta !== 'undefined' && import.meta.env?.DEV);

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? renderString(t("common:error_404"), lang)
        : error.statusText || details;
  } else if (error && typeof error === 'object' && 'ro' in (error as any)) {
    // Custom translation object thrown as error
    details = renderString(error, lang);
  } else if (error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  } else if (error && typeof error === 'string') {
    details = error;
  }

  // Ensure details is a safe string for rendering (use shared helper)
  const detailsStr = formatForRender(details, lang);

  // Enterprise Level 10: Production Error Reporting
  useEffect(() => {
    const reportError = async () => {
      try {
        await fetch("/api/system/log-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: detailsStr,
            stack: stack,
            path: window.location.pathname + window.location.search,
            status: isRouteErrorResponse(error) ? error.status : 500,
            clientInfo: {
              href: window.location.href,
              userAgent: navigator.userAgent,
              language: navigator.language,
              screen: `${window.screen.width}x${window.screen.height}`
            }
          })
        });
      } catch (e) {
        console.warn("[ERROR-REPORTING-FAILED]", e);
      }
    };
    
    if (typeof window !== 'undefined' && !isDev) {
      reportError();
    }
  }, [detailsStr, stack, error, isDev]);

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-950 mb-4">{message}</h1>
      <p className="text-slate-600 font-medium mb-8">{detailsStr}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

