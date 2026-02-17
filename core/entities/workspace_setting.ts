import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * WORKSPACE SETTING (v3 Modular)
 */
export const workspace_setting: EntityV3<any> = {
  id: 'workspace_setting',
  label: { ro: 'Setare Workspace', en: 'Workspace Setting' },
  labelPlural: { ro: 'Setări Workspace', en: 'Workspace Settings' },
  icon: 'Settings',
  tableName: 'workspace_setting',
  displayField: 'workspaceName',
  isSystem: true,

  // Marketplace Solution Metadata
  solutionId: 'workspace-control-center',
  solutionTitle: { ro: 'Centru Control Spațiu Lucru', en: 'Workspace Control Center' },
  description: { 
    ro: 'Configurațiile de bază și preferințele globale pentru spațiul de lucru curent.', 
    en: 'Core configurations and global preferences for the current workspace.' 
  },
  category: 'system',
  priority: 2,

  schema: z.object({
    ...BaseSchema,
    workspaceName: z.string().optional()
      .describe('ui:width=6;icon=Building;label={"ro": "Nume Spațiu de Lucru", "en": "Workspace Name"};section={"ro": "Identitate", "en": "Identity"}'),
    
    logoUrl: z.string().optional()
      .describe('ui:width=6;icon=Image;label={"ro": "URL Logo", "en": "Logo URL"};section={"ro": "Identitate", "en": "Identity"}'),
    
    language: z.string().optional()
      .describe('ui:width=6;icon=Languages;label={"ro": "Limbă Default", "en": "Default Language"};section={"ro": "Localizare", "en": "Localization"}'),
    
    timezone: z.string().optional()
      .describe('ui:width=6;icon=Clock;label={"ro": "Fus Orar", "en": "Timezone"};section={"ro": "Localizare", "en": "Localization"}'),
    
    category: z.string().optional()
      .describe('ui:width=12;icon=Tag;label={"ro": "Categorie Workspace", "en": "Workspace Category"};section={"ro": "Localizare", "en": "Localization"}'),
    
    ai: z.string().optional()
      .describe('ui:type=json;width=12;icon=Zap;label={"ro": "Configurație AI", "en": "AI Configuration"};section={"ro": "Setări Avansate", "en": "Advanced Settings"}'),
    
    setting: z.string().optional()
      .describe('ui:type=json;width=12;icon=Settings;label={"ro": "Parametri Tehnici (JSON)", "en": "Technical Parameters (JSON)"};section={"ro": "Setări Avansate", "en": "Advanced Settings"}'),
  }),


  features: ['audit', 'timestamps'],
};
