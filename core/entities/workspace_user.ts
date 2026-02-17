import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * WORKSPACE USER / MEMBER (v3 Modular)
 */
export const workspace_user: EntityV3<any> = {
  id: 'workspace_user',
  label: { ro: 'Membru Spațiu', en: 'Workspace Member' },
  labelPlural: { ro: 'Membri Spațiu', en: 'Workspace Members' },
  icon: 'Users',
  tableName: 'workspace_user',
  displayField: 'userId',
  isSystem: true,

  // Marketplace Solution Metadata
  solutionId: 'rbac-membership-manager',
  solutionTitle: { ro: 'Management Membri Workspace', en: 'Workspace Membership Manager' },
  description: { 
    ro: 'Definirea permisiunilor și a rolurilor specifice pentru utilizatori într-un spațiu de lucru.', 
    en: 'Defining specific permissions and roles for users within a workspace.' 
  },
  category: 'security',
  priority: 12,

  schema: z.object({
    ...BaseSchema,
    userId: z.string()
      .describe('ui:width=6;type=relation;target=contact;icon=User;label={"ro": "Utilizator / Membru", "en": "User / Member"};section={"ro": "Acces", "en": "Access"}'),
    
    role: z.enum(['superadmin', 'owner', 'admin', 'user', 'guest']).default('user')
      .describe('ui:width=6;icon=Shield;label={"ro": "Rol în Workspace", "en": "Workspace Role"};section={"ro": "Acces", "en": "Access"}'),
    
    permission: z.string().optional()
      .describe('ui:width=12;type=json;icon=Lock;label={"ro": "Permisiuni Custom (JSON)", "en": "Custom Permissions"};section={"ro": "Advanced", "en": "Advanced"}'),
  }),


  features: ['audit', 'timestamps', 'creatable', 'editable', 'deletable'],

  hooks: {
    afterUpdate: async (ctx: any, data: any, id: string) => {
      const userId = data.userId || ctx.previousData?.userId;
      const workspaceId = data.workspaceId || ctx.previousData?.workspaceId || ctx.user?.workspaceId || 'none';
      if (userId && ctx.env?.KV) {
        await ctx.env.KV.delete(`perms_bundle_${userId}_${workspaceId}`);
        console.log(`[HOOK] Invalidated perms bundle for user ${userId} in workspace ${workspaceId}`);
      }
    },
    afterDelete: async (ctx: any, id: string) => {
      const userId = ctx.previousData?.userId;
      const workspaceId = ctx.previousData?.workspaceId || ctx.user?.workspaceId || 'none';
      if (userId && ctx.env?.KV) {
        await ctx.env.KV.delete(`perms_bundle_${userId}_${workspaceId}`);
        console.log(`[HOOK] Invalidated perms bundle for deleted workspace_user ${userId} in ${workspaceId}`);
      }
    }
  },

  menuConfig: {
    showInMainMenu: false,
    category: 'administration',
    icon: 'Users',
    priority: 130
  }
};
