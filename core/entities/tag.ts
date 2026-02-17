import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * TAG ENTITY (v3 Modular)
 * Categorization system for all system entities.
 */
export const tag: EntityV3<any> = {
  id: 'tag',
  label: { ro: 'Etichetă', en: 'Tag' },
  labelPlural: { ro: 'Etichete', en: 'Tags' },
  icon: 'Tag',
  tableName: 'tag',
  displayField: 'name',
  isSystem: true,
  baseline: true,

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .min(1, { ro: 'Numele este obligatoriu', en: 'Name is required' } as any)
      .describe('ui:width=12;searchable=true;icon=Type;label={"ro": "Nume Etichetă", "en": "Tag Name"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Descriere", "en": "Description"}'),
    
    color: z.string().default('#3b82f6')
      .describe('ui:width=6;type=color;icon=Palette;label={"ro": "Culoare", "en": "Color"}'),
    
    icon: z.string().default('Tag')
      .describe('ui:width=6;type=icon;icon=Search;label={"ro": "Iconiță", "en": "Icon"}'),
    
    entityType: z.enum(['contact', 'product', 'interaction', 'all']).default('all')
      .describe('ui:width=12;icon=Layers;label={"ro": "Tip Entitate", "en": "Entity Type"};hint={"ro": "Restricționează eticheta la un anumit tip de date", "en": "Restrict tag to a specific data type"}'),
  }),

  features: ['audit', 'timestamps'],

  menuConfig: {
    showInMainMenu: true,
    category: 'data_systems',
    icon: 'Tag',
    priority: 10
  }
};
