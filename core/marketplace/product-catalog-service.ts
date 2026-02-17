import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * PRODUCT CATALOG & INVENTORY - Entities
 */
const service_product: EntityV3<any> = {
  id: 'service_product',
  label: { ro: 'Produs Service', en: 'Service Product' },
  labelPlural: { ro: 'Produse Service', en: 'Service Products' },
  icon: 'Box',
  tableName: 'service_product',
  displayField: 'name',

  // Marketplace Metadata
  solutionId: 'product-catalog-service',
  solutionTitle: { ro: 'Catalog Produse & Inventar', en: 'Product Catalog & Inventory' },
  description: { ro: 'Gestiune mărfuri fizice și produse digitale (Cărți/GDrive).', en: 'Physical goods and digital products management.' },
  category: 'inventory',

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Nume Produs", "en": "Name Product"}'),
    
    product_type: z.enum(['Marfa', 'Carte'])
      .default('Marfa')
      .describe('ui:width=6;label={"ro": "Tip Produs", "en": "Product Type"}'),
    
    serial_number: z.string().optional()
      .describe('ui:width=6;label={"ro": "Serie/IMEI", "en": "Serial/IMEI"}'),
    
    warranty_months: z.number().optional()
      .describe('ui:width=6;label={"ro": "Garanție Implicită", "en": "Default Warranty"}'),
    
    photo_url: z.string().optional()
      .describe('ui:type=image;width=12;label={"ro": "Poză Produs", "en": "Product Photo"}'),
    
    gdrive_link: z.string().optional()
      .describe('ui:type=url;width=12;label={"ro": "Resurse GDrive", "en": "GDrive Resources"}'),
    
    price: z.number().optional()
      .describe('ui:type=currency;width=6;label={"ro": "Preț Vânzare", "en": "Sale Price"}'),
    
    description: z.string().optional()
      .describe('ui:type=textarea;width=12;label={"ro": "Descriere", "en": "Description"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

export default [service_product];
