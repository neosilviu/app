import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { socket } from '~/lib/core';
import { useOptionalAuth } from "~/hooks/useAuth";
import { REGISTRY_BASELINE } from '../lib/core';

export type Theme = "dark" | "light" | "system";

export interface CustomTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  foreground: string;
  radius: string;
  scrollbarThumb?: string;
  scrollbarTrack?: string;
  layout?: 'boxed' | 'fluid';
  density?: 'comfortable' | 'compact';
  sidebarGlass?: boolean;
  autoRefreshEnabled?: boolean;
  shortcuts?: any[]; // Simplified for hook
  sidebarShortcuts?: any[]; // Pinned sidebar items
  shadowIntensity?: 'none' | 'soft' | 'strong';
  sidebarCollapsed?: boolean;
}

export interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  customTheme: CustomTheme | null;
  updateCustomTheme: (theme: CustomTheme, save?: boolean) => void;
  autoRefreshEnabled: boolean;
  canAutoRefresh: boolean;
  toggleAutoRefresh: () => void;
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({
  children,
  defaultTheme = (REGISTRY_BASELINE.THEME as any).defaultTheme || "light",
  storageKey = (REGISTRY_BASELINE.THEME as any).storageKey || "studio-theme",
}: { children: ReactNode; defaultTheme?: Theme; storageKey?: string }) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [customTheme, setCustomTheme] = useState<CustomTheme | null>(null);
  
  const auth = useOptionalAuth();
  const user = auth?.user;

  const [canAutoRefresh, setCanAutoRefresh] = useState(false);
  const [localAutoRefresh, setLocalAutoRefresh] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('autoRefreshEnabled');
      if (saved !== null) setLocalAutoRefresh(saved === 'true');
    }
  }, []);

  const autoRefreshEnabled = localAutoRefresh ?? customTheme?.autoRefreshEnabled ?? false;

  useEffect(() => {
    if (!user) {
      setCanAutoRefresh(false);
      return;
    }
    // Set to true immediately upon login
    setCanAutoRefresh(true);
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(storageKey) as Theme;
    if (saved) setTheme(saved);
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;
    root.classList.remove("light");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const applyCustomTheme = (t: CustomTheme) => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;
    
    // Reset properties to ensure we don't have leftovers from previous themes
    root.style.setProperty('--primary', t.primary || '');
    root.style.setProperty('--secondary', t.secondary || '');
    root.style.setProperty('--accent', t.accent || '');
    root.style.setProperty('--background', t.background || '');
    root.style.setProperty('--surface', t.surface || '');
    root.style.setProperty('--foreground', t.foreground || '');
    root.style.setProperty('--radius', t.radius || '0.75rem');
    root.style.setProperty('--scrollbar-thumb', t.scrollbarThumb || '');
    root.style.setProperty('--scrollbar-track', t.scrollbarTrack || '');
    root.style.setProperty('--content-width', t.layout === 'fluid' ? '100%' : '80rem');
    root.style.setProperty('--density-factor', t.density === 'compact' ? '0.75' : '1');
    if (t.sidebarGlass !== undefined) {
      root.style.setProperty('--sidebar-blur', t.sidebarGlass ? '20px' : '0px');
      root.style.setProperty('--sidebar-opacity', t.sidebarGlass ? '0.8' : '1');
    }
    if (t.shadowIntensity) {
      const shadowMap = { 
        none: 'none', 
        soft: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
        strong: '0 10px 15px -3px rgb(0 0 0 / 0.2)' 
      };
      root.style.setProperty('--card-shadow', shadowMap[t.shadowIntensity]);
    }
  };

  const updateCustomTheme = (newTheme: CustomTheme, save: boolean = true) => {
    setCustomTheme(newTheme);
    applyCustomTheme(newTheme);
    if (save && typeof window !== 'undefined') {
      localStorage.setItem('custom-theme', JSON.stringify(newTheme));
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Load local custom theme
    const savedCustom = localStorage.getItem('custom-theme');
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        setCustomTheme(parsed);
        applyCustomTheme(parsed);
      } catch (e) {
        console.error("Failed to parse custom theme", e);
      }
    }
  }, []);

  const toggleAutoRefresh = () => {
    const newVal = !autoRefreshEnabled;
    const updatedTheme = { ...customTheme, autoRefreshEnabled: newVal } as CustomTheme;
    setCustomTheme(updatedTheme);
    setLocalAutoRefresh(newVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoRefreshEnabled', String(newVal));
      localStorage.setItem('custom-theme', JSON.stringify(updatedTheme));
    }
  };

  return (
    <ThemeProviderContext.Provider value={{
      theme,
      setTheme: (theme: Theme) => {
        if (typeof window !== "undefined") {
            localStorage.setItem(storageKey, theme);
        }
        setTheme(theme);
      },
      customTheme,
      updateCustomTheme,
      autoRefreshEnabled,
      canAutoRefresh,
      toggleAutoRefresh,
    }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
