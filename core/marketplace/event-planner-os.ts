import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * EVENT PLANNER OS - Entities
 */
const event: EntityV3<any> = {
  id: 'event',
  label: { ro: 'Eveniment', en: 'Event' },
  labelPlural: { ro: 'Evenimente', en: 'Events' },
  icon: 'Calendar',
  tableName: 'event',
  displayField: 'name',

  // Marketplace Metadata
  solutionId: 'event-planner-os',
  solutionTitle: { ro: 'Event Planner OS', en: 'Event Planner OS' },
  description: { ro: 'Management evenimente, locații, speakeri și bilete.', en: 'Comprehensive event management, venues, speakers and tickets.' },
  category: 'events',

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .min(1)
      .describe('ui:width=12;label={"ro": "Nume Eveniment", "en": "Name Eveniment"}'),
    
    location: z.string().optional()
      .describe('ui:width=12;label={"ro": "Locație", "en": "Locație"}'),
    
    start_date: z.string().optional()
      .describe('ui:type=datetime;width=6;label={"ro": "Start", "en": "Start"}'),
    
    end_date: z.string().optional()
      .describe('ui:type=datetime;width=6;label={"ro": "End", "en": "End"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],

  extensions: {
    contact: {
      schema: {
        isSpeaker: z.boolean().default(false).describe('ui:width=6;label={"ro": "Este Speaker", "en": "Este Speaker"}'),
        bio: z.string().optional().describe('ui:type=textarea;width=12;label={"ro": "Biografie", "en": "Biografie"}'),
      }
    }
  }
};

export default [event];
