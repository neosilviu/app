import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * CONFIG VERSION (History for Settings)
 */
export const config_version: EntityV3<any> = {
  id: 'config_version',
  label: { ro: 'Versiune Config', en: 'Config Version' },
  labelPlural: { ro: 'Versiuni Config', en: 'Config Versions' },
  icon: 'History',
  tableName: 'config_version',
  displayField: 'key',
  isSystem: true,
  isGlobal: true,

  // Marketplace Solution Metadata
  solutionId: 'config-version-control',
  solutionTitle: { ro: 'Control Versiuni Configurare', en: 'Config Version Control' },
  description: { 
    ro: 'Urmărirea istoricului de modificări pentru setările globale ale sistemului.', 
    en: 'Tracking change history for global system settings.' 
  },
  category: 'system',
  priority: 5,

  schema: z.object({
    ...BaseSchema,
    namespace: z.string()
      .describe('ui:width=4;icon=Folder;label={"ro": "Namespace", "en": "Namespace"};section={"ro": "Identificare", "en": "Identification"}'),
    
    key: z.string()
      .describe('ui:width=4;icon=Key;label={"ro": "Cheie", "en": "Key"};section={"ro": "Identificare", "en": "Identification"}'),
    
    changedBy: z.string().optional()
      .describe('ui:width=4;type=relation;target=contact;icon=User;label={"ro": "Modificat de", "en": "Changed By"};section={"ro": "Audit", "en": "Audit"}'),

    configJson: z.string().optional()
      .describe('ui:width=12;type=json;label={"ro": "Snapshot Configurație", "en": "Configuration Snapshot"};section={"ro": "Conținut", "en": "Content"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Descriere Modificare", "en": "Change Description"};section={"ro": "Audit", "en": "Audit"}'),
  }),


  features: ['deletable', 'timestamps'],
};
