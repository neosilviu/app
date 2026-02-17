/**
 * ENTITY ENGINE CORE - Enterprise Level 10
 * Single Source of Truth for Autonomous Entity Normalization
 */

import React from 'react';
import { Badge } from '~/components/ui/badge';
import { BASE_ENTITY_FIELDS, BASE_ENTITY_FEATURES } from '../../../registry-baseline';
import { getRegistry } from './registry';
import { renderString } from './utils';

export interface FieldDefinition {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  searchable?: boolean;
  multiple?: boolean;
  width?: string;
  options?: any[];
  currency?: { code: string; decimals: number };
  ui?: Record<string, any>;
  visibility?: {
    type: 'always' | 'hidden' | 'condition';
    dependsOn?: string;
    operator?: string;
    value?: any;
  };
  validation?: Record<string, any>;
  [key: string]: any;
}

export interface EntityDefinition {
  id?: string;
  name: string;
  label: string;
  labelPlural?: string;
  description?: string;
  icon?: string;
  colorTheme?: string;
  tableName?: string;
  displayField?: string;
  excludeBaseFields?: string[];
  fields: FieldDefinition[];
  fieldsMap: Record<string, FieldDefinition>;
  uiConfig: {
    list: { 
      columns: string[];
      showActions?: boolean;
      showAuditFields?: boolean;
      itemsPerPage?: number;
    };
    form: { 
      columns?: number;
      sections?: any[];
      showChildren?: boolean;
      hiddenChildren?: string[];
      showActions?: boolean;
      hiddenFields?: string[];
      showTimestamps?: boolean;
      showAuditFields?: boolean;
      readOnlyFields?: string[];
    };
    [key: string]: any;
  };
  features: {
    auditable?: boolean;
    creatable?: boolean;
    editable?: boolean;
    deletable?: boolean;
    softDelete?: boolean;
    attachments?: boolean;
    import?: boolean;
    export?: boolean;
    comments?: boolean;
    timestamps?: boolean;
    authorTracking?: boolean;
    workflow?: {
      statusField?: string;
    };
    [key: string]: any;
  };
  permission: {
    role: Record<string, { read: boolean; write: boolean; delete: boolean } | string[]>;
    ownerOnly?: boolean;
  };
  menuConfig: {
    showInMainMenu?: boolean;
    label?: string;
    path?: string;
    category?: string;
    priority?: number;
    icon?: string;
  };
  dashboardConfig: {
    enabled?: boolean;
    showInDashboard?: boolean;
    widgetType?: 'table' | 'grid' | 'stats' | 'chart' | 'list';
    summaryFields?: string[];
    metrics?: any[];
    showRecent?: boolean;
    [key: string]: any;
  };
  relationships: any[];
  validations: Record<string, any>;
  layout: Record<string, any>;
  indexes?: string[];
  flowRules: Record<string, {
    nextStates: string[];
    label: any;
    icon?: string;
    requiresFields?: string[];
    action?: string;
  }>;
  dbConfig: {
    tableName?: string;
    indexes?: string[];
    softDelete?: boolean;
    primaryKey?: string;
  };
  logicConfig: {
    flowRules?: Record<string, any>;
    validations?: Record<string, any>;
    computedFields?: Record<string, string>;
  };
  searchConfig: {
    enabled?: boolean;
    weights?: Record<string, number>;
    semantic?: boolean;
  };
  auditConfig: {
    enabled?: boolean;
    excludeFields?: string[];
    retentionDays?: number;
  };
  apiConfig: {
    public?: boolean;
    rateLimit?: number;
    methods?: string[];
  };
  dependencies?: string[];
  isSystem?: boolean | number;
  workspaceId?: string;
  [key: string]: any;
}

/**
 * Safe JSON Parse helper
 */
export function safeParse(data: any, fallback: any = {}): any {
  if (data === null || data === undefined) return fallback;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch (e) {
    return fallback;
  }
}

/**
 * NORMALIZE ENTITY
 * The "Single Lens" for all Entity Definitions in the system.
 * Use this in Frontend (Registry) and Backend (Brain).
 */
export function normalizeEntity(raw: any): EntityDefinition {
  const name = (raw?.id || raw?.tableName || 'unnamed').toLowerCase();
  
  // 1. Fields Normalization (Object-based only - V3 standard)
  const rawFields = safeParse(raw?.fields, {});
  let fields: FieldDefinition[] = Object.entries(rawFields)
    .filter(([_, f]) => f !== null && f !== false)
    .map(([key, f]: [string, any]) => ({
      ...(typeof f === 'object' ? f : { type: f }),
      name: key,
      label: (f && typeof f === 'object' && f.label) || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()
    }));

  const normalizedLabel = renderString(raw?.label || name);
  const normalizedDescription = renderString(raw?.description || '');

  // 2. Structural Inheritance (Base Fields)
  let baseFieldsMap = { ...(BASE_ENTITY_FIELDS || {}) } as Record<string, any>;
  const excluded = Array.isArray(raw?.excludeBaseFields) ? raw.excludeBaseFields : [];
  excluded.forEach((fName: string) => {
    const fieldsCopy = { ...baseFieldsMap };
    delete fieldsCopy[fName];
    baseFieldsMap = fieldsCopy;
  });

  // Merge fields
  const fieldsMap: Record<string, any> = {};
  
  // Enterprise Level 10: Structural DNA Inheritance (System Fields Alignment)
  Object.entries(baseFieldsMap).forEach(([key, f]) => {
    fieldsMap[key] = { ...(f as any), name: key, id: key };
  });

  fields.forEach(f => {
    const fieldLabel = renderString(f.label);
    const fname = f.name || f.id || 'unknown';
    fieldsMap[fname] = { 
        ...fieldsMap[fname], 
        ...f, 
        name: fname,
        id: fname,
        label: fieldLabel,
        labelRaw: f.label || fieldLabel 
    };
  });

  fields = Object.values(fieldsMap);

  // 3. UI/Features Normalization
  const ui = safeParse(raw?.uiConfig, {});
  const uiConfig = {
    ...ui,
    list: { columns: [], showActions: false, ...(ui.list || {}) },
    form: { columns: 2, sections: [], showChildren: false, hiddenChildren: [], ...(ui.form || {}) }
  };

  if (uiConfig.list.columns.length === 0 && fields.length > 0) {
    uiConfig.list.columns = fields
      .filter(f => !['richtext', 'json'].includes(f.type) && f.name !== 'id' && !f.hidden && !f.hideInTable)
      .slice(0, 5)
      .map(f => f.name);
    
    // Fallback if all fields are hidden, at least show displayField
    if (uiConfig.list.columns.length === 0) {
        const disp = raw?.displayField || 'id';
        if (fieldsMap[disp]) uiConfig.list.columns.push(disp);
    }
    
    const disp = raw?.displayField || 'id';
    if (!uiConfig.list.columns.includes(disp) && fieldsMap[disp] && !fieldsMap[disp].hidden) uiConfig.list.columns.unshift(disp);
  }

  const features = { ...BASE_ENTITY_FEATURES, ...safeParse(raw?.features, {}) };
  const permission = { role: {}, ownerOnly: false, ...safeParse(raw?.permission ?? raw?.permissions, {}) };

  const menuConfig = { showInMainMenu: true, showInNewMenu: true, priority: 50, ...safeParse(raw?.menuConfig, {}) };
  const dashboardConfig = {
    enabled: false,
    widgetType: 'table',
    showInDashboard: false,
    ...safeParse(raw?.dashboardConfig || raw?.dashboard, {})
  };

  // Enterprise Level 10: Structural Layer Normalization
  const dbConfig = {
    tableName: raw?.tableName || name,
    indexes: Array.isArray(raw?.indexes) ? raw.indexes : safeParse(raw?.indexes, []),
    softDelete: features.softDelete !== false,
    primaryKey: raw?.dbConfig?.primaryKey || 'id',
    ...safeParse(raw?.dbConfig, {})
  };

  const logicConfig = {
    flowRules: raw?.flowRules || safeParse(raw?.logicConfig?.flowRules, {}),
    validations: raw?.validations || safeParse(raw?.logicConfig?.validations, {}),
    computedFields: safeParse(raw?.logicConfig?.computedFields, {}),
    ...safeParse(raw?.logicConfig, {})
  };

  const searchConfig = {
    enabled: true,
    semantic: false,
    weights: {},
    ...safeParse(raw?.searchConfig, {})
  };

  const auditConfig = {
    enabled: features.auditable !== false,
    excludeFields: [],
    retentionDays: 90,
    ...safeParse(raw?.auditConfig, {})
  };

  const apiConfig = {
    public: false,
    rateLimit: 100,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    ...safeParse(raw?.apiConfig, {})
  };

  // Alignment
  if (dashboardConfig.enabled) dashboardConfig.showInDashboard = true;

  return {
    ...raw,
    name,
    label: normalizedLabel, 
    labelRaw: safeParse(raw?.label, { ro: normalizedLabel, en: normalizedLabel }),
    labelPlural: renderString(raw?.labelPlural) || `${normalizedLabel}s`,
    description: normalizedDescription,
    fields,
    fieldsMap,
    uiConfig,
    features,
    permission,
    menuConfig,
    dashboardConfig,
    dbConfig,
    logicConfig,
    searchConfig,
    auditConfig,
    apiConfig,
    relationships: Array.isArray(raw?.relationships) ? raw.relationships : safeParse(raw?.relationships, []),
    actions: Array.isArray(raw?.actions) ? raw.actions : [],
    isSystem: !!raw?.isSystem
  };
}

/**
 * RESOLVE RECORD DISPLAY
 * Logic to consistently show the identity of a record across the app.
 * Priority: displayField from config > 'name' > 'title' > 'label' > 'id'
 */
export function resolveRecordDisplay(obj: any, entityType?: string, systemConfig?: any): string {
  if (!obj) return '-';
  if (typeof obj !== 'object') return String(obj);
  
  // 1. Preferred Field from Entity Config
  const displayField = entityType && systemConfig?.entity?.[entityType]?.displayField;
  if (displayField && obj[displayField] !== undefined && obj[displayField] !== null) {
      return String(obj[displayField]);
  }

  // 2. Global Level 10 Fallback Hierarchy
  const fallbacks = ['name', 'label', 'title', 'subject', 'filename', 'identifier', 'id', 'ID', 'uuid'];
  for (const key of fallbacks) {
      if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).toLowerCase() !== 'undefined') {
          return String(obj[key]);
      }
  }

  // 3. Last Resort: Any non-system string
  const fallbackKey = Object.keys(obj).find(k => 
      typeof obj[k] === 'string' && 
      !['id', 'workspaceId', 'createdBy', 'updatedBy', 'deletedAt'].includes(k)
  );
  
  return fallbackKey ? String(obj[fallbackKey]) : (obj.id || obj.ID || 'Unnamed Record');
}

/**
 * THEME CLASSES HELPER
 * Maps a generic theme color to Tailwind classes
 */
export function getThemeClasses(color: string = 'blue') {
  const c = color.toLowerCase();
  const map: Record<string, { bg: string, text: string, border: string, ring: string }> = {
    blue:    { bg: 'bg-blue-600',    text: 'text-blue-600',    border: 'border-blue-100',    ring: 'ring-blue-500/20' },
    emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-100', ring: 'ring-emerald-500/20' },
    green:   { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-100', ring: 'ring-emerald-500/20' },
    purple:  { bg: 'bg-purple-600',  text: 'text-purple-600',  border: 'border-purple-100',  ring: 'ring-purple-500/20' },
    rose:    { bg: 'bg-rose-600',    text: 'text-rose-600',    border: 'border-rose-100',    ring: 'ring-rose-500/20' },
    red:     { bg: 'bg-rose-600',    text: 'text-rose-600',    border: 'border-rose-100',    ring: 'ring-rose-500/20' },
    amber:   { bg: 'bg-amber-600',   text: 'text-amber-600',   border: 'border-amber-100',   ring: 'ring-amber-500/20' },
    slate:   { bg: 'bg-slate-600',   text: 'text-slate-600',   border: 'border-slate-100',   ring: 'ring-slate-500/20' },
    indigo:  { bg: 'bg-indigo-600',  text: 'text-indigo-600',  border: 'border-indigo-100',  ring: 'ring-indigo-500/20' },
  };
  return map[c] || map.indigo;
}

/**
 * NORMALIZE FORM DATA
 * Extracts primitive values from relation objects to prevent React rendering errors.
 * Used when loading data from APIs that return full objects for relations.
 */
export function normalizeFormData(rawData: any, fieldsList: FieldDefinition[]): any {
  const normalized: any = {};
  if (!rawData) return normalized;

  (fieldsList || []).forEach((field) => {
    const val = rawData[field.name];
    const isMulti = field.type?.includes('many') || field.type === 'tag' || field.type === 'multi-select' || field.multiple;

    if (isMulti) {
      if (Array.isArray(val)) normalized[field.name] = val;
      else if (typeof val === 'string') {
        try { normalized[field.name] = JSON.parse(val); }
        catch { normalized[field.name] = val.split(/[,;|]/).map(s => s.trim()).filter(Boolean); }
      } else normalized[field.name] = [];
    } else if (typeof val === 'object' && val !== null && !val.ro) {
      normalized[field.name] = val.id || val.ID || val.uuid || val;
    } else {
      normalized[field.name] = val ?? null;
    }
  });

  return { ...rawData, ...normalized };
}

export function formatDisplayValue(val: any, field: FieldDefinition): React.ReactNode {
  if (val === undefined || val === null || val === '') return '-';

  const type = field.type || 'text';
  const registry = getRegistry();
  const lang = registry?.I18N_CONFIG?.defaultLanguage || 'ro';
  const currencyCode = field.currency?.code || registry?.I18N_CONFIG?.currencyFormat?.default || 'EUR';

  // Relations & Tags
  if (type.includes('relation') || type === 'tag' || type === 'multi-select' || field.multiple) {
    const items = Array.isArray(val) ? val : [val];
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((v, i) => {
          const label = typeof v === 'object' ? (v.name || v.label || v.title || v.id || 'N/A') : String(v);
          return (
            <Badge key={i} variant="outline" className="px-1.5 py-0 h-4 text-[8px] font-bold uppercase">
              {String(label).substring(0, 20)}
            </Badge>
          );
        })}
      </div>
    );
  }

  if (typeof val === 'object') return <code className="text-xs truncate">{JSON.stringify(val)}</code>;

  // Simple formatting
  switch (type) {
    case 'currency': return new Intl.NumberFormat(lang, { style: 'currency', currency: currencyCode }).format(val);
    case 'date': return new Date(val).toLocaleDateString(lang);
    case 'datetime': return new Date(val).toLocaleString(lang);
    case 'boolean':
    case 'toggle': return val ? <Badge className="bg-emerald-500 h-4 text-[8px]">DA</Badge> : <Badge variant="outline" className="h-4 text-[8px]">NU</Badge>;
    default: return String(val);
  }
}

export function formatFormValue(val: any, fieldType: string): any {
  if (val === null || val === undefined) return null;
  if (val === '' && fieldType.includes('relation')) return null;
  
  if (fieldType.startsWith('date')) {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return fieldType === 'date' ? d.toISOString().split('T')[0] : d.toISOString().slice(0, 16);
  }

  if (typeof val === 'object' && !Array.isArray(val)) return val.id || JSON.stringify(val);
  return val;
}

