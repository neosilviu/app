import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * SERVICE DESK & TICKETING - Entities
 */
const repair_ticket: EntityV3<any> = {
  id: 'repair_ticket',
  label: { ro: 'Tichet Reparație', en: 'Repair Ticket' },
  labelPlural: { ro: 'Tichete Reparații', en: 'Repair Tickets' },
  icon: 'Tool',
  tableName: 'repair_ticket',
  displayField: 'object',

  // Marketplace Metadata
  solutionId: 'service-repair-ticketing',
  solutionTitle: { ro: 'Service Desk & Tichete', en: 'Service Desk & Ticketing' },
  description: { ro: 'Sistem de tichete reparații cu istoric media și note interne.', en: 'Repair ticketing system with media history and internal notes.' },
  category: 'services',

  schema: z.object({
    ...BaseSchema,
    contactId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Client", "en": "Client"}'),
    
    object: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Obiect Reparație", "en": "Repair Object"}'),
    
    productId: z.string().optional()
      .describe('ui:type=relation;target=service_product;label={"ro": "Produs Asociat", "en": "Associated Product"}'),
    
    description: z.string().optional()
      .describe('ui:type=textarea;width=12;label={"ro": "Descriere Defect", "en": "Defect Description"}'),
    
    stage: z.enum(['New', 'In work', 'Finish', 'Canceled'])
      .default('New')
      .describe('ui:width=6;label={"ro": "Etapă", "en": "Stage"}'),
    
    internal_notes: z.string().optional()
      .describe('ui:type=textarea;width=12;label={"ro": "Note Interne", "en": "Internal Notes"}'),
    
    solution: z.enum(['Reparat', 'Doar diagnostic'])
      .optional()
      .describe('ui:width=6;label={"ro": "Soluție", "en": "Solution"}'),
    
    price: z.number().optional()
      .describe('ui:type=currency;width=6;label={"ro": "Preț Reparație", "en": "Repair Price"}'),
    
    repair_gallery: z.string().optional()
      .describe('ui:type=gallery;width=12;label={"ro": "Media Reparație", "en": "Repair Media"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],

  extensions: {
    contact: {
      schema: {
        lastRepairDate: z.string().optional().describe('ui:type=date;width=6;label={"ro": "Ultima Reparație", "en": "Last Repair"}'),
        totalRepairValue: z.number().optional().describe('ui:type=currency;width=6;label={"ro": "Total Reparații", "en": "Total Repairs"}'),
      }
    }
  }
};

export default [repair_ticket];
