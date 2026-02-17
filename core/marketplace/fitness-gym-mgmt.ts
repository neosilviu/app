import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * FITNESS & GYM MANAGEMENT - Entities
 */
const gym_membership: EntityV3<any> = {
  id: 'gym_membership',
  label: { ro: 'Abonament Fit', en: 'Fitness Membership' },
  labelPlural: { ro: 'Abonamente Fit', en: 'Fitness Memberships' },
  icon: 'Dumbbell',
  tableName: 'gym_membership',
  displayField: 'clientId',

  // Marketplace Metadata
  solutionId: 'fitness-gym-mgmt',
  solutionTitle: { ro: 'Fitness & Gym Management', en: 'Fitness & Gym Management' },
  description: { ro: 'Management abonamente sală, antrenori personali și acces.', en: 'Gym memberships, personal trainers and entry logs.' },
  category: 'fitness',

  schema: z.object({
    ...BaseSchema,
    clientId: z.string()
      .describe('ui:type=relation;target=contact;label={"ro": "Membru", "en": "Membru"}'),
    
    type: z.enum(['monthly', 'quarterly', 'yearly', 'day_pass'])
      .describe('ui:width=6;label={"ro": "Tip", "en": "Type"}'),
    
    expiry_date: z.string().optional()
      .describe('ui:type=date;width=6;label={"ro": "Data Expirării", "en": "Expiry Date"}'),
    
    status: z.enum(['active', 'expired', 'frozen'])
      .default('active')
      .describe('ui:width=6;label={"ro": "Status", "en": "Status"}'),
  }),

  features: ['audit', 'timestamps', 'soft-delete'],

  extensions: {
    contact: {
      schema: {
        membershipStart: z.string().optional().describe('ui:type=date;width=6;label={"ro": "Început Abonament", "en": "Început Abonament"}'),
        fitnessGoals: z.string().optional().describe('ui:type=textarea;width=12;label={"ro": "Obiective Fitness", "en": "Obiective Fitness"}'),
      }
    }
  }
};

export default [gym_membership];
