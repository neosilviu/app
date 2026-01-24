/**
 * REGISTRY UI - Navigation, Shortcuts, Themes and Dashboards
 * Enterprise Level 8
 */

export const NAV = {
  main: [
    { id: "dashboard", label: { ro: "Tablou de bord", en: "Dashboard" }, icon: "Layout", path: "/", priority: 1, category: "main_menu" },
  ],
  worker: [],
  SHORTCUT: [
    { id: "blueprint-architect", label: { ro: "Arhitect Blueprint", en: "Blueprint Architect" }, icon: "Sparkles", path: "/superadmin?tab=ai-architect", priority: 1 },
    { id: "cloud-status", label: { ro: "Status Cloudflare", en: "Cloudflare Status" }, icon: "Cloud", path: "/monitoring?tab=cloudflare", priority: 2, localAgentOnly: true },
    { id: "local-agent", label: { ro: "Agent Local", en: "Local Agent" }, icon: "HardDrive", path: "/monitoring?tab=agent", priority: 3, localAgentOnly: true },
  ],
  admin: [
    { id: "monitoring", label: { ro: "Monitorizare", en: "Monitoring" }, icon: "Activity", path: "/monitoring", priority: 90, category: "administration", localAgentOnly: true },
    { id: "audit-history", label: { ro: "Istoric Modificări", en: "Change History" }, icon: "History", path: "/audit-history", priority: 95, category: "administration" },
    { id: "setting", label: { ro: "Setări Generale", en: "General Settings" }, icon: "Settings", path: "/settings", priority: 100, category: "administration" },
    { id: "superadmin", label: { ro: "SuperAdmin", en: "SuperAdmin" }, icon: "Shield", path: "/superadmin", priority: 110, category: "administration" }
  ],
  user: [
    { id: "profile", label: { ro: "Profil", en: "Profile" }, icon: "User", path: "/profile" },
    { id: "setting", label: { ro: "Setări Generale", en: "General Settings" }, icon: "Settings", path: "/settings" }
  ],
  entity: [], 
  auth: [],
} as const;

export const SHORTCUT = [
  { action: "open-search", key: "k", ctrlKey: true, label: { ro: "Căutare Globală", en: "Global Search" } },
  { action: "open-search-ai", key: "j", ctrlKey: true, label: { ro: "Căutare AI / Chat", en: "AI Search / Chat" } },
  { action: "open-search-file", key: ".", ctrlKey: true, label: { ro: "Căutare Fișiere", en: "File Search" } },
  { action: "toggle-theme", key: "t", shiftKey: true, altKey: true, label: { ro: "Schimbă Tema (Light/Dark)", en: "Toggle Theme (Light/Dark)" } },
  { action: "nav:contact", key: "c", ctrlKey: true, label: { ro: "Navigare Contacte", en: "Navigate contact" } },
  { action: "list:contact", key: "l", ctrlKey: true, label: { ro: "Listă Contacte (Full)", en: "contact List (Full)" } },
  { action: "new:contact", key: "n", ctrlKey: true, label: { ro: "Adăugare Contact Nou", en: "Add New Contact" } },
  { action: "nav:dashboard", key: "d", ctrlKey: true, label: { ro: "Navigare Tablou Bord", en: "Navigate Dashboard" } },
  { action: "nav:setting", key: "s", ctrlKey: true, label: { ro: "Navigare Setări", en: "Navigate Settings" } },
  { action: "nav:superadmin", key: "a", ctrlKey: true, label: { ro: "Navigare SuperAdmin", en: "Navigate SuperAdmin" } },
  { action: "nav:superadmin?tab=ai-architect", key: "b", ctrlKey: true, shiftKey: true, label: { ro: "Deschide Arhitect AI", en: "Open AI Architect" } },
  { action: "go-help", key: "/", ctrlKey: true, label: { ro: "Asistent AI / Ajutor", en: "AI Assistant / Help" } },
  { action: "go-monitoring", key: "m", ctrlKey: true, label: { ro: "Monitorizare Sistem", en: "System Monitoring" } },
];

export const DASHBOARD = {
  welcomeMessage: {
    ro: "Bine ai venit în Studio App v2",
    en: "Welcome to Studio App v2"
  },
  showQuickStats: true,
  layout: "grid",
  cards: [
    {
      id: "contact_card",
      entity: "contact",
      type: "count",
      label: { ro: "Total Contacte", en: "Total Contacts" },
      icon: "Users",
      color: "blue"
    },
    {
      id: "workspaces_card",
      entity: "workspace",
      type: "count",
      label: { ro: "Spații de Lucru", en: "Workspaces" },
      icon: "Briefcase",
      color: "indigo"
    }
  ]
} as const;

export const THEME = {
  defaultTheme: "light",
  storageKey: "studio-theme",
  brand: {
    name: "Studio App v2",
    logo: "Command",
    primary: "#4f46e5",
    secondary: "#0f172a",
    accent: "#f97316",
  },
  colors: {
    primary: "#4f46e5",
    secondary: "#0f172a",
    danger: "#ef4444",
    warning: "#f59e0b",
    success: "#10b981",
    info: "#0ea5e9",
    light: "#f3f4f6",
    dark: "#1f2937",
    muted: "#6b7280",
    background: "#ffffff",
    foreground: "#000000",
    border: "#e5e7eb",
    neutral: {
      50: "#f9fafb",
      100: "#f3f4f6",
      200: "#e5e7eb",
      300: "#d1d5db",
      400: "#9ca3af",
      500: "#6b7280",
      600: "#4b5563",
      700: "#374151",
      800: "#1f2937",
      900: "#111827",
    },
  },
  typography: {
    fontFamily: {
      sans: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
      mono: "ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace",
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
    },
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
  },
  layout: {
    sidebarWidth: "16rem",
    headerHeight: "4rem",
    borderRadius: "1rem",
    shadows: {
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      md: "0 4px 10px -1px rgba(0, 0, 0, 0.1)",
      lg: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    },
  },
  darkMode: {
    enabled: true,
    auto: true,
  },
} as const;