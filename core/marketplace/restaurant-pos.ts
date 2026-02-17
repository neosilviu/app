import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * RESTAURANT & POS - Entities
 */
const menu_item: EntityV3<any> = {
  id: 'menu_item',
  label: { ro: 'Element Meniu', en: 'Menu Item' },
  labelPlural: { ro: 'Elemente Meniu', en: 'Menu Items' },
  icon: 'Utensils',
  tableName: 'menu_item',
  displayField: 'name',

  // Marketplace Metadata
  solutionId: 'restaurant-pos',
  solutionTitle: { ro: 'Restaurant & POS', en: 'Restaurant & POS' },
  description: { ro: 'Gestiune meniu, mese, comenzi și facturare rapidă.', en: 'Menu management, tables, orders and quick billing.' },
  category: 'hospitality',

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Nume Preparat", "en": "Dish Name"}'),
    
    price: z.number()
      .describe('ui:type=currency;width=6;label={"ro": "Preț", "en": "Price"}'),
    
    category: z.enum(['pizza', 'pasta', 'drinks', 'dessert'])
      .describe('ui:width=6;label={"ro": "Categorie", "en": "Category"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

export default [menu_item];
