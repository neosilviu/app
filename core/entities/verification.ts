import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * VERIFICATION ENTITY (v3 Modular)
 */
export const verification: EntityV3<any> = {
  id: 'verification',
  label: { ro: 'Verificare', en: 'Verification' },
  labelPlural: { ro: 'Verificări', en: 'Verifications' },
  icon: 'ShieldCheck',
  tableName: 'verification',
  displayField: 'identifier',
  isSystem: true,
  baseline: true,

  // Marketplace Solution Metadata
  solutionId: 'universal-trust-verify',
  solutionTitle: { ro: 'Sistem Verificare Autenticitate', en: 'Identity Trust & Verify' },
  description: { 
    ro: 'Gestionarea codurilor de verificare și validării identității.', 
    en: 'Managing verification codes and identity validation.' 
  },
  category: 'system',
  priority: 10,

  schema: z.object({
    ...BaseSchema,
    identifier: z.string()
      .describe('ui:width=6;icon=Fingerprint;label={"ro": "Identificator (Email/Tel)", "en": "Identifier (Email/Phone)"}'),
    
    value: z.string()
      .describe('ui:width=6;icon=Key;label={"ro": "Cod Verificare", "en": "Verification Code"}'),
    
    expiresAt: z.date()
      .describe('ui:width=12;icon=Calendar;label={"ro": "Data Expirării", "en": "Expiry Date"}'),
  }),


  features: ['deletable'],
};
