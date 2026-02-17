import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * REAL ESTATE PRO - Entities
 */
const property: EntityV3<any> = {
  id: 'property',
  label: { ro: 'Proprietate', en: 'Property' },
  labelPlural: { ro: 'Proprietăți', en: 'Properties' },
  icon: 'Home',
  tableName: 'property',
  displayField: 'title',

  // Marketplace Metadata
  solutionId: 'real-estate-pro',
  solutionTitle: { ro: 'Imobiliare Pro', en: 'Real Estate Pro' },
  description: { ro: 'Gestiune proprietăți, vizionări, agenți și contracte.', en: 'Property management, viewings, agents and contracts.' },
  category: 'real_estate',

  schema: z.object({
    ...BaseSchema,
    title: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Titlu", "en": "Title"}'),
    
    address: z.string().optional()
      .describe('ui:width=12;label={"ro": "Adresă", "en": "Address"}'),
    
    type: z.enum(['apartment', 'house', 'land', 'commercial'])
      .describe('ui:width=6;label={"ro": "Tip", "en": "Type"}'),
    
    price: z.number().optional()
      .describe('ui:type=currency;width=6;label={"ro": "Preț", "en": "Price"}'),
    
    status: z.enum(['available', 'reserved', 'sold', 'rented'])
      .default('available')
      .describe('ui:width=6;label={"ro": "Status", "en": "Status"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

const viewing: EntityV3<any> = {
  id: 'viewing',
  label: { ro: 'Vizionare', en: 'Viewing' },
  labelPlural: { ro: 'Vizionări', en: 'Viewings' },
  icon: 'Eye',
  tableName: 'viewing',
  displayField: 'date',

  // Marketplace Metadata
  solutionId: 'real-estate-pro',
  solutionTitle: { ro: 'Imobiliare Pro', en: 'Real Estate Pro' },
  category: 'real_estate',

  schema: z.object({
    ...BaseSchema,
    propertyId: z.string()
      .describe('ui:type=relation;target=property;label={"ro": "Proprietate", "en": "Property"}'),
    
    clientId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Client", "en": "Client"}'),
    
    date: z.string()
      .describe('ui:type=datetime;width=12;label={"ro": "Dată Vizionare", "en": "Viewing Date"}'),
  }),

  features: ['audit', 'timestamps'],

  extensions: {
    contact: {
      schema: {
        budget: z.number().optional().describe('ui:type=currency;width=6;label={"ro": "Buget Client", "en": "Customer Budget"}'),
        preferredArea: z.string().optional().describe('ui:width=6;label={"ro": "Zonă Preferată", "en": "Preferred Area"}'),
      }
    }
  }
};

export default [property, viewing];
