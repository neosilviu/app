/**
 * ENTITY ENGINE CORE - Enterprise Level 8
 * Single Source of Truth for Entity Normalization & Utility
 */

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
    list: { columns: string[] };
    form: { 
      columns?: number;
      sections?: any[];
      showChildren?: boolean;
      hiddenChildren?: string[];
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
    roles: Record<string, { read: boolean; write: boolean; delete: boolean } | string[]>;
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

  // 2. uiConfig Normalization
  const ui = safeParse(raw.uiConfig, {});
  const uiConfig = {
    list: { columns: [], ...(ui.list || {}) },
    form: { columns: 2, sections: [], showChildren: true, hiddenChildren: [], ...(ui.form || {}) },
    ...ui
  };

  // 3. Features Normalization
  const feat = safeParse(raw.features, {});
  const features = {
    auditable: true,
    creatable: true,
    editable: true,
    deletable: true,
    timestamps: true,
    ...feat
  };

  // 4. Permission Normalization
  const perm = safeParse(raw.permission, {});
  const permission = {
    role: {},
    ownerOnly: false,
    ...perm
  };

  // 6. Metadata Normalization (Menu, Dashboard, Relationships)
  const menuConfig = {
    showInMainMenu: true,
    showInNewMenu: false,
    priority: 50,
    ...safeParse(raw.menuConfig, {})
  };

  const dashboardConfig = {
    widgetType: 'table',
    summaryFields: [],
    showRecent: true,
    // Enterprise Level 8: Defaults to false; must be explicit in DNA
    showInDashboard: false, 
    ...safeParse(raw.dashboardConfig || raw.dashboard, {})
  };

  const relationships = Array.isArray(raw.relationships) ? raw.relationships : safeParse(raw.relationships, []);
  const validations = safeParse(raw.validations, {});
  const layout = safeParse(raw.layout, {});

  // 7. Build Final Object
  const fieldsMap = fields.reduce((acc: any, f) => ({ ...acc, [f.name]: f }), {});

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
    displayField: raw.displayField || 'id',
    fields, // This is the Array
    fieldsMap, // This is the Object/Map
    uiConfig,
    features,
    permission,
    menuConfig,
    dashboardConfig,
    relationships,
    validations,
    layout,
    isSystem: !!raw.isSystem
  };
}

/**
 * GET DISPLAY VALUE
 * Logic to consistently show the identity of a record across the app.
 * Priority: displayField from config > 'name' > 'title' > 'label' > 'id'
 */
export function getDisplayValue(item: any, entity: EntityDefinition): string {
  if (!item) return '-';
  
  const displayField = entity.displayField;
  if (displayField && item[displayField]) return String(item[displayField]);
  
  // Smart fallback
  const fallbacks = ['name', 'title', 'label', 'fullName', 'email', 'id'];
  for (const f of fallbacks) {
    if (item[f]) return String(item[f]);
  }
  
  return 'Unknown Record';
}

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

