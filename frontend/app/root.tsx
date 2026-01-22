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

import { REGISTRY_BASELINE, renderString } from '~/lib/core';

export const handle = {
  // In the handle export, we can add a i18n key with namespaces our route needs
  i18n: "common",
};

export async function loader({ request }: Route.LoaderArgs) {
  const locale = await i18next.getLocale(request);
  return { locale };
}

export const links: Route.LinksFunction = () => [
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

  if (typeof window !== 'undefined' && location.pathname.startsWith('/api')) {
    console.error(`[ROOT-ROUTING-ERROR] API request fell through to Root Layout! Path: ${location.pathname}`);
  }

  return (
    <html lang={data?.locale ?? "ro"} dir={i18n.dir()}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <AuthProvider>
          <SystemProvider>
            <ThemeProvider 
              defaultTheme={(REGISTRY_BASELINE?.THEME?.defaultTheme) || "light"} 
              storageKey={(REGISTRY_BASELINE?.THEME?.storageKey) || "studio-theme"}
            >
              <ConfigProvider>
                <SettingsProvider>
                  <SuperAdminGate>
                    {children}
                  </SuperAdminGate>
                  <ShortcutManager />
                  <ConnectionManager />
                  <Toaster 
                    position="top-right" 
                    closeButton 
                    richColors 
                    duration={4000}
                  />
                </SettingsProvider>
              </ConfigProvider>
            </ThemeProvider>
          </SystemProvider>
        </AuthProvider>
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

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-950 mb-4">{message}</h1>
      <p className="text-slate-600 font-medium mb-8">{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}

