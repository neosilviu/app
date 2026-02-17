import { safeEnv } from '../utils/env';

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
  auditExclusion: [
    'audit_log',
    'system_error',
    'session',
    'config_version'
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
    'updatedBy',
    'deletedBy'
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
    'nav': 'NAV',
    'system': 'SYSTEM_SETTING',
    'system_setting': 'SYSTEM_SETTING',
    'constants': 'CONSTANTS',
    'integration': 'INTEGRATION',
    'i18n': 'I18N_CONFIG',
    'general': 'GENERAL',
    'root': 'GENERAL'
  },
  flowRules: {
    // Contact Workflow: Lead → Customer → Partner
    contact: {
      lead: {
        nextStates: ['customer', 'archived'],
        label: { ro: 'Lead → Client', en: 'Lead → Customer' },
        requiresFields: ['email', 'name'],
        action: 'convert_to_customer',
        icon: 'ArrowRight'
      },
      customer: {
        nextStates: ['partner', 'archived'],
        label: { ro: 'Client → Partener', en: 'Customer → Partner' },
        requiresFields: ['email', 'phone'],
        action: 'upgrade_to_partner',
        icon: 'ArrowRight'
      },
      partner: {
        nextStates: ['archived'],
        label: { ro: 'Partener → Arhivat', en: 'Partner → Archived' },
        requiresFields: [],
        action: 'archive_partner',
        icon: 'Archive'
      },
      archived: {
        nextStates: ['lead'],
        label: { ro: 'Arhivat → Reactivare', en: 'Archived → Reactivate' },
        requiresFields: [],
        action: 'reactivate',
        icon: 'RotateCcw'
      }
    }
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
    defaultPage: 1,
  },
  virtualFields: [
    'relation-many', 
    'tag', 
    'calculation', 
    'formula', 
    'divider', 
    'group', 
    'section', 
    'tab', 
    'description', 
    'info-box'
  ],
  jsonFields: [
    'fields', 
    'validations', 
    'relationships', 
    'dependencies', 
    'uiConfig', 
    'menuConfig', 
    'permission', 
    'features', 
    'layout', 
    'actions', 
    'flowRules', 
    'dashboardConfig'
  ],
  timeouts: {
    socketTimeout: 30000,
    requestTimeout: 15000,
  },
  limits: {
    maxFileSize: 50 * 1024 * 1024,
    maxUploadConcurrency: 5,
    maxBatchSize: 100,
  }
} as const;
