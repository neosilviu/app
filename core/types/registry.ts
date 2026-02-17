export interface I18nString {
  ro: string;
  en: string;
}

export type Localized<T = string> = T | I18nString;

export type FieldType = 
  | 'uuid' | 'text' | 'textarea' | 'richtext' | 'string'
  | 'number' | 'integer' | 'currency' | 'percent' | 'range' | 'progress'
  | 'date' | 'datetime' | 'time'
  | 'boolean' | 'enum' | 'select' | 'multi-select' | 'tag'
  | 'relation' | 'relation-many'
  | 'file' | 'image' | 'gallery' | 'video' | 'audio'
  | 'email' | 'phone' | 'url' | 'password'
  | 'color' | 'icon' | 'rating' | 'signature'
  | 'location' | 'map'
  | 'ai' | 'ai-text' | 'ai-summarize'
  | 'formula' | 'computed'
  | 'json' | 'array';

export interface FieldUIAction {
  label: Localized;
  type: 'email-trigger' | 'whatsapp-trigger' | 'phone-call' | 'url-link' | 'script-trigger';
  icon?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'destructive' | 'ghost' | 'glass';
  templateId?: string;
  template?: string;
  phoneNumberField?: string;
  emailField?: string;
  urlField?: string;
  script?: string;
}

export interface FieldUICondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'empty' | 'not_empty';
  value?: any;
}

export interface FieldUIDefinition {
  width?: number; // 1-12 (grid system)
  placeholder?: Localized;
  helpText?: Localized;
  hidden?: boolean;
  readOnly?: boolean;
  showIf?: FieldUICondition;
  icon?: string; // Icon to show next to the field or in the input
  variant?: 'default' | 'badge' | 'ghost' | 'glass' | 'destructive';
  actions?: FieldUIAction[];
  className?: string;
  group?: Localized; // Layout group name
}

export interface FieldValidation {
  required?: boolean;
  pattern?: string;
  min?: number;
  max?: number;
  message?: Localized;
  custom?: string; // Custom validation logic or script
}

export interface FieldDefinition {
  type: FieldType;
  label?: Localized;
  description?: Localized;
  format?: 'email' | 'phone' | 'url' | 'json' | 'markdown' | 'html' | 'regex';
  required?: boolean;
  unique?: boolean;
  primaryKey?: boolean;
  multiple?: boolean; // For file/image/relation-many/multi-select
  generated?: 'uuid' | 'now';
  storage?: 'local-inbox' | 'r2' | 'gdrive';
  searchable?: boolean;
  sortable?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  isPrivate?: boolean; // Sensitive data
  encrypted?: boolean; // Encrypt value in DB
  maxLength?: number;
  defaultValue?: any;
  options?: string[] | { label: Localized; value: any; color?: string }[];
  relation?: {
    target: string;
    field: string; // The display field in the target entity
  };
  validation?: FieldValidation;
  visibility?: {
    type: 'always' | 'hidden' | 'conditional';
    dependsOn?: string;
    operator?: '==' | '!=' | 'in' | 'set';
    value?: any;
  };
  ai?: {
    prompt?: string;
    model?: string;
    personality?: string;
    temperature?: number;
    outputFormat?: 'text' | 'json' | 'markdown';
  };
  formula?: {
    expression: string;
    dependencies?: string[];
  };
  ui?: FieldUIDefinition;
}

export interface EntityMenuConfig {
  showInMainMenu: boolean;
  showInUserMenu?: boolean;
  showInActionMenu?: boolean; // The central "+" button
  category?: string;
  priority?: number;
  badge?: string; // Logic or value: "count:status=new"
  label?: Localized;
  icon?: string;
  path?: string; // Optional override
}

export interface EntityPermission {
  role: Record<string, string[] | { read: boolean; write: boolean; delete: boolean }>; 
  ownerOnly?: boolean;
}

export interface EntityFeatures {
  softDelete?: boolean;
  auditable?: boolean;
  import?: boolean;
  export?: boolean;
  bulkActions?: boolean;
  attachments?: boolean;
  comments?: boolean;
  creatable?: boolean; 
  editable?: boolean;  
  deletable?: boolean; 
  timestamps?: boolean;
  authorTracking?: boolean; // createdBy, updatedBy tracking
  authorizable?: boolean; // Rule-based ownership access
  versioning?: boolean; // Keep history of versions
  publicAccess?: boolean; // Allow non-auth read access
  workflow?: {
    statusField: string;
    states: string[];
    transitions: Record<string, string[]>;
  };
}

export interface EntityDashboardCard {
  type: 'count' | 'sum' | 'avg' | 'chart';
  label: Localized;
  query?: string;
  color?: string;
}

export interface EntityDashboardConfig {
  enabled: boolean;
  showInDashboard?: boolean;
  priority?: number;
  category?: string;
  widgetType?: 'stats' | 'list' | 'chart' | 'table';
  cards?: EntityDashboardCard[];
}

export interface EntityLayoutSection {
  title?: Localized;
  description?: Localized;
  columns?: number; 
  variant?: 'default' | 'glass' | 'card' | 'ghost';
  fields: string[]; 
  showIf?: FieldUICondition;
}

export interface EntityLayoutTab {
  id: string;
  label: Localized;
  sections: EntityLayoutSection[];
  icon?: string;
  showIf?: FieldUICondition;
}

export interface EntityLayout {
  sections?: EntityLayoutSection[]; // Default sections if no tabs
  tabs?: EntityLayoutTab[];
}

export interface EntityDefinition {
  id?: string;
  label: I18nString;
  labelPlural: I18nString;
  icon: string;
  colorTheme?: string;
  description?: Localized;
  tableName: string;
  displayField: string;
  sortField?: string;
  searchFields?: string[];
  isSystem?: boolean;
  dependencies?: string[]; // IDs or names of entities this entity depends on
  fields: Record<string, FieldDefinition>;
  menuConfig?: EntityMenuConfig;
  permission?: EntityPermission;
  features?: EntityFeatures;
  dashboardConfig?: EntityDashboardConfig;
  layout?: EntityLayout;
  indexes?: (string | string[] | { fields: string[]; unique?: boolean })[];
}
