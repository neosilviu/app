import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * AUDIT LOG ENTITY (v3 Modular)
 * System entity for tracking all changes and security events.
 */
export const audit_log: EntityV3<any> = {
  id: 'audit_log',
  label: { ro: 'Jurnal Audit', en: 'Audit Log' },
  labelPlural: { ro: 'Jurnale Audit', en: 'Audit Logs' },
  icon: 'ShieldCheck',
  tableName: 'audit_log',
  displayField: 'action',
  isSystem: true,
  isGlobal: true,
  baseline: true,
  indexes: [
    'workspaceId, createdAt DESC',
    'entityType, entityId'
  ],

  // Marketplace Solution Metadata
  solutionId: 'system-audit-trail',
  solutionTitle: { ro: 'Jurnal Audit Sistem', en: 'System Audit Trail' },
  description: { 
    ro: 'Traseul securizat al tuturor modificărilor efectuate în platformă.', 
    en: 'Secure trail of all modifications made in the platform.' 
  },
  category: 'security',
  priority: 5,

  schema: z.object({
    ...BaseSchema,
    userId: z.string().optional()
      .describe('ui:hidden=true;type=relation;target=contact;field=name;index=true'),
    
    user: z.string().optional()
      .describe('ui:width=4;icon=User;label={"ro": "Utilizator", "en": "User"};section={"ro": "Context", "en": "Context"}'),
    
    action: z.string()
      .describe('ui:width=4;icon=Zap;label={"ro": "Acțiune", "en": "Action"};index=true;section={"ro": "Detalii", "en": "Details"}'),
    
    entityType: z.string()
      .describe('ui:width=4;icon=Layers;label={"ro": "Tip Entitate", "en": "Entity Type"};index=true;section={"ro": "Detalii", "en": "Details"}'),
    
    entityId: z.string()
      .describe('ui:width=4;label={"ro": "ID Record", "en": "Record ID"};index=true;section={"ro": "Detalii", "en": "Details"}'),
    
    display_value: z.string().optional()
      .describe('ui:width=4;label={"ro": "Valoare Afișată", "en": "Display Value"};section={"ro": "Detalii", "en": "Details"}'),
    
    details: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Detalii Modificare", "en": "Modification Details"};section={"ro": "Conținut", "en": "Content"}'),
    
    snapshot_before: z.any().optional()
      .describe('ui:hidden=true;type=json'),
    
    snapshot_after: z.any().optional()
      .describe('ui:hidden=true;type=json'),
  }),


  features: ['audit', 'timestamps'], // Fixed system features

  actions: [
    {
      id: 'undo',
      label: 'Undo',
      description: 'Anulează modificarea și revine la snapshot-ul anterior',
      input: z.object({
        recordId: z.string().uuid()
      }),
      handler: async (ctx: any, input: any) => {
        const { db, entity } = ctx;
        const log = await db.get('audit_log', input.recordId);
        if (!log || !log.snapshot_before) {
          throw new Error('Snapshot-ul anterior nu a fost găsit');
        }

        const data = typeof log.snapshot_before === 'string' 
          ? JSON.parse(log.snapshot_before) 
          : log.snapshot_before;

        await db.update(log.entityType, log.entityId, data);
        
        return { success: true, message: 'Restaurare finalizată' };
      }
    }
  ],

  menuConfig: {
    showInMainMenu: true,
    category: 'administration',
    icon: 'ShieldCheck',
    priority: 90
  }
};
