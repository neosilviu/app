import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * B2B SALES PIPELINE MODULE - Marketplace V3
 */
export const b2b_sales_crm: EntityV3<any> = {
  id: 'b2b-sales-pipeline',
  label: { ro: 'Oportunitate B2B', en: 'B2B Deal' },
  labelPlural: { ro: 'Oportunități B2B', en: 'B2B Deals' },
  icon: 'TrendingUp',
  tableName: 'deal_b2b',
  displayField: 'title',

  // Marketplace Metadata
  solutionId: 'b2b-sales-crm',
  solutionTitle: { ro: 'Vânzări B2B Pipeline', en: 'B2B Sales Pipeline' },
  description: { ro: 'Oportunități, oferte comerciale și urmărire vânzări.', en: 'Opportunities, commercial offers and sales tracking.' },
  category: 'sales',

  schema: z.object({
    ...BaseSchema,
    title: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Nume Oportunitate", "en": "Opportunity Name"}'),
    
    contactId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Companie / Contact", "en": "Company / Contact"}'),
    
    value: z.number().optional()
      .describe('ui:type=currency;width=6;label={"ro": "Valoare Estimată", "en": "Estimated Value"}'),
    
    stage: z.enum(['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'])
      .default('prospecting')
      .describe('ui:width=6;label={"ro": "Etapă", "en": "Stage"}'),

    closeProbability: z.number().min(0).max(100).default(50)
      .describe('ui:width=6;label={"ro": "Probabilitate Închidere (%", "en": "Probabilitate Închidere (%"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
  dependencies: ['contact'],

  extensions: {
    contact: {
      schema: {
        companySize: z.enum(['1-10', '11-50', '51-200', '201+'])
          .optional()
          .describe('ui:width=6;label={"ro": "Dimensiune Companie", "en": "Company Size"}'),
        industry: z.string().optional()
          .describe('ui:width=6;label={"ro": "Industrie", "en": "Industry"}'),
      }
    }
  }
};

export default b2b_sales_crm;
