import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * NOTIFICATION ENTITY (v3 Modular)
 */
export const notification: EntityV3<any> = {
  id: 'notification',
  label: { ro: 'Notificare', en: 'Notification' },
  labelPlural: { ro: 'Notificări', en: 'Notifications' },
  icon: 'Bell',
  tableName: 'notification',
  displayField: 'title',

  // Marketplace Solution Metadata
  solutionId: 'internal-notification-system',
  solutionTitle: { ro: 'Sistem Notificări Interne', en: 'Internal Notification System' },
  description: { 
    ro: 'Flux de alerte și mesaje de sistem pentru utilizatori.', 
    en: 'Alert flow and system messages for users.' 
  },
  category: 'system',
  priority: 30,

  schema: z.object({
    ...BaseSchema,
    userId: z.string()
      .describe('ui:width=6;type=relation;target=contact;icon=User;label={"ro": "Destinatar", "en": "Recipient"};section={"ro": "Detalii", "en": "Details"}'),
    
    title: z.string()
      .describe('ui:width=12;icon=Type;label={"ro": "Titlu", "en": "Title"};searchable=true;section={"ro": "Conținut", "en": "Content"}'),
    
    body: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Mesaj", "en": "Body"};section={"ro": "Conținut", "en": "Content"}'),
    
    type: z.enum(['info', 'warning', 'error', 'success']).default('info')
      .describe('ui:width=6;icon=Filter;label={"ro": "Tip Alerta", "en": "Alert Type"};section={"ro": "Detalii", "en": "Details"}'),
    
    status: z.enum(['unread', 'read']).default('unread')
      .describe('ui:width=6;icon=Activity;label={"ro": "Status Citire", "en": "Status"};section={"ro": "Detalii", "en": "Details"}'),
  }),

  features: ['timestamps', 'soft-delete', 'audit'],


  menuConfig: {
    showInMainMenu: false
  }
};
