import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * ENTITY ATTACHMENT (v3 Modular)
 */
export const entity_attachment: EntityV3<any> = {
  id: 'entity_attachment',
  label: { ro: 'Ataşament Entitate', en: 'Entity Attachment' },
  labelPlural: { ro: 'Ataşamente', en: 'Attachments' },
  icon: 'Paperclip',
  tableName: 'entity_attachment',
  displayField: 'entityId',
  isSystem: true,

  // Marketplace Solution Metadata
  solutionId: 'universal-attachment-hub',
  solutionTitle: { ro: 'Hub Universal Atașamente', en: 'Universal Attachment Hub' },
  description: { 
    ro: 'Legătura centralizată între fișiere și entitățile din sistem.', 
    en: 'Centralized link between files and system entities.' 
  },
  category: 'system',
  priority: 1,

  schema: z.object({
    ...BaseSchema,
    fileId: z.string()
      .describe('ui:width=6;type=relation;target=file;icon=File;label={"ro": "Fișier Atașat", "en": "Attached File"}'),
    
    category: z.string().optional()
      .describe('ui:width=6;icon=Tag;label={"ro": "Categorie Atașament", "en": "Attachment Category"}'),

    entityType: z.string()
      .describe('ui:width=6;icon=Layers;label={"ro": "Tip Entitate Sursă", "en": "Source Entity Type"}'),
    
    entityId: z.string()
      .describe('ui:width=6;icon=Hash;label={"ro": "ID Record Sursă", "en": "Source Record ID"}'),
  }),


  features: ['timestamps'],
};
