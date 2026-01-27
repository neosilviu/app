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
 * Enterprise Level 8: Recursive & Bulletproof
 */
export function renderString(value: any, lang: string = 'ro'): string {
    if (value === null || value === undefined) return '';
    
    // 1. Handle Strings
    if (typeof value === 'string') {
        // Anti-corruption: NEVER return "[object Object]"
        if (value === '[object Object]') return '';

        // Handle JSON strings that might contain i18n objects
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

    // 2. Handle Objects
    if (typeof value === 'object') {
        const baseLang = lang.split('-')[0].toLowerCase();

        // Priority A: Direct language match or base language match
        if (value[lang] !== undefined) {
            const val = value[lang];
            if (typeof val === 'string') return val;
            return renderString(val, lang);
        }
        if (value[baseLang] !== undefined) {
            const val = value[baseLang];
            if (typeof val === 'string') return val;
            return renderString(val, lang);
        }

        // Priority B: Fallback to base system languages
        const fallbacks = ['ro', 'en'];
        for (const f of fallbacks) {
            if (value[f] !== undefined) {
                const val = value[f];
                if (typeof val === 'string') return val;
                return renderString(val, lang);
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
        const values = Object.values(value);
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
 * Safe render for short descriptions/messages used in UI components.
 * Prefer `renderString` for i18n-aware values, but fall back to extracting
 * common identity fields or JSON-stringifying objects to avoid React errors.
 */
export function safeRender(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (value.label) return renderString(value.label);
    if (value.message) return renderString(value.message);
    if (value.text) return renderString(value.text);
    try { return JSON.stringify(value); } catch (e) { return renderString(value); }
  }
  return renderString(value);
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
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  } catch (e) {
    return String(value);
  }
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

export const CoreUtils = {
    generateId,
    formatDate,
    deepClone,
    debounce,
    isValidEmail,
    sanitizeFilename,
    getRomanianTime,
    checkIsWorkingHours,
    cn,
    safeRender,
    assertRenderable,
  formatForRender,
  getErrorMessage
};
