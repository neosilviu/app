/**
 * REGISTRY BASELINE - Aggregator
 * Enterprise Level 8
 * 
 * This file is now a shell that aggregates granular modules from /registry/*.
 * This allows the backend to import only the 'Lite' versions, keeping the bundle small.
 */
import { NAV, SHORTCUT, THEME, DASHBOARD } from './registry/ui';
import { CONSTANT, SYSTEM_ROLE } from './registry/core';
import { ENTITY_CONFIG } from './registry/entities';
import { AI_CONFIG, AI_PROMPT } from './registry/ai';
import { I18N } from './registry/i18n';
import { 
  AUTH_CONFIG, 
  INTEGRATION, 
  EMAIL_TEMPLATE, 
  FILE_CONFIG, 
  I18N_CONFIG, 
  SYSTEM_SETTING, 
  DATABASE_CONFIG, 
  SOCKET_CONFIG, 
  WORKER_CONFIG, 
  API_CONFIG 
} from './registry/config';
import { MARKETPLACE_TEMPLATE } from './registry/marketplace';

export {
  NAV, SHORTCUT, THEME, DASHBOARD,
  CONSTANT, SYSTEM_ROLE,
  ENTITY_CONFIG,
  AI_CONFIG, AI_PROMPT,
  I18N,
  AUTH_CONFIG, INTEGRATION, EMAIL_TEMPLATE, FILE_CONFIG, I18N_CONFIG, SYSTEM_SETTING, DATABASE_CONFIG, SOCKET_CONFIG, WORKER_CONFIG, API_CONFIG,
  MARKETPLACE_TEMPLATE
};

export const REGISTRY_BASELINE = {
  __version__: CONSTANT.app.version,
  __lastUpdated__: new Date().toISOString(),
  
  appName: SYSTEM_SETTING.workspace_name,
  appLogo: SYSTEM_SETTING.logo_url,
  appVersion: CONSTANT.app.version,
  
  NAV,
  SHORTCUT,
  CONSTANT,
  ENTITY_CONFIG,
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
} as const;

export default REGISTRY_BASELINE;

