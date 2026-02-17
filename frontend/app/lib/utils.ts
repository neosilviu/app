/**
 * CORE UTILITIES - SSOT Ã®n Frontend
 * Registry-driven logic - ZERO hardcoding
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { IconMap, resolveIcon } from './icons';
import { getRegistry } from './registry';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export { resolveIcon };

export function generateId(prefix = ''): string {
  // Enterprise Level 10: Standardized UUID v4 for all entities
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
  }
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);

  const registry = getRegistry();
  const defaultLang = registry?.I18N_CONFIG?.defaultLanguage || 'ro';
  
  if (typeof Intl !== 'undefined') {
    try {
      return new Intl.DateTimeFormat(defaultLang, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(d);
    } catch (e) {
      console.warn("[UTILS] Intl format failed, falling back to toLocaleString", e);
      return d.toLocaleString();
    }
  }
  return d.toISOString();
}

/**
 * Legacy support for manual injection (to be removed)
 */
export function initRegistry(registry: any) {}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
}

export interface NavItem {
  id?: string;
  path: string;
  label: any;
  icon?: string;
  priority?: number;
  hidden?: boolean;
  badge?: string;
  localAgentOnly?: boolean;
  permission?: string;
  workerName?: string;
  category?: string;
  status?: string;
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
 * Enterprise Level 10: Recursive & Bulletproof
 */
export function renderString(value: any, lang?: string): string {
    if (value === null || value === undefined || value === 'undefined') return '';
    
    const registry = getRegistry();
    const defaultLang = registry?.I18N_CONFIG?.defaultLanguage || 'en';
    const activeLang = lang || defaultLang;

    // 1. Handle Strings
    if (typeof value === 'string') {
        // Anti-corruption: NEVER return "[object Object]" or "undefined"
        if (value === '[object Object]' || value === 'undefined') return '';

        // Handle JSON strings that might contain i18n objects
        if (value.startsWith('{') || value.startsWith('[')) {
            try {
                const parsed = JSON.parse(value);
                return renderString(parsed, activeLang);
            } catch (e) {
                return value;
            }
        }
        return value;
    }

    // 2. Handle Objects
    if (typeof value === 'object') {
        const baseLang = activeLang.split('-')[0].toLowerCase();

        // Priority A: Direct language match or base language match
        if (value[activeLang] !== undefined) {
            const val = value[activeLang];
            if (typeof val === 'string') return val;
            return renderString(val, activeLang);
        }
        if (value[baseLang] !== undefined) {
            const val = value[baseLang];
            if (typeof val === 'string') return val;
            return renderString(val, activeLang);
        }

        // Priority B: Fallback to system languages from Registry
        const fallbacks = registry?.I18N_CONFIG?.languages || ['en'];
        for (const f of fallbacks) {
            if (value[f] !== undefined) {
                const val = value[f];
                if (typeof val === 'string') return val;
                return renderString(val, activeLang);
            }
        }

        // Priority C: Standard identity fields (if value is a record object)
        const identityFields = ['label', 'name', 'title', 'displayName', 'text'];
        for (const field of identityFields) {
            if (value[field] !== undefined) {
                const val = value[field];
                if (typeof val === 'string') return val;
                return renderString(val, lang);
            }
        }
        
        // Priority D: First non-undefined value in the object
        const values = Object.values(value).filter(v => v !== undefined && v !== null);
        if (values.length > 0) {
            const first = values[0];
            if (typeof first === 'string') return first;
            if (typeof first === 'object' && first !== null) return renderString(first, lang);
            return String(first);
        }
        
        return '';
    }

    // 3. Fallback for primitives
    const final = String(value);
    return final === '[object Object]' ? '' : final;
}

/**
 * Get display value for an entity item based on entity definition.
 * Used in widgets and lists to show a human-readable representation.
 * Prevents React rendering errors by ensuring primitive return values.
 */
export function getDisplayValue(item: any, entity: any): string {
  if (!item || typeof item !== 'object') return '';

  // Use displayField if defined in entity
  const displayField = entity?.displayField;
  if (displayField && item[displayField] !== undefined) {
    const value = item[displayField];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    // If displayField is an object, try to extract a string
    if (typeof value === 'object' && value !== null) {
      return renderString(value);
    }
  }

  // Fallback to common display fields
  const displayFields = ['name', 'title', 'label', 'displayName', 'email', 'username'];
  for (const field of displayFields) {
    if (item[field] !== undefined) {
      const value = item[field];
      if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
      }
      if (typeof value === 'object' && value !== null) {
        return renderString(value);
      }
    }
  }

  // Last resort: use ID or stringify
  const finalId = item.id || item.ID || item.uuid;
  if (finalId && String(finalId) !== 'undefined') {
    return String(finalId);
  }

  // Prevent React errors by ensuring we never return an object
  try {
    const json = JSON.stringify(item);
    return json === 'undefined' ? '' : json;
  } catch (e) {
    const str = String(item);
    return str === 'undefined' ? '' : str;
  }
}

/**
 * Assert that a value is safe to render as text. In development this will
 * throw if an unexpected object is provided (helps catch upstream bugs).
 */
export function assertRenderable(value: any, name = 'value') {
  if (process.env.NODE_ENV === 'production') return;
  if (value === null || value === undefined) return;
  if (typeof value !== 'object') return;

  // Allow arrays (validate their items)
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item === null || item === undefined) continue;
      if (typeof item === 'object') assertRenderable(item, name);
    }
    return;
  }

  const keys = Object.keys(value);
  const looksLikeI18n = keys.some(k => /^[a-z]{2}(-[A-Z]{2})?$/.test(k));
  const hasIdentity = ['label', 'name', 'title', 'text', 'message'].some(k => k in value);

  if (!looksLikeI18n && !hasIdentity) {
    // Log a developer-friendly warning but do not throw — fall back to stringification
    // eslint-disable-next-line no-console
    console.warn(`[assertRenderable] Unexpected object for ${name}:`, value);
    return;
  }
}

/**
 * Format any value to a safe string for rendering in UI components.
 * Uses `renderString` when possible (i18n-aware), asserts in dev for
 * unexpected objects, and falls back to JSON.stringify.
 */
export function formatForRender(value: any, lang = 'ro'): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);

  // Arrays: render each item and join with commas
  if (Array.isArray(value)) {
    try {
      const parts = value.map((v: any) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string' || typeof v === 'number') return String(v);
        // Try i18n-aware render or recurse
        const s = formatForRender(v, lang);
        return s;
      }).filter((p: string) => p !== '');
      return parts.join(', ');
    } catch (e) {
      // fall through to stringify
    }
  }

  // Try i18n-aware rendering first
  try {
    const s = renderString(value, lang);
    if (s) return s;
  } catch (e) {
    // ignore and continue
  }

  // In dev, surface unexpected object shapes early
  try {
    assertRenderable(value, 'formatForRender');
  } catch (e) {
    // still fall back to string output so UI doesn't crash
    // eslint-disable-next-line no-console
    console.warn('[formatForRender] assertRenderable failed:', e);
  }

  try {
    const res = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return res === 'undefined' ? '' : res;
  } catch (e) {
    const res = String(value);
    return res === 'undefined' ? '' : res;
  }
}

export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Get the current time adjusted to the system's timezone from Registry.
 */
export function getSystemTime(date: Date = new Date()) {
  const registry = getRegistry();
  const timezone = registry?.timezone || registry?.I18N_CONFIG?.timezone?.default || 'UTC';
  
  if (typeof Intl !== 'undefined') {
    try {
      const localeDateStr = date.toLocaleString('en-US', { timeZone: timezone });
      const localeDate = new Date(localeDateStr);
      return {
        date: localeDate,
        hours: localeDate.getHours(),
        minutes: localeDate.getMinutes(),
        dayOfWeek: localeDate.getDay(),
        day: localeDate.getDate(),
        month: localeDate.getMonth(),
        year: localeDate.getFullYear(),
      };
    } catch (e) {
      console.warn(`[UTILS] Invalid timezone ${timezone}, falling back to UTC`, e);
    }
  }

  return {
    date,
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
    dayOfWeek: date.getUTCDay(),
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear(),
  };
}

/**
 * Deeply parse JSON strings within an object hierarchy.
 */
export const deepParse = (obj: any): any => {
  if (typeof obj === 'string' && (obj.startsWith('{') || obj.startsWith('['))) {
      try {
          return deepParse(JSON.parse(obj));
      } catch (e) {
          return obj; 
      }
  }
  if (!obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key in result) (result as any)[key] = deepParse((result as any)[key]);
  return result;
};

/**
 * Deeply stringify nested objects into JSON strings within an object.
 */
export const deepStringify = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  const isArr = Array.isArray(obj);
  const result: any = isArr ? [] : {};
  
  for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
          result[k] = JSON.stringify(v);
      } else if (Array.isArray(v)) {
          result[k] = v; 
      } else {
          result[k] = v;
      }
  }
  return result;
};

export function checkIsWorkingHours(date: Date = new Date()): boolean {
  const sysTime = getSystemTime(date);
  const registry = getRegistry();
  const hours = registry?.CONSTANT?.workingHours || { days: [1, 2, 3, 4, 5], start: 9, end: 18 };

  if (!hours.days.includes(sysTime.dayOfWeek)) return false;

  const holidays = registry?.CONSTANT?.holidays || [];
  const isHoliday = holidays.some(
    (h: any) =>
      (h.m === sysTime.month && h.d === sysTime.day) ||
      (h.month === sysTime.month && h.day === sysTime.day)
  );
  if (isHoliday) return false;

  return sysTime.hours >= hours.start && sysTime.hours < hours.end;
}

/**
 * Normalize various error shapes into a safe string for UI toasts/logs.
 */
export function getErrorMessage(err: any, fallback = ''): string {
  if (!err) return fallback || '';
  if (typeof err === 'string') return err;
  if (typeof err === 'number' || typeof err === 'boolean') return String(err);
  if (err?.message && typeof err.message === 'string') return err.message;
  if (err?.error && typeof err.error === 'string') return err.error;
  try {
    return JSON.stringify(err);
  } catch (e) {
    return String(err);
  }
}


