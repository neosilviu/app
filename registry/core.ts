/**
 * REGISTRY CORE - Logic and Constants
 * Enterprise Level 8
 */

export const safeEnv = (key: string, fallback: string = ''): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] || fallback;
  }
  return fallback;
};

export const isDevCheck = () => {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') return true;
  const g = globalThis as any;
  if (typeof g.window !== 'undefined' && g.window.location) {
    const hostname = g.window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
  }
  return false;
};

export const isDev = isDevCheck();
export const DEFAULT_AGENT_PORT = isDev ? '4001' : '5000';
export const DEFAULT_AGENT_URL = isDev ? `http://localhost:${DEFAULT_AGENT_PORT}` : 'https://api.aemdpc.ro';

export const COMMON_COLOR = {
  blue: '#3b82f6',
  indigo: '#4f46e5',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
  violet: '#8b5cf6',
  orange: '#f97316',
  red: '#ef4444',
  gray: '#6b7280'
} as const;

export const COMMON_STATUS = {
  active: { label: { ro: 'Activ', en: 'Active' }, value: 'active', color: COMMON_COLOR.emerald },
  archived: { label: { ro: 'Arhivat', en: 'Archived' }, value: 'archived', color: COMMON_COLOR.amber },
  deleted: { label: { ro: 'Șters', en: 'Deleted' }, value: 'deleted', color: COMMON_COLOR.red },
  planning: { label: { ro: 'În Planificare', en: 'Planning' }, value: 'planning', color: COMMON_COLOR.indigo },
  blocked: { label: { ro: 'Blocat', en: 'Blocked' }, value: 'blocked', color: COMMON_COLOR.red },
  completed: { label: { ro: 'Finalizat', en: 'Completed' }, value: 'completed', color: COMMON_COLOR.slate },
  lead: { label: { ro: 'Lead', en: 'Lead' }, value: 'lead', color: COMMON_COLOR.blue },
  customer: { label: { ro: 'Client', en: 'Customer' }, value: 'customer', color: COMMON_COLOR.emerald },
  partner: { label: { ro: 'Partener', en: 'Partner' }, value: 'partner', color: COMMON_COLOR.violet },
  vendor: { label: { ro: 'Furnizor', en: 'Vendor' }, value: 'vendor', color: COMMON_COLOR.amber },
  todo: { label: { ro: 'De făcut', en: 'To Do' }, value: 'todo', color: COMMON_COLOR.slate },
  in_progress: { label: { ro: 'În lucru', en: 'In Progress' }, value: 'in_progress', color: COMMON_COLOR.blue },
  done: { label: { ro: 'Gata', en: 'Done' }, value: 'done', color: COMMON_COLOR.emerald },
} as const;

export const COMMON_PRIORITY = {
  low: { label: { ro: 'Scăzută', en: 'Low' }, value: 'low', color: COMMON_COLOR.slate },
  medium: { label: { ro: 'Medie', en: 'Medium' }, value: 'medium', color: COMMON_COLOR.amber },
  high: { label: { ro: 'Urgentă', en: 'High' }, value: 'high', color: COMMON_COLOR.red },
} as const;

export const SYSTEM_ROLE = {
  superadmin: {
    label: { ro: 'SuperAdmin', en: 'SuperAdmin' },
    color: COMMON_COLOR.red,
    description: { ro: 'Acces total la sistem și configurări globale', en: 'Full system access and global configurations' },
    permission: ['*'],
    allowedPage: ['*'],
  },
  workspace_owner: {
    label: { ro: 'Proprietar', en: 'Workspace Owner' },
    color: COMMON_COLOR.indigo,
    description: { ro: 'Control total asupra workspace-ului curent', en: 'Full control over the current workspace' },
    permission: [
      'workspace:manage',
      'workspace:members:manage',
      'workspace:setting:edit',
      'workspace:data:export',
      'contact:create',
      'contact:read',
      'contact:update',
      'contact:delete',
      'file:manage',
    ],
    allowedPage: ['dashboard', 'monitoring', 'setting', 'profile', 'entity', 'worker', 'superadmin'],
  },
  workspace_admin: {
    label: { ro: 'Administrator', en: 'Workspace Admin' },
    color: COMMON_COLOR.violet,
    description: { ro: 'Gestionare membri și configurări de bază', en: 'Manage members and basic settings' },
    permission: [
      'workspace:members:manage',
      'workspace:setting:view',
      'contact:create',
      'contact:read',
      'contact:update',
      'file:manage',
    ],
    allowedPage: ['dashboard', 'monitoring', 'setting', 'profile', 'entity', 'worker'],
  },
  member: {
    label: { ro: 'Membru', en: 'Member' },
    color: COMMON_COLOR.emerald,
    description: { ro: 'Utilizator activ cu acces la datele de business', en: 'Active user with access to business data' },
    permission: [
      'contact:read',
      'contact:create',
      'contact:update',
      'file:upload',
      'workspace:view',
    ],
    allowedPage: ['dashboard', 'profile', 'entity', 'worker'],
  },
  agent: {
    label: { ro: 'Agent', en: 'Agent' },
    color: COMMON_COLOR.orange,
    description: { ro: 'Acces limitat pentru colaboratori externi sau AI', en: 'Limited access for external collaborators or AI' },
    permission: [
      'contact:read',
      'interaction:create',
      'interaction:read',
    ],
    allowedPage: ['dashboard', 'profile'],
  },
  guest: {
    label: { ro: 'Fără permisiuni', en: 'No Permissions' },
    color: COMMON_COLOR.gray,
    description: { ro: 'Utilizator fără permisiuni de acces în sistem', en: 'User with no access permissions' },
    permission: [],
    allowedPage: [],
  },
} as const;

export const CONSTANT = {
  app: {
    name: 'Studio App v2',
    version: '2.0.0',
    description: { ro: 'Un sistem cuprinzător de CRM și management al spațiului de lucru', en: 'A comprehensive CRM and workspace management system' },
    homepage: 'https://studioapp.local',
  },
  directories: {
    baseUrl: safeEnv('BASE_URL', 'https://service.aemdpc.ro'),
    apiUrl: safeEnv('API_URL', 'https://api.aemdpc.ro'),
    uploadDir: './uploads',
    mediaDir: './media',
    backupDir: './backups',
    logsDir: './logs',
    tempDir: './temp',
  },
  coreEntity: [
    'contact',
    'workspace',
    'workspace_user',
    'tag',
    'file',
    'entity_attachment',
    'entity_note',
    'system_setting',
    'entity_definition',
    'audit_log',
    'config_version',
    '_ai_prompt',
    'user',
    'role'
  ],
  globalEntity: [
    'workspace', 
    'workspace_setting',
    'system_setting', 
    'entity_definition', 
    'config_version', 
    'audit_log', 
    '_ai_prompt',
    'user',
    'role'
  ],
  auditExclusion: [
    'audit_log',
    'session',
    'config_version'
  ],
  offlineCapableEntities: [
    'contact',
    'file',
    'tag',
    'automation',
    'audit_log',
    'changelog',
    'interaction',
    'bug_report',
    'notification'
  ],
  aiPromptCategory: [
    'system', 
    'global', 
    'workspaceTemplates', 
    'language_instruction'
  ],
  systemFields: [
    'workspaceId', 
    'createdAt', 
    'updatedAt', 
    'deletedAt', 
    'archived', 
    'createdBy', 
    'updatedBy'
  ],
  namespaceMapping: {
    'ai': 'AI_CONFIG',
    'ai_config': 'AI_CONFIG',
    'theme': 'THEME',
    'ui': 'THEME',
    'uiconfig': 'THEME',
    'ui_config': 'THEME',
    'auth': 'AUTH_CONFIG',
    'auth_config': 'AUTH_CONFIG',
  }
} as const;

