/**
 * ENTITY ENGINE CORE - Enterprise Level 8
 * Single Source of Truth for Entity Normalization & Utility
 */

import React from 'react';
import { Badge } from '~/components/ui/badge';

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
  flowRules: Record<string, {
    nextStates: string[];
    label: any;
    icon?: string;
    requiresFields?: string[];
    action?: string;
  }>;
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
  const name = raw.name || raw.id || 'unnamed_entity';
  
  // 1. Fields Normalization (Convert Object to Array if needed)
  let fields: FieldDefinition[] = [];
  const rawFields = safeParse(raw.fields, []);
  
  if (Array.isArray(rawFields)) {
    fields = rawFields.map((f: any, idx: number) => ({
      ...f,
      name: f.name || f.id || `field_${idx}`,
      label: f.label || (f.name ? f.name.charAt(0).toUpperCase() + f.name.slice(1).replace(/([A-Z])/g, ' $1').trim() : `Field ${idx}`),
      type: f.type || 'text'
    }));
  } else if (typeof rawFields === 'object' && rawFields !== null) {
    fields = Object.entries(rawFields).map(([key, f]: [string, any]) => ({
      ...(typeof f === 'object' ? f : { type: f }),
      name: key,
      label: (f && typeof f === 'object' && f.label) || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()
    }));
  }

  // Enterprise Level 8: Build the Fields Map BEFORE usage in UI Logic
  const fieldsMap = fields.reduce((acc: Record<string, FieldDefinition>, f) => ({ ...acc, [f.name]: f }), {});

  // 2. uiConfig Normalization (Enterprise Level 8 Auto-Layout)
  const ui = safeParse(raw.uiConfig, {});
  const uiConfig = {
    ...ui,
    list: { 
      columns: [], 
      showActions: false, // Default to false for List view
      ...(ui.list || {}) 
    },
    form: { 
      columns: 2, 
      sections: [], 
      showChildren: false, 
      hiddenChildren: [], 
      showActions: false, // Keep for backward compat/other uses if needed
      ...(ui.form || {}) 
    }
  };

  // Auto-generate list columns if empty
  if (uiConfig.list.columns.length === 0 && fields.length > 0) {
    // Pick relevant fields (exclude long text/json and ID)
    const listEligible = fields.filter(f => !['richtext', 'json', 'relation-many'].includes(f.type) && f.name !== 'id');
    uiConfig.list.columns = listEligible.slice(0, 5).map(f => f.name);
    // Always ensure the displayField is in the list
    let disp = raw.displayField || 'id';
    // Validate if display field actually exists in current fields. If not, fallback to 'id'
    if (disp !== 'id' && !fieldsMap[disp]) {
      disp = 'id';
    }

    if (!uiConfig.list.columns.includes(disp)) {
      uiConfig.list.columns.unshift(disp);
    }
  }

  // Auto-generate form sections if empty
  if (uiConfig.form.sections.length === 0 && fields.length > 0) {
    uiConfig.form.sections = [
      {
        id: 'main',
        title: { ro: 'Informații Generale', en: 'General Information' },
        icon: 'Info',
        fields: fields
          .filter(f => !['id', 'workspaceId', 'createdAt', 'updatedAt', 'deletedAt', 'created_by'].includes(f.name))
          .map(f => f.name)
      }
    ];
  }

  // 3. Features Normalization
  const feat = safeParse(raw.features, {});
  const features = {
    auditable: true,
    creatable: true,
    editable: true,
    deletable: true,
    softDelete: true, // Enterprise Level 8: Default to soft-delete
    timestamps: true,
    ...feat
  };

  // 4. Permission Normalization
  const perm = safeParse(raw.permission ?? raw.permissions, {});
  const permission = {
    role: {},
    ownerOnly: false,
    ...perm
  };

  const isContact = name.toLowerCase() === 'contact';
  const isCrmCore = ['contact', 'deal', 'interaction', 'task', 'ticket', 'lead'].includes(name.toLowerCase());

  // 6. Metadata Normalization (Menu, Dashboard, Relationships)
  const menuConfig = {
    showInMainMenu: true,
    showInNewMenu: true, // Enterprise Level 8: Default to true for all entities so they show up in "+" menu
    priority: 50,
    ...safeParse(raw.menuConfig, {})
  };

  const dashboardConfig = {
    enabled: isContact, // "Activare Widget" - Default false, except for contacts
    widgetType: 'table',
    summaryFields: [],
    showRecent: true,
    // Enterprise Level 8: Defaults to false (except for contact)
    showInDashboard: isContact, 
    ...safeParse(raw.dashboardConfig || raw.dashboard, {})
  };

  // Enterprise Level 8: Alignment Logic
  // If the user explicitly enabled the widget in the Builder, make sure it's visible.
  const rawDash = safeParse(raw.dashboardConfig || raw.dashboard, {});
  if (rawDash.enabled === true && dashboardConfig.showInDashboard === false) {
    dashboardConfig.showInDashboard = true;
  }
  // Conversely, if they explicitly disabled it, hide it.
  if (rawDash.enabled === false) {
    dashboardConfig.showInDashboard = false;
  }

  const relationships = Array.isArray(raw.relationships) ? raw.relationships : safeParse(raw.relationships, []);
  const validations = safeParse(raw.validations, {});
  const layout = safeParse(raw.layout, {});

  // 7. Build Final Object
  // Enterprise Level 8: Ensure we parse recursively for translations in top-level fields
  // Added protection against "[object Object]" corruption
  const parseStr = (val: any) => {
    if (val === '[object Object]') return null;
    return (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) ? safeParse(val, val) : val;
  };

  // Enterprise Level 8: Natural Language Label Generation (Auto-generate if missing)
  const humanize = (s: string) => {
    if (!s) return '';
    return s.split(/_|\s|-/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };
  const autoLabel = humanize(name);

  // Enterprise Level 8: Always ensure a multi-lang object if we're auto-generating
  const defaultLabel = { ro: autoLabel, en: autoLabel };
  const label = parseStr(raw.label);

  // Enterprise Level 8: Labels can be pluralized for UI display, 
  // but NEVER use this for database table names (tableName).
  const getAutoPlural = (l: any) => {
    if (typeof l === 'string') return `${l}s`;
    if (typeof l === 'object' && l !== null) {
        return {
            ro: `${l.ro || autoLabel}e`,
            en: `${l.en || autoLabel}s`
        };
    }
    return { ro: `${autoLabel}e`, en: `${autoLabel}s` };
  };

  return {
    ...raw,
    name: name.toLowerCase(),
    label: label || defaultLabel,
    labelPlural: parseStr(raw.labelPlural) || getAutoPlural(label || defaultLabel),
    description: parseStr(raw.description) || '',
    icon: raw.icon || 'Box',
    colorTheme: raw.colorTheme || raw.color || 'blue',
    tableName: raw.tableName || name.toLowerCase(),
    displayField: raw.displayField || '',
    fields, // This is the Array
    fieldsMap, // This is the Object/Map
    uiConfig,
    features,
    permission,
    menuConfig,
    dashboardConfig,
    relationships,
    dependencies: Array.isArray(raw.dependencies) ? raw.dependencies : (Array.isArray(raw.requires) ? raw.requires : safeParse(raw.dependencies || raw.requires, [])),
    validations,
    layout,
    flowRules: safeParse(raw.flowRules, {}),
    isSystem: !!raw.isSystem
  };
}

/**
 * GET DISPLAY VALUE
 * Logic to consistently show the identity of a record across the app.
 * Priority: displayField from config > 'name' > 'title' > 'label' > 'id'
 */
/**
 * GET AUDIT SNAPSHOT
 * Prepares data for audit_log by removing sensitive or internal fields.
 */
export function getAuditSnapshot(data: any, entity: EntityDefinition): any {
  if (!data) return null;
  const snapshot = { ...data };
  
  // 1. Remove hardcoded sensitive fields
  const sensitive = ['password', 'secret', 'token', 'apiKey', 'creditCard'];
  sensitive.forEach(k => delete snapshot[k]);
  
  // 2. Remove fields marked as sensitive in entity definition
  const fields = entity.fieldsList || (Array.isArray(entity.fields) ? entity.fields : Object.values(entity.fields));
  (fields as FieldDefinition[]).forEach((f: FieldDefinition) => {
    if (f.sensitive || f.type === 'password') {
      delete snapshot[f.name];
    }
  });

  return snapshot;
}

/**
 * IS FIELD VISIBLE
 * Evaluates visibility conditions for a field based on current record values.
 */
export function isFieldVisible(field: FieldDefinition, values: any): boolean {
  if (!field.visibility || field.visibility.type === 'always') return true;
  if (field.visibility.type === 'hidden') return false;
  
  if (field.visibility.type === 'condition' && field.visibility.dependsOn) {
    const { dependsOn, operator, value } = field.visibility;
    const actualValue = values[dependsOn];
    
    switch (operator) {
      case '==': return actualValue == value;
      case '!=': return actualValue != value;
      case 'contains': return Array.isArray(actualValue) ? actualValue.includes(value) : String(actualValue).includes(value);
      case 'exists': return actualValue !== undefined && actualValue !== null && actualValue !== '';
      default: return true;
    }
  }
  
  return true;
}

/**
 * RENDER TEMPLATE
 * Substitutes {{variable}} placeholders in a string using provided data.
 */
export function renderTemplate(template: string, data: any): string {
  if (!template || typeof template !== 'string') return '';
  if (!data || typeof data !== 'object') return template;
  
  return template.replace(/\{\{\s*([\w\.]+)\s*\}\}/g, (match, path) => {
    // Handle nested paths like "owner.name"
    const value = path.split('.').reduce((acc: any, part: string) => acc && acc[part], data);
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * GET SEARCHABLE FIELDS
 * Returns field names marked as searchable, or defaults based on type.
 */
export function getSearchableFields(entity: EntityDefinition): string[] {
  const fields = (entity.fieldsList || (Array.isArray(entity.fields) ? entity.fields : Object.values(entity.fields))) as FieldDefinition[];
  
  // Explicitly marked fields
  const marked = fields.filter((f) => f.searchable).map(f => f.name);
  if (marked.length > 0) return marked;
  
  // Intelligent defaults (Text-like fields)
  return fields
    .filter((f) => ['text', 'email', 'phone', 'textarea', 'url', 'id'].includes(f.type))
    .map(f => f.name)
    .slice(0, 5); // Limit to top 5 for performance
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
  const normalizedData: any = {};
  if (!rawData) return normalizedData;
  if (!Array.isArray(fieldsList)) return rawData; // Fallback if no fields defined
  
  // Enterprise Level 8: Case-Insensitive Raw Data Access
  // D1 and SQLite can sometimes return different casing for columns than defined in the registry.
  const rawKeys = Object.keys(rawData || {});
  const findValue = (key: string) => {
    if (!rawData) return undefined;
    if (key in rawData) return rawData[key];
    const lowerKey = key.toLowerCase();
    const match = rawKeys.find(k => k.toLowerCase() === lowerKey);
    return match ? rawData[match] : undefined;
  };
  
  // First, normalize all fields defined in the config
  fieldsList.forEach((field) => {
    const fieldName = field.name;
    const fieldValue = findValue(fieldName);

    const fieldType = field.type;
    
    // For relation fields, extract the ID if the value is an object
    // Enterprise Level 8: Include 'tag' and 'multi-select' as relation types
    const isRelation = (fieldType === 'entity_relation' || fieldType === 'relation' || fieldType === 'relation-many' || fieldType === 'tag' || fieldType === 'multi-select');

    if (isRelation && fieldValue) {
      if (fieldType === 'relation-many' || fieldType === 'tag' || fieldType === 'multi-select' || field.multiple) {
        // For many relations, ensure we have an array of IDs
        if (Array.isArray(fieldValue)) {
          // Enterprise Level 8: Preserve rich objects if they are already populated.
          // This allows components like DynamicEntityList to render badges without re-fetching lookups.
          normalizedData[fieldName] = fieldValue
            .filter(item => item !== null && item !== undefined)
            .map(item => {
              if (typeof item === 'object' && item !== null) {
                  // If it's a rich object (has name/label/display field), keep it as is
                  // but ensure it has an ID for consistency.
                  const id = item.id || item.ID || item.uuid || item.key;
                  if (id) return item; 
                  return String(item);
              }
              return String(item);
            });
        } else if (typeof fieldValue === 'string' && fieldValue) {
          // Enterprise Level 8: Robust parsing (JSON or Comma-separated)
          let cleanVal = fieldValue.trim();
          if (cleanVal.startsWith('[') && cleanVal.endsWith(']')) {
              try {
                  const parsed = JSON.parse(cleanVal);
                  // Preserve objects if they exist in the parsed JSON (Enterprise Level 8)
                  normalizedData[fieldName] = Array.isArray(parsed) 
                    ? parsed.map(item => (typeof item === 'object' && item !== null) ? item : String(item)) 
                    : [cleanVal];
              } catch {
                  normalizedData[fieldName] = cleanVal.substring(1, cleanVal.length - 1).split(/[,;|]/).map(s => s.trim().replace(/[\\"]/g, '')).filter(Boolean);
              }
          } else {
              normalizedData[fieldName] = cleanVal.split(/[,;|]/).map(s => s.trim().replace(/[\\"[\]]/g, '')).filter(Boolean);
          }
        } else {
          normalizedData[fieldName] = [];
        }
      } else {
        // For single relations, extract the ID if it's a simple shell object,
        // but PRESERVE it if it contains more metadata (like name/label for display).
        if (typeof fieldValue === 'object' && fieldValue !== null) {
          const keys = Object.keys(fieldValue);
          // Enterprise Level 8: A rich object is one that has displayable text (name, label, title, etc.)
          const hasDisplayField = keys.some(k => ['name', 'label', 'Label', 'Name', 'title', 'Title'].includes(k));
          const isRichObject = keys.length > 2 || hasDisplayField;
          
          if (isRichObject) {
            normalizedData[fieldName] = fieldValue;
          } else {
            normalizedData[fieldName] = fieldValue.id || fieldValue.ID || fieldValue.uuid || fieldValue.key || null;
          }
        } else {
          // Enterprise Level 8: Preserve null for DB foreign keys. Empty string in a relation also means null.
          normalizedData[fieldName] = (fieldValue === null || fieldValue === undefined || fieldValue === '') ? null : fieldValue;
        }
      }
    } else {
      // For non-relation fields, ensure primitive values to prevent React errors
      if (typeof fieldValue === 'object' && fieldValue !== null) {
        // If it's an object, it might be an i18n object {ro, en} - leave as is
        if (fieldValue.ro !== undefined || fieldValue.en !== undefined) {
          normalizedData[fieldName] = fieldValue;
        } else if (fieldValue.id !== undefined) {
          normalizedData[fieldName] = fieldValue.id;
        } else if (fieldValue.name !== undefined) {
          normalizedData[fieldName] = fieldValue.name;
        } else if (fieldValue.value !== undefined) {
          normalizedData[fieldName] = fieldValue.value;
        } else {
          // Fallback: stay as object if it's not a known identity structure
          normalizedData[fieldName] = fieldValue; 
        }
      } else {
        // For primitive values, use as-is
        normalizedData[fieldName] = (fieldValue === null || fieldValue === undefined) ? null : fieldValue;
      }
    }
  });
  
  // Then, normalize any additional fields from the API that aren't in the config
  // (like audit fields: createdBy, workspaceId, etc.)
  Object.keys(rawData).forEach((key) => {
    if (!(key in normalizedData)) {
      const fieldValue = rawData[key];
      if (typeof fieldValue === 'object' && fieldValue !== null) {
        // For any object field not in config, extract primitive value
        if (fieldValue.id !== undefined) {
          normalizedData[key] = fieldValue.id;
        } else if (fieldValue.name !== undefined) {
          normalizedData[key] = fieldValue.name;
        } else if (fieldValue.value !== undefined) {
          normalizedData[key] = fieldValue.value;
        } else {
          // Fallback: stringify the object
          normalizedData[key] = JSON.stringify(fieldValue);
        }
      } else {
        // For primitive values, use as-is
        // Enterprise Level 8: Preserve null for DB foreign keys. 
        // For additional audit fields that end in 'Id' or 'By', treat empty string as null.
        if (fieldValue === '' && (key.endsWith('Id') || key.endsWith('By'))) {
          normalizedData[key] = null;
        } else {
          normalizedData[key] = (fieldValue === null || fieldValue === undefined) ? null : fieldValue;
        }
      }
    }
  });

  return normalizedData;
}

/**
 * FORMAT DISPLAY VALUE
 * Formats values for display in lists/tables based on field type.
 * Handles all field types safely to prevent React rendering errors.
 */
export function formatDisplayValue(val: any, field: FieldDefinition): React.ReactNode {
  if (val === undefined || val === null || val === '') return '-';

  const fieldType = field.type;

  // Handle objects first to prevent React errors
  if (typeof val === 'object' && val !== null) {
    // For relation fields, extract display value
    if ((fieldType === 'relation' || fieldType === 'entity_relation' || fieldType === 'relation-many' || fieldType === 'tag' || fieldType === 'multi-select' || field.multiple) && val) {
      const displayKey = field.displayField || field.relation?.displayField || field.relation?.field || field.displayKey || 'name';
      
      const getLabel = (item: any, preferred: string) => {
          if (!item || typeof item !== 'object') return String(item);
          
          // Enterprise Level 8: Robust Label Resolution
          // 1. Exact match
          if (item[preferred]) return String(item[preferred]);
          
          // 2. Case-insensitive match
          const foundKey = Object.keys(item).find(k => k.toLowerCase() === preferred.toLowerCase());
          if (foundKey && item[foundKey]) return String(item[foundKey]);
          
          return String(item.id || item.ID || item.uuid || 'N/A');
      };

      // Level 8: Handle arrays of objects for relation-many/tag/multi-select
      if (Array.isArray(val)) {
        if (val.length === 0) return '-';
        return (
          <div className="flex flex-wrap gap-1">
            {val.map((v, i) => {
              const label = getLabel(v, displayKey);
              const color = typeof v === 'object' && v ? v.colorTheme || v.color : undefined;
              return (
                <Badge 
                  key={i} 
                  variant="outline" 
                  style={{ 
                    backgroundColor: color ? `${color}15` : undefined,
                    borderColor: color ? `${color}40` : undefined,
                    color: color || '#64748b'
                  }}
                  className="px-1.5 py-0 h-4 text-[8px] font-bold uppercase tracking-tighter"
                >
                  {String(label).substring(0, 15)}
                </Badge>
              );
            })}
          </div>
        );
      }

      return <span className="font-medium text-primary">{getLabel(val, displayKey)}</span>;
    }
    // For other objects, stringify safely
    return <code className="text-xs bg-muted px-1 py-0.5 rounded block max-w-[200px] truncate">
      {JSON.stringify(val)}
    </code>;
  }

  // Text and basic types
  if (!fieldType || fieldType === 'text' || fieldType === 'textarea') {
    return String(val);
  }

  // Numbers and formats
  if (fieldType === 'number') return String(val);
  if (fieldType === 'currency') return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR' }).format(val);
  if (fieldType === 'percent') return `${val}%`;

  // Dates
  if (fieldType === 'date') return new Date(val).toLocaleDateString();
  if (fieldType === 'datetime') return new Date(val).toLocaleString();

  // Boolean
  if (fieldType === 'boolean' || fieldType === 'toggle') {
    return val ? <Badge className="bg-emerald-500 text-white border-none py-0 h-4 text-[8px]">DA</Badge> : <Badge variant="outline" className="text-slate-300 py-0 h-4 text-[8px]">NU</Badge>;
  }

  // Enum/Selection
  if (fieldType === 'enum' || fieldType === 'selection') {
    return <Badge variant="outline" className="text-xs">{String(val)}</Badge>;
  }

  // Relations (when not objects)
  const isRelation = (fieldType === 'relation' || fieldType === 'entity_relation' || fieldType === 'relation-many' || fieldType === 'tag' || fieldType === 'multi-select');

  if (isRelation) {
    if (!val || val === '[]' || val === '{}') return '-';
    
    // For multiple relations stored as comma-separated strings or arrays, render as badges even if names are missing
    const isMultiple = (fieldType === 'relation-many' || fieldType === 'tag' || fieldType === 'multi-select' || field.multiple);
    
    if (isMultiple) {
        const ids = Array.isArray(val) ? val : String(val).split(',').filter(Boolean);
        if (ids.length === 0) return '-';
        return (
            <div className="flex flex-wrap gap-1">
                {ids.map((id, i) => {
                    const displayId = (typeof id === 'object' && id !== null) ? (id.id || id.ID || id.name || JSON.stringify(id)) : String(id);
                    return (
                        <Badge key={i} variant="secondary" className="px-1.5 py-0 h-4 text-[9px] font-bold uppercase tracking-tighter bg-slate-100 text-slate-500 border-none">
                            {displayId.length > 12 ? displayId.substring(0, 10) + '..' : displayId}
                        </Badge>
                    );
                })}
            </div>
        );
    }
    return <span className="text-slate-600 font-medium">{String(val || 'N/A')}</span>;
  }

  // JSON/Object
  if (fieldType === 'json' || fieldType === 'object') {
    return <code className="text-xs bg-muted px-1 py-0.5 rounded block max-w-[200px] truncate">
      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
    </code>;
  }

  // Files/Images
  if (fieldType === 'image' || fieldType === 'file') {
    return val ? <Badge variant="outline" className="text-xs">📎</Badge> : '-';
  }

  // Fallback for unknown types
  return <code className="text-xs bg-red-50 text-red-700 px-1 py-0.5 rounded">
    {String(val)}
  </code>;
}

/**
 * FORMAT FORM VALUE
 * Formats values for form inputs based on field type.
 * Ensures primitive values to prevent React rendering errors in forms.
 */
export function formatFormValue(val: any, fieldType: string): any {
  // Enterprise Level 8: Preserve null for DB foreign keys while allowing empty strings for text
  if (val === null || val === undefined) return null;
  
  // For relations, empty string means NULL to satisfy DB foreign key constraints
  if (val === '' && (fieldType === 'entity_relation' || fieldType === 'relation')) return null;
  if (val === '') return '';

  // Handle date/datetime formatting for inputs
  if (fieldType === 'date' || fieldType === 'datetime' || fieldType === 'datetime-local') {
    try {
      const date = new Date(val);
      if (isNaN(date.getTime())) return '';
      if (fieldType === 'date') return date.toISOString().split('T')[0];
      // Format for datetime-local: YYYY-MM-DDTHH:mm
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch (e) { return val; }
  }

  // Handle objects to prevent React errors
  if (typeof val === 'object' && val !== null) {
    // Enterprise Level 8: If it's an array (relation-many), return as is
    if (Array.isArray(val)) return val;

    // For relation fields, extract ID
    if ((fieldType === 'entity_relation' || fieldType === 'relation') && val.id) {
      return val.id;
    }
    // For other objects, stringify as fallback
    return JSON.stringify(val);
  }

  return val;
}

