import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * PRINTER & REFILL SERVICE - Entities
 */
const refill_item: EntityV3<any> = {
  id: 'refill_item',
  label: { ro: 'Reîncărcare', en: 'Refill' },
  labelPlural: { ro: 'Reîncărcări', en: 'Refills' },
  icon: 'Printer',
  tableName: 'refill_item',
  displayField: 'id',

  // Marketplace Metadata
  solutionId: 'printer-refill-v2',
  solutionTitle: { ro: 'Reîncărcări Consumabile', en: 'Printer & Refill Service' },
  description: { ro: 'Sistem rapid pentru gestionarea reîncărcărilor de cartușe.', en: 'Fast entry system for cartridge refill management.' },
  category: 'services',

  schema: z.object({
    ...BaseSchema,
    contactId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Client", "en": "Client"}'),
    
    quantity: z.number().default(1)
      .describe('ui:width=6;label={"ro": "Cantitate", "en": "Quantity"}'),
    
    paid_status: z.enum(['Yes', 'No', 'Pending'])
      .default('Pending')
      .describe('ui:width=6;label={"ro": "Status Plată", "en": "Payment Status"}'),
    
    refill_type: z.enum(['Toner', 'Jet'])
      .describe('ui:width=6;label={"ro": "Tip", "en": "Type"}'),
    
    photo_url: z.string().optional()
      .describe('ui:type=image;width=12;label={"ro": "Dovadă Foto", "en": "Photo Proof"}'),
    
    notes: z.string().optional()
      .describe('ui:type=textarea;width=12;label={"ro": "Note", "en": "Notes"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

export default [refill_item];
