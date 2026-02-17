import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * HELP CONTENT ENTITY (v3 Modular)
 */
export const help_content: EntityV3<any> = {
  id: 'help_content',
  label: { ro: 'Conținut Ajutor', en: 'Help Content' },
  labelPlural: { ro: 'Conținuturi Ajutor', en: 'Help Contents' },
  icon: 'BookOpen',
  tableName: '_help_content',
  displayField: 'title',
  isSystem: true,

  // Marketplace Solution Metadata
  solutionId: 'universal-knowledge-base',
  solutionTitle: { ro: 'Bază de Cunoștințe Universală', en: 'Universal Knowledge Base' },
  description: { 
    ro: 'Documentație și suport contextual integrat în aplicație.', 
    en: 'Contextual documentation and support integrated into the application.' 
  },
  category: 'system',
  priority: 10,

  schema: z.object({
    ...BaseSchema,
    title: z.string().optional()
      .describe('ui:width=12;icon=Heading;label={"ro": "Titlu Document", "en": "Document Title"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;icon=FileText;label={"ro": "Descriere Scurtă", "en": "Short Description"}'),
    
    content: z.string().optional()
      .describe('ui:type=text;width=12;icon=BookOpen;label={"ro": "Conținut Complet (MD)", "en": "Full Content (MD)"}'),
  }),


  features: ['timestamps', 'deletable'],
};
