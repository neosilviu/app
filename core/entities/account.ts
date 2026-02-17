import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * ACCOUNT ENTITY (v3 Modular - External Auth)
 */
export const account: EntityV3<any> = {
  id: 'account',
  label: { ro: 'Cont Extern', en: 'External Account' },
  labelPlural: { ro: 'Conturi Externe', en: 'External Accounts' },
  icon: 'Fingerprint',
  tableName: 'account',
  displayField: 'providerId',
  isSystem: true,
  baseline: true,

  // Marketplace Solution Metadata
  solutionId: 'auth-management-core',
  solutionTitle: { ro: 'Management Autentificare', en: 'Auth Management Core' },
  description: { 
    ro: 'Gestionarea legăturilor cu furnizori externi de identitate (Google, GitHub etc).', 
    en: 'Managing links with external identity providers (Google, GitHub, etc).' 
  },
  category: 'system',
  priority: 5,

  schema: z.object({
    ...BaseSchema,
    userId: z.string()
      .describe('ui:width=6;type=relation;target=user;label={"ro": "Utilizator", "en": "User"};section={"ro": "Detalii Cont", "en": "Account Details"}'),
    
    providerId: z.string()

      .describe('ui:width=6;icon=Key;label={"ro": "Furnizor", "en": "Provider"};section={"ro": "Detalii Cont", "en": "Account Details"}'),
    
    accountId: z.string()
      .describe('ui:width=12;label={"ro": "ID Extern", "en": "External ID"};section={"ro": "Detalii Cont", "en": "Account Details"}'),
    
    accessToken: z.string().optional().describe('ui:hidden=true'),
    refreshToken: z.string().optional().describe('ui:hidden=true'),
    idToken: z.string().optional().describe('ui:hidden=true'),
    
    expiresAt: z.date().optional()
      .describe('ui:width=6;label={"ro": "Expiră la", "en": "Expires At"};section={"ro": "Securitate", "en": "Security"}'),
    
    password: z.string().optional()
      .describe('ui:width=12;type=password;label={"ro": "Parolă (Hash)", "en": "Password (Hash)"};section={"ro": "Securitate", "en": "Security"}'),
  }),

  features: ['deletable', 'audit'],
};

