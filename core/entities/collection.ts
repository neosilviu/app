import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * COLLECTION ENTITY (v3 Modular)
 */
export const collection: EntityV3<any> = {
  id: 'collection',
  label: { ro: 'Colecție', en: 'Collection' },
  labelPlural: { ro: 'Colecții', en: 'Collections' },
  icon: 'Folder',
  tableName: 'collection',
  displayField: 'name',
  isSystem: true,

  // Marketplace Solution Metadata
  solutionId: 'universal-content-organizer',
  solutionTitle: { ro: 'Organizator Conținut', en: 'Universal Content Organizer' },
  description: { 
    ro: 'Grupează și categorizează orice tip de date prin colecții dinamice.', 
    en: 'Group and categorize any type of data through dynamic collections.' 
  },
  category: 'system',
  priority: 5,

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .describe('ui:width=12;icon=Tag;label={"ro": "Nume Colecție", "en": "Collection Name"}'),
    
    slug: z.string().optional()
      .describe('ui:width=12;icon=Link;label={"ro": "Slug URL", "en": "URL Slug"}'),
    
    description: z.string().optional()
      .describe('ui:type=text;width=12;icon=FileText;label={"ro": "Descriere", "en": "Description"}'),
    
    color: z.string().optional()
      .describe('ui:type=color;width=6;icon=Palette;label={"ro": "Culoare", "en": "Color"}'),
    
    icon: z.string().optional()
      .describe('ui:type=icon;width=6;icon=Smile;label={"ro": "Iconiță", "en": "Icon"}'),
  }),


  features: ['timestamps'],

  menuConfig: {
    showInMainMenu: true,
    category: 'administration',
    icon: 'Folder',
    priority: 20
  }
};
