import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * WARRANTY & AFTER-SALES - Entities
 */
const warranty_record: EntityV3<any> = {
  id: 'warranty_record',
  label: { ro: 'Garanție', en: 'Warranty' },
  labelPlural: { ro: 'Garanții', en: 'Warranties' },
  icon: 'Award',
  tableName: 'warranty_record',
  displayField: 'id',

  // Marketplace Metadata
  solutionId: 'warranty-tracking-pro',
  solutionTitle: { ro: 'Garanții & Post-Vânzare', en: 'Warranty & After-Sales' },
  description: { ro: 'Monitorizare perioade garanție și reclamații clienți.', en: 'Warranty period monitoring and customer claims.' },
  category: 'services',

  schema: z.object({
    ...BaseSchema,
    contactId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Client", "en": "Client"}'),
    
    productId: z.string()
      .describe('ui:type=relation;target=service_product;label={"ro": "Produs", "en": "Product"}'),
    
    purchase_date: z.string().optional()
      .describe('ui:type=date;width=6;label={"ro": "Data Achiziției", "en": "Purchase Date"}'),
    
    expiry_date: z.string().optional()
      .describe('ui:type=date;width=6;label={"ro": "Data Expirării", "en": "Expiry Date"}'),
    
    status: z.enum(['Active', 'Expired', 'Claimed'])
      .default('Active')
      .describe('ui:width=12;label={"ro": "Status", "en": "Status"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

export default [warranty_record];
