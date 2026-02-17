import { getV3Navigation } from '../entities';
import { isDev } from '../utils/env';

const V3_NAV_ITEMS = getV3Navigation();

export const NAV = {
  main: [
    { id: 'dashboard', label: { ro: 'Tablou de bord', en: 'Dashboard' }, icon: 'Layout', path: '/', priority: 1, category: 'main_menu' },
  ],
  worker: [],
  shortcuts: [
    { id: 'profile', label: { ro: 'Profilul Meu', en: 'My Profile' }, icon: 'User', path: '/profile', priority: 1 },
    { id: 'blueprint-architect', label: { ro: 'Arhitect Blueprint', en: 'Blueprint Architect' }, icon: 'Sparkles', path: '/superadmin?tab=ai-architect', priority: 2 },
    { id: 'cloud-status', label: { ro: 'Status Cloudflare', en: 'Cloudflare Status' }, icon: 'Cloud', path: '/monitoring?tab=cloudflare', priority: 3, localAgentOnly: true },
    { id: 'local-agent', label: { ro: 'Agent Local', en: 'Local Agent' }, icon: 'HardDrive', path: '/monitoring?tab=agent', priority: 4, localAgentOnly: true },
  ],
  admin: [
    { id: 'monitoring', label: { ro: 'Monitorizare', en: 'Monitoring' }, icon: 'Activity', path: '/monitoring', priority: 90, category: 'administration', localAgentOnly: true },
    { id: 'audit-history', label: { ro: 'Istoric Modificări', en: 'Change History' }, icon: 'History', path: '/audit-history', priority: 95, category: 'administration' },
    { id: 'setting', label: { ro: 'Setări Generale', en: 'General Settings' }, icon: 'Settings', path: '/settings', priority: 100, category: 'administration' },
    { id: 'superadmin', label: { ro: 'SuperAdmin', en: 'SuperAdmin' }, icon: 'Shield', path: '/superadmin', priority: 110, category: 'administration' },
  ],
  user: [
    { id: 'profile', label: { ro: 'Profil', en: 'Profile' }, icon: 'User', path: '/profile' },
    { id: 'setting', label: { ro: 'Setări Generale', en: 'General Settings' }, icon: 'Settings', path: '/settings' }
  ],
  entity: [], // All entities will be injected dynamically by synthesizeNavigation
  auth: [],
} as const;

export const shortcuts = [
  { action: 'open-search', key: 'k', ctrlKey: true, label: { ro: 'Căutare Globală', en: 'Global Search' } },
  { action: 'open-search-ai', key: 'j', ctrlKey: true, label: { ro: 'Căutare AI / Chat', en: 'AI Search / Chat' } },
  { action: 'open-search-file', key: '.', ctrlKey: true, label: { ro: 'Căutare Fișiere', en: 'File Search' } },
  { action: 'toggle-theme', key: 't', shiftKey: true, altKey: true, label: { ro: 'Schimbă Tema (Light/Dark)', en: 'Toggle Theme (Light/Dark)' } },
  { action: 'nav:contact', key: 'e', ctrlKey: true, label: { ro: 'Navigare Contacte', en: 'Navigate contact' } },
  { action: 'list:contact', key: 'l', ctrlKey: true, label: { ro: 'Listă Contacte (Full)', en: 'contact List (Full)' } },
  { action: 'new:contact', key: 'n', ctrlKey: true, label: { ro: 'Adăugare Contact Nou', en: 'Add New Contact' } },
  { action: 'nav:dashboard', key: 'd', ctrlKey: true, label: { ro: 'Navigare Tablou Bord', en: 'Navigate Dashboard' } },
  { action: 'nav:setting', key: 's', ctrlKey: true, label: { ro: 'Navigare Setări', en: 'Navigate Settings' } },
  { action: 'nav:superadmin', key: 'a', ctrlKey: true, label: { ro: 'Navigare SuperAdmin', en: 'Navigate SuperAdmin' } },
  { action: 'nav:superadmin?tab=ai-architect', key: 'b', ctrlKey: true, shiftKey: true, label: { ro: 'Deschide Arhitect AI', en: 'Open AI Architect' } },
  { action: 'go-help', key: '/', ctrlKey: true, label: { ro: 'Asistent AI / Ajutor', en: 'AI Assistant / Help' } },
  { action: 'go-monitoring', key: 'm', ctrlKey: true, label: { ro: 'Monitorizare Sistem', en: 'System Monitoring' } },
];
