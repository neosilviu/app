import { getV3EntitiesAsLegacy } from './core/entities';
import { getV3MarketplaceTemplates } from './core/marketplace';
import { AI_PROMPT } from './core/ai/prompts';
import { BLUEPRINT } from './core/blueprints';
import { safeEnv } from './core/utils/env';
import { COMMON_COLOR, COMMON_STATUS, COMMON_PRIORITY, SYSTEM_ROLE } from './core/config/roles';
import { CONSTANT } from './core/config/constants';
import { NAV, shortcuts } from './core/config/navigation';
import { DASHBOARD } from './core/config/dashboard';
import { THEME } from './core/config/theme';
import { AI_CONFIG } from './core/config/ai';
import { AUTH_CONFIG } from './core/config/auth';
import { INTEGRATION, EMAIL_TEMPLATE } from './core/config/integration';
import { FILE_CONFIG } from './core/config/files';
import { I18N_CONFIG } from './core/config/i18n-config';
import { SYSTEM_SETTING } from './core/config/system';
import { DATABASE_CONFIG } from './core/config/database';
import { SOCKET_CONFIG } from './core/config/socket';
import { WORKER_CONFIG } from './core/config/worker';
import { API_CONFIG } from './core/config/api';
import { I18N } from './core/i18n';
import { BASE_ENTITY_FEATURES, BASE_ENTITY_FIELDS } from './core/config/entities';

// Re-export types for backward compatibility
export * from './core/types/registry';

export const MARKETPLACE_TEMPLATE = getV3MarketplaceTemplates();

const V3_LEGACY_BRIDGE = getV3EntitiesAsLegacy(MARKETPLACE_TEMPLATE);

export const ENTITY_CONFIG: Record<string, any> = {
  ...V3_LEGACY_BRIDGE,
};

export {
  COMMON_COLOR,
  COMMON_STATUS,
  COMMON_PRIORITY,
  SYSTEM_ROLE,
  NAV,
  shortcuts,
  CONSTANT,
  DASHBOARD,
  THEME,
  AI_CONFIG,
  AI_PROMPT,
  BLUEPRINT,
  AUTH_CONFIG,
  INTEGRATION,
  EMAIL_TEMPLATE,
  FILE_CONFIG,
  I18N_CONFIG,
  SYSTEM_SETTING,
  DATABASE_CONFIG,
  SOCKET_CONFIG,
  WORKER_CONFIG,
  API_CONFIG,
  I18N,
  BASE_ENTITY_FEATURES,
  BASE_ENTITY_FIELDS
};

export const REGISTRY_BASELINE = {
  __version__: CONSTANT.app.version,
  __lastUpdated__: new Date().toISOString(),
  __environment__: safeEnv('NODE_ENV', 'development'),

  // Top-level Config (Visible in GENERAL)
  appName: SYSTEM_SETTING.workspace_name,
  appLogo: SYSTEM_SETTING.logo_url,
  appVersion: CONSTANT.app.version,
  appDescription: CONSTANT.app.description,
  appUrl: CONSTANT.directories.baseUrl,
  language: I18N_CONFIG.defaultLanguage,
  timezone: I18N_CONFIG.timezone.default,
  maintenanceMode: SYSTEM_SETTING.app.maintenanceMode,
  debugMode: SYSTEM_SETTING.app.debugMode,

  NAV,
  shortcuts,
  CONSTANT,
  ENTITY_CONFIG,
  BLUEPRINT,
  SYSTEM_ROLE,
  DASHBOARD,
  THEME,
  AI_CONFIG,
  AI_PROMPT,
  AUTH_CONFIG,
  INTEGRATION,
  EMAIL_TEMPLATE,
  FILE_CONFIG,
  I18N_CONFIG,
  I18N,
  SYSTEM_SETTING,
  DATABASE_CONFIG,
  SOCKET_CONFIG,
  WORKER_CONFIG,
  API_CONFIG,
  MARKETPLACE_TEMPLATE,
};

export default REGISTRY_BASELINE;
