import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * BEAUTY SALON PRO - Entities
 */
const salon_service: EntityV3<any> = {
  id: 'salon_service',
  label: { ro: 'Serviciu Salon', en: 'Salon Service' },
  labelPlural: { ro: 'Servicii Salon', en: 'Salon Services' },
  icon: 'Sparkles',
  tableName: 'salon_service',
  displayField: 'name',

  // Marketplace Metadata
  solutionId: 'beauty-salon-pro',
  solutionTitle: { ro: 'Beauty & Salon Pro', en: 'Beauty & Salon Pro' },
  description: { ro: 'Gestiune programări salon, servicii, stiliști și abonamente.', en: 'Salon appointments, services, stylists and member plans.' },
  category: 'services',

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Nume Serviciu", "en": "Name Serviciu"}'),
    
    duration: z.number().optional()
      .describe('ui:width=6;label={"ro": "Durată (min", "en": "Durată (min"}'),
    
    price: z.number().optional()
      .describe('ui:type=currency;width=6;label={"ro": "Preț", "en": "Price"}'),
  }),

  features: ['audit', 'timestamps'],
};

const salon_appointment: EntityV3<any> = {
  id: 'salon_appointment',
  label: { ro: 'Programare Salon', en: 'Salon Appointment' },
  labelPlural: { ro: 'Programări Salon', en: 'Salon Appointments' },
  icon: 'Calendar',
  tableName: 'salon_appointment',
  displayField: 'date_time',

  // Marketplace Metadata
  solutionId: 'beauty-salon-pro',
  solutionTitle: { ro: 'Beauty & Salon Pro', en: 'Beauty & Salon Pro' },
  category: 'services',

  schema: z.object({
    ...BaseSchema,
    clientId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Client", "en": "Client"}'),
    
    serviceId: z.string()
      .describe('ui:type=relation;target=salon_service;label={"ro": "Serviciu", "en": "Serviciu"}'),
    
    stylistId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Stilist", "en": "Stilist"}'),
    
    date_time: z.string()
      .describe('ui:type=datetime;width=12;label={"ro": "Dată & Oră", "en": "Date & Oră"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],

  extensions: {
    contact: {
      schema: {
        beautyCategory: z.enum(['regular', 'vip', 'premium']).optional().describe('ui:width=6;label={"ro": "Categorie Client", "en": "Category Client"}'),
        lastStylistNote: z.string().optional().describe('ui:type=textarea;width=12;label={"ro": "Notă Stilist", "en": "Notă Stilist"}'),
      }
    }
  }
};

export default [salon_service, salon_appointment];
