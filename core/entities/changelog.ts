import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * CHANGELOG ENTITY (v3 Modular)
 */
export const changelog: EntityV3<any> = {
  id: 'changelog',
  label: { ro: 'Changelog', en: 'Changelog' },
  labelPlural: { ro: 'Changelogs', en: 'Changelogs' },
  icon: 'History',
  tableName: 'changelog',
  displayField: 'version',
  isGlobal: true,

  // Marketplace Solution Metadata
  solutionId: 'platform-history-logger',
  solutionTitle: { ro: 'Istoric Versiuni Platformă', en: 'Platform Version History' },
  description: { 
    ro: 'Documentarea evoluției software și a modificărilor pentru utilizatori.', 
    en: 'Documenting software evolution and changes for users.' 
  },
  category: 'administration',
  priority: 2,

  schema: z.object({
    ...BaseSchema,
    module: z.string().optional()
      .describe('ui:width=4;icon=Box;label={"ro": "Componentă / Modul", "en": "Module"};section={"ro": "Info Versiune", "en": "Version Info"}'),
    
    version: z.string()
      .describe('ui:width=4;icon=Hash;label={"ro": "Versiune (vX.Y)", "en": "Version"};section={"ro": "Info Versiune", "en": "Version Info"}'),
    
    type: z.enum(['feature', 'fix', 'improvement']).default('improvement')
      .describe('ui:width=4;icon=Zap;label={"ro": "Tip Modificare", "en": "Change Type"};section={"ro": "Info Versiune", "en": "Version Info"}'),

    title: z.string()
      .describe('ui:width=12;icon=Type;label={"ro": "Titlu Scurt", "en": "Title"};searchable=true;section={"ro": "Detalii", "en": "Details"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;type=richtext;label={"ro": "Descriere Detaliată", "en": "Detailed Description"};section={"ro": "Detalii", "en": "Details"}'),
  }),


  features: ['timestamps'],

  menuConfig: {
    showInMainMenu: true,
    category: 'administration',
    icon: 'History',
    priority: 210
  }
};
