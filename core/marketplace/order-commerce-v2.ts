import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * PRODUCT ORDER MANAGEMENT - Entities
 */
const product_order: EntityV3<any> = {
  id: 'product_order',
  label: { ro: 'Comandă Produs', en: 'Product Order' },
  labelPlural: { ro: 'Comenzi Produse', en: 'Product Orders' },
  icon: 'ShoppingCart',
  tableName: 'product_order',
  displayField: 'id',

  // Marketplace Metadata
  solutionId: 'order-commerce-v2',
  solutionTitle: { ro: 'Gestiune Comenzi Produse', en: 'Product Order Management' },
  description: { ro: 'Urmărire comenzi clienți, avansuri și status livrare.', en: 'Client order tracking, advances, and delivery status.' },
  category: 'sales',

  schema: z.object({
    ...BaseSchema,
    contactId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Client", "en": "Client"}'),
    
    productId: z.string().optional()
      .describe('ui:type=relation;target=service_product;label={"ro": "Produs", "en": "Product"}'),
    
    total: z.number().optional()
      .describe('ui:type=currency;width=6;label={"ro": "Total", "en": "Total"}'),
    
    avans: z.number().optional()
      .describe('ui:type=currency;width=6;label={"ro": "Avans", "en": "Avans"}'),
    
    stage: z.enum(['New', 'In work', 'Finish', 'Canceled'])
      .default('New')
      .describe('ui:width=6;label={"ro": "Etapă", "en": "Stage"}'),
    
    ticketId: z.string().optional()
      .describe('ui:type=relation;target=repair_ticket;label={"ro": "Ticket Asociat", "en": "Ticket Asociat"}'),
    
    notes: z.string().optional()
      .describe('ui:type=textarea;width=12;label={"ro": "Note", "en": "Notes"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

export default [product_order];
