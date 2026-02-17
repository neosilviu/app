import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * ENTITY NOTE (v3 Modular)
 */
export const entity_note: EntityV3<any> = {
  id: 'entity_note',
  label: { ro: 'Notă', en: 'Note' },
  labelPlural: { ro: 'Note și Comentarii', en: 'Notes & Comments' },
  icon: 'StickyNote',
  tableName: 'entity_note',
  displayField: 'content',
  isSystem: true,

  // Marketplace Solution Metadata
  solutionId: 'universal-collaboration-system',
  solutionTitle: { ro: 'Sistem Universal Note', en: 'Universal Collaboration Notes' },
  description: { 
    ro: 'Modul centralizat pentru note, comentarii și colaborare pe orice entitate.', 
    en: 'Centralized module for notes, comments, and collaboration on any entity.' 
  },
  category: 'collaboration',
  priority: 3,

  schema: z.object({
    ...BaseSchema,
    content: z.string()
      .describe('ui:type=text;width=12;searchable=true;icon=MessageSquare;label={"ro": "Conținut Notă", "en": "Note Content"}'),
    
    entityType: z.string()
      .describe('ui:width=6;searchable=true;icon=Layers;label={"ro": "Tip Entitate", "en": "Entity Type"}'),
    
    entityId: z.string()
      .describe('ui:width=6;searchable=true;icon=Hash;label={"ro": "ID Record", "en": "Record ID"}'),
    
    authorId: z.string().optional()
      .describe('ui:type=relation;target=contact;icon=User;label={"ro": "Autor", "en": "Author"}'),
  }),


  features: ['soft-delete', 'creatable', 'editable', 'deletable'],
};
