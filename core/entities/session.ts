import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * SESSION ENTITY (v3 Modular)
 */
export const session: EntityV3<any> = {
  id: 'session',
  label: { ro: 'Sesiune', en: 'Session' },
  labelPlural: { ro: 'Sesiuni', en: 'Sessions' },
  icon: 'Key',
  tableName: 'session',
  displayField: 'id',
  isSystem: true,
  isGlobal: true,
  baseline: true,

  // Marketplace Solution Metadata
  solutionId: 'auth-security-hub',
  solutionTitle: { ro: 'Hub Securitate Sesiuni', en: 'Session Security Hub' },
  description: { 
    ro: 'Monitorizarea și gestionarea sesiunilor active de utilizator.', 
    en: 'Monitoring and managing active user sessions.' 
  },
  category: 'system',
  priority: 15,

  schema: z.object({
    ...BaseSchema,
    userId: z.string()
      .describe('ui:width=6;type=relation;target=user;icon=User;label={"ro": "Utilizator", "en": "User"}'),
    
    expiresAt: z.date()

      .describe('ui:width=6;icon=Calendar;label={"ro": "Expiră la", "en": "Expires At"}'),
    
    ipAddress: z.string().optional()
      .describe('ui:width=6;icon=Network;label={"ro": "Adresă IP", "en": "IP Address"}'),
    
    userAgent: z.string().optional()
      .describe('ui:width=12;icon=Computer;label={"ro": "Browser / Sistem", "en": "User Agent"}'),
    
    token: z.string()
      .describe('ui:hidden=true;label={"ro": "Token Sesiune", "en": "Session Token"}'),
  }),


  features: ['deletable'],

  menuConfig: {
    showInMainMenu: true,
    category: 'administration',
    icon: 'Key',
    priority: 150
  }
};
