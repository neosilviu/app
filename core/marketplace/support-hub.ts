import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * SUPPORT & TICKETING - Entities
 */
const support_ticket: EntityV3<any> = {
  id: 'support_ticket',
  label: { ro: 'Tichet Suport', en: 'Support Ticket' },
  labelPlural: { ro: 'Tichete Suport', en: 'Support Tickets' },
  icon: 'LifeBuoy',
  tableName: 'support_ticket',
  displayField: 'subject',

  // Marketplace Metadata
  solutionId: 'support-hub',
  solutionTitle: { ro: 'Support & Ticketing', en: 'Support & Ticketing' },
  description: { ro: 'Gestionare cereri suport, tichete, SLA și satisfacție clienți.', en: 'Support requests, tickets, SLA tracking and customer satisfaction.' },
  category: 'services',

  schema: z.object({
    ...BaseSchema,
    subject: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Subiect", "en": "Subject"}'),
    
    clientId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Client", "en": "Client"}'),
    
    priority: z.enum(['low', 'medium', 'high', 'critical'])
      .default('medium')
      .describe('ui:width=6;label={"ro": "Prioritate", "en": "Priority"}'),
    
    status: z.enum(['new', 'open', 'pending', 'resolved', 'closed'])
      .default('new')
      .describe('ui:width=6;label={"ro": "Status", "en": "Status"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

export default [support_ticket];
