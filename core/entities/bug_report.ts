import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * BUG REPORT ENTITY (v3 Modular)
 */
export const bug_report: EntityV3<any> = {
  id: 'bug_report',
  label: { ro: 'Bug Report', en: 'Bug Report' },
  labelPlural: { ro: 'Bug Reports', en: 'Bug Reports' },
  icon: 'Bug',
  tableName: 'bug_report',
  displayField: 'title',
  isGlobal: true,

  // Marketplace Solution Metadata
  solutionId: 'quality-assurance-tracker',
  solutionTitle: { ro: 'Sistem Raportare Bug-uri', en: 'Bug Reporting System' },
  description: { 
    ro: 'Instrument intern pentru raportarea și urmărirea problemelor tehnice.', 
    en: 'Internal tool for reporting and tracking technical issues.' 
  },
  category: 'it-support',
  priority: 10,

  schema: z.object({
    ...BaseSchema,
    userId: z.string().optional()
      .describe('ui:width=6;type=relation;target=contact;icon=User;label={"ro": "Raportat de", "en": "Reported By"};section={"ro": "Context", "en": "Context"}'),
    
    severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
      .describe('ui:width=6;icon=AlertCircle;label={"ro": "Severitate", "en": "Severity"};section={"ro": "Context", "en": "Context"}'),

    title: z.string()
      .describe('ui:width=12;icon=Type;label={"ro": "Titlu Bug", "en": "Bug Title"};searchable=true;section={"ro": "Conținut", "en": "Content"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Descriere Detaliată", "en": "Detailed Description"};section={"ro": "Conținut", "en": "Content"}'),
    
    status: z.enum(['open', 'fixed', 'wontfix', 'in-progress']).default('open')
      .describe('ui:width=12;icon=Activity;label={"ro": "Status Remediere", "en": "Status"};section={"ro": "Stare", "en": "State"}'),
  }),


  features: ['timestamps', 'audit'],

  menuConfig: {
    showInMainMenu: true,
    category: 'administration',
    icon: 'Bug',
    priority: 200
  }
};
