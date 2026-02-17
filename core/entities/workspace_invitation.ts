import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * WORKSPACE INVITATION (v3 Modular)
 */
export const workspace_invitation: EntityV3<any> = {
  id: 'workspace_invitation',
  label: { ro: 'Invitație', en: 'Invitation' },
  labelPlural: { ro: 'Invitații', en: 'Invitations' },
  icon: 'Mail',
  tableName: 'invitation',
  displayField: 'email',
  isSystem: true,

  // Marketplace Solution Metadata
  solutionId: 'workspace-onboarding-system',
  solutionTitle: { ro: 'Sistem Onboarding Workspace', en: 'Workspace Onboarding' },
  description: { 
    ro: 'Gestionarea invitațiilor pentru noi membri în spațiul de lucru.', 
    en: 'Manage invitations for new members to join the workspace.' 
  },
  category: 'system',
  priority: 8,

  schema: z.object({
    ...BaseSchema,
    email: z.string().email()
      .describe('ui:width=6;icon=Mail;label={"ro": "Adresă Email", "en": "Email Address"}'),
    
    role: z.string().default('user')
      .describe('ui:width=6;icon=Shield;label={"ro": "Rol Atribuit", "en": "Assigned Role"}'),
    
    status: z.enum(['pending', 'accepted', 'expired']).default('pending')
      .describe('ui:width=6;icon=Activity;label={"ro": "Status Invitație", "en": "Invitation Status"}'),
    
    expiresAt: z.date().optional()
      .describe('ui:width=6;icon=Calendar;label={"ro": "Data Expirării", "en": "Expiry Date"}'),
    
    token: z.string().optional()
      .describe('ui:hidden=true;label={"ro": "Token Securitate", "en": "Security Token"}'),
  }),


  features: ['audit', 'timestamps', 'creatable', 'deletable'],

  menuConfig: {
    showInMainMenu: false,
    category: 'administration',
    icon: 'Mail',
    priority: 140
  }
};
