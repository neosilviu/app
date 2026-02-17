import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * CONSTRUCTION SITE LOG - Entities
 */
const site_report: EntityV3<any> = {
  id: 'site_report',
  label: { ro: 'Raport Zilnic', en: 'Daily Report' },
  labelPlural: { ro: 'Rapoarte Zilnice', en: 'Daily Reports' },
  icon: 'HardHat',
  tableName: 'site_report',
  displayField: 'site_name',

  // Marketplace Metadata
  solutionId: 'construction-site-log',
  solutionTitle: { ro: 'Șantier & Construcții', en: 'Construction & Site Log' },
  description: { ro: 'Jurnal de șantier, utilaje, materiale și rapoarte zilnice.', en: 'Site diary, machinery, materials and daily reports.' },
  category: 'operations',

  schema: z.object({
    ...BaseSchema,
    site_name: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Nume Șantier", "en": "Name Șantier"}'),
    
    date: z.string().optional()
      .describe('ui:type=date;width=6;label={"ro": "Data", "en": "Data"}'),
    
    weather: z.string().optional()
      .describe('ui:width=6;label={"ro": "Meteo", "en": "Meteo"}'),
    
    summary: z.string().optional()
      .describe('ui:type=textarea;width=12;label={"ro": "Rezumat Activități", "en": "Rezumat Activități"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

export default [site_report];
