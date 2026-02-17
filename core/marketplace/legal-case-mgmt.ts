import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * LEGAL & CONTRACTS - Entities
 */
const legal_case: EntityV3<any> = {
  id: 'legal_case',
  label: { ro: 'Dosar Juridic', en: 'Legal Case' },
  labelPlural: { ro: 'Dosare Juridice', en: 'Legal Cases' },
  icon: 'Gavel',
  tableName: 'legal_case',
  displayField: 'case_number',

  // Marketplace Metadata
  solutionId: 'legal-case-mgmt',
  solutionTitle: { ro: 'Juridic & Contracte', en: 'Legal & Contracts' },
  description: { ro: 'Management dosare juridice, termene de judecată și contracte.', en: 'Legal case management, court dates and contracts.' },
  category: 'legal',

  schema: z.object({
    ...BaseSchema,
    case_number: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Nr. Dosar", "en": "Nr. Dosar"}'),
    
    court: z.string().optional()
      .describe('ui:width=12;label={"ro": "Instanță", "en": "Instanță"}'),
    
    clientId: z.string().optional()
      .describe('ui:type=relation;target=contact;label={"ro": "Client", "en": "Client"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],

  extensions: {
    contact: {
      schema: {
        legalRep: z.string().optional().describe('ui:width=12;label={"ro": "Reprezentant Legal", "en": "Reprezentant Legal"}'),
        advistoryType: z.enum(['standard', 'premium', 'pro-bono']).optional().describe('ui:width=6;label={"ro": "Tip Consultanță", "en": "Type Consultanță"}'),
      }
    }
  }
};

export default [legal_case];
