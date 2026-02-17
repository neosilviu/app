import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * KNOWLEDGE BASE - Entities
 */
const article: EntityV3<any> = {
  id: 'article',
  label: { ro: 'Articol', en: 'Article' },
  labelPlural: { ro: 'Articole', en: 'Articles' },
  icon: 'BookOpen',
  tableName: 'kb_article',
  displayField: 'title',

  // Marketplace Metadata
  solutionId: 'knowledge-base',
  solutionTitle: { ro: 'Bază de Cunoștințe (KB)', en: 'Knowledge Base (KB)' },
  description: { ro: 'Documentație internă, tutoriale și articole de ajutor.', en: 'Internal documentation, tutorials and help articles.' },
  category: 'operations',

  schema: z.object({
    ...BaseSchema,
    title: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Titlu", "en": "Title"}'),
    
    content: z.string().optional()
      .describe('ui:type=richtext;width=12;label={"ro": "Conținut", "en": "Conținut"}'),
    
    category: z.string().optional()
      .describe('ui:width=6;label={"ro": "Categorie", "en": "Category"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],
};

export default [article];
