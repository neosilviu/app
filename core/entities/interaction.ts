import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * INTERACTION ENTITY (v3 Modular)
 * Comms history (WhatsApp, Email, etc).
 */
export const interaction: EntityV3<any> = {
  id: 'interaction',
  label: { ro: 'Interacțiune', en: 'Interaction' },
  labelPlural: { ro: 'Interacțiuni', en: 'Interactions' },
  icon: 'MessageSquare',
  tableName: 'interaction',
  displayField: 'subject',
  isCore: true,
  
  indexes: [
    'workspaceId, createdAt DESC',
    'contactId',
    'chatId'
  ],
  
  // Marketplace Solution Metadata
  solutionId: 'omnichannel-inbox',
  solutionTitle: { ro: 'Inbox Omnichannel', en: 'Omnichannel Inbox' },
  description: { 
    ro: 'Urmărirea comunicațiilor prin WhatsApp, Email și SMS.', 
    en: 'Tracking communications via WhatsApp, Email, and SMS.' 
  },
  category: 'communication',
  priority: 90,

  schema: z.object({
    ...BaseSchema,
    contactId: z.string().optional()
      .describe('ui:width=6;type=relation;target=contact;label={"ro": "Contact Relatat", "en": "Related Contact"};index=true;section={"ro": "Sursă", "en": "Source"}'),
    
    chatId: z.string().optional()
      .describe('ui:width=6;label={"ro": "ID Chat / Fir", "en": "Chat / Thread ID"};section={"ro": "Sursă", "en": "Source"}'),
    
    provider: z.string().optional()
      .describe('ui:width=6;icon=Server;label={"ro": "Furnizor (WA/Mail)", "en": "Provider"};section={"ro": "Sursă", "en": "Source"}'),

    channel: z.enum(['whatsapp', 'email', 'sms', 'system', 'internal', 'other']).default('other')
      .describe('ui:width=6;icon=Share2;label={"ro": "Canal", "en": "Channel"};index=true;section={"ro": "Sursă", "en": "Source"}'),
    
    direction: z.enum(['inbound', 'outbound']).describe('ui:width=6;icon=ArrowLeftRight;label={"ro": "Direcție", "en": "Direction"};index=true;section={"ro": "Conținut", "en": "Content"}'),

    subject: z.string().optional()
      .describe('ui:width=12;icon=Type;label={"ro": "Subiect", "en": "Subject"};searchable=true;section={"ro": "Conținut", "en": "Content"}'),
    
    body: z.string()
      .describe('ui:width=12;type=textarea;label={"ro": "Conținut Mesaj", "en": "Message Body"};section={"ro": "Conținut", "en": "Content"}'),
    
    status: z.enum(['unread', 'read', 'archived', 'trash']).default('unread')
      .describe('ui:width=6;icon=Activity;label={"ro": "Status Mesaj", "en": "Message Status"};section={"ro": "Stare", "en": "State"}'),

    isPinned: z.boolean().default(false).describe('ui:width=3;icon=Pin;label=Pinned;section={"ro": "Stare", "en": "State"}'),
    isFavorite: z.boolean().default(false).describe('ui:width=3;icon=Star;label=Favorite;section={"ro": "Stare", "en": "State"}'),
    
    attachments: z.array(z.any()).optional()
      .describe('ui:width=12;type=file;label={"ro": "Fișiere Atașate", "en": "Attachments"};section={"ro": "Media", "en": "Media"}'),
      
    metadata: z.any().optional().describe('ui:width=12;label=Metadate (Raw);type=json;section={"ro": "Tehnic", "en": "Technical"}'),
  }),

  features: ['audit', 'soft-delete', 'export'],

  menuConfig: {
    showInMainMenu: true,
    category: 'communication',
    icon: 'Inbox',
    priority: 20
  }
};

