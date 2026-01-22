/**
 * CORE UTILITIES - SSOT Ã®n Frontend
 * Registry injection la bootstrap - ZERO hardcoding
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let _registry: any = null;

export function initRegistry(registry: any) {
  _registry = registry;
}

export function generateId(prefix = ''): string {
  // Enterprise Level 8: Standardized UUID v4 for all entities
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
  }
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = _registry?.LANGUAGE_LOCALE || 'ro-RO';
  if (typeof Intl !== 'undefined') {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
  return d.toISOString();
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
}

export interface NavItem {
  id?: string;
  path: string;
  label: string;
  icon?: string;
  priority?: number;
  hidden?: boolean;
  badge?: string;
  superadminOnly?: boolean;
  adminOnly?: boolean;
  permission?: string;
  workerName?: string;
  requiresWorkers?: boolean;
  roleRestriction?: string[];
  category?: string;
}

export type EntityType = 'text' | 'email' | 'number' | 'date' | 'select' | 'boolean' | 'json' | 'rich-text';

export function getLocalizedPath(path: string, lang?: string, currentPath?: string, newLang?: string): string {
  if (currentPath && newLang) {
    // Logic for language switching in a localized path
    const segments = currentPath.split('/').filter(Boolean);
    if (segments.length > 0) {
      // Assume first segment is the language if it's 2 chars
      if (segments[0].length === 2) {
        segments[0] = newLang;
      } else {
        segments.unshift(newLang);
      }
      return '/' + segments.join('/');
    }
    return `/${newLang}${path}`;
  }
  const locale = lang || 'ro';
  return `/${locale}${path}`;
}

export function getNavItemByPath(navOrPath: NavItem[] | string, path?: string): NavItem | undefined {
  if (typeof navOrPath === 'string') {
    // If only path provided, we'd need access to the registry which is handled in components
    // For now, return undefined and let the component handle it or provide the nav array
    return undefined;
  }
  return navOrPath.find(item => item.path === path);
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: any = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Extracts a string from an i18n object or returns the string directly.
 * Handles: string | { [lang: string]: string } | null | undefined
 */
export function renderString(value: any, lang: string = 'ro'): string {
    if (!value) return '';
    
    // If it's a string, check if it's a JSON string that needs parsing
    if (typeof value === 'string') {
        if (value.startsWith('{') || value.startsWith('[')) {
            try {
                const parsed = JSON.parse(value);
                return renderString(parsed, lang);
            } catch (e) {
                return value;
            }
        }
        return value;
    }

    if (typeof value === 'object') {
        // Handle standard i18n objects { ro: "...", en: "..." }
        if (value[lang]) return value[lang];
        if (value['ro']) return value['ro'];
        if (value['en']) return value['en'];

        // Handle common entity expansion (record objects with identity fields)
        if (value.name || value.label || value.title || value.displayName) {
          const val = value.name || value.label || value.title || value.displayName;
          if (typeof val === 'string') return val;
          return renderString(val, lang);
        }
        
        // Final fallback for objects
        return Object.values(value)[0] as string || '';
    }
    return String(value);
}

export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function sanitizeFilename(n: string | any): string {
  return String(n || 'file')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
    .trim();
}

export function getRomanianTime(date: Date = new Date()) {
  const timezone = _registry?.TIMEZONE || 'Europe/Bucharest';
  if (typeof Intl !== 'undefined') {
    const roDateStr = date.toLocaleString('en-US', { timeZone: timezone });
    const roDate = new Date(roDateStr);
    return {
      date: roDate,
      hours: roDate.getHours(),
      minutes: roDate.getMinutes(),
      dayOfWeek: roDate.getDay(),
      day: roDate.getDate(),
      month: roDate.getMonth(),
      year: roDate.getFullYear(),
    };
  }
  const hours = date.getUTCHours() + 2;
  return {
    date,
    hours: hours % 24,
    minutes: date.getUTCMinutes(),
    dayOfWeek: date.getUTCDay(),
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear(),
  };
}

export function checkIsWorkingHours(date: Date = new Date()): boolean {
  const roTime = getRomanianTime(date);
  const hours = _registry?.WORKING_HOURS_DEFAULT || { days: [1, 2, 3, 4, 5], start: 9, end: 18 };

  if (!hours.days.includes(roTime.dayOfWeek)) return false;

  const holidays = _registry?.ROMANIAN_HOLIDAYS || [];
  const isHoliday = holidays.some(
    (h: any) =>
      (h.m === roTime.month && h.d === roTime.day) ||
      (h.month === roTime.month && h.day === roTime.day)
  );
  if (isHoliday) return false;

  return roTime.hours >= hours.start && roTime.hours < hours.end;
}

export const CoreUtils = {
    generateId,
    formatDate,
    deepClone,
    debounce,
    isValidEmail,
    sanitizeFilename,
    getRomanianTime,
    checkIsWorkingHours,
    cn
};
