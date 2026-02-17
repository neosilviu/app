import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * USER ENTITY (v3 Modular)
 * System entity for authentication and profile management.
 */
export const user: EntityV3<any> = {
  id: 'user',
  label: { ro: 'Utilizator', en: 'User' },
  labelPlural: { ro: 'Utilizatori', en: 'Users' },
  icon: 'User',
  tableName: 'user',
  displayField: 'name',
  isSystem: true,
  isGlobal: true,
  baseline: true,

  // Marketplace Solution Metadata
  solutionId: 'user-identity-hub',
  solutionTitle: { ro: 'Identitate Utilizatori', en: 'User Identity Hub' },
  description: { 
    ro: 'Profilul central de utilizator și setările de cont.', 
    en: 'Central user profile and account settings.' 
  },
  category: 'security',
  priority: 10,

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .min(2, { ro: 'Nume prea scurt', en: 'Name too short' } as any)
      .describe('ui:width=6;icon=User;label={"ro": "Nume Complet", "en": "Full Name"};searchable=true;section={"ro": "Profil", "en": "Profile"}'),
    
    email: z.string().email({ ro: 'Email invalid', en: 'Invalid email' } as any)
      .describe('ui:width=6;icon=Mail;label={"ro": "Adresă Email", "en": "Email"};index=true;section={"ro": "Profil", "en": "Profile"}'),
    
    emailVerified: z.boolean().default(false)
      .describe('ui:width=6;label={"ro": "Email Verificat", "en": "Email Verified"};section={"ro": "Securitate", "en": "Security"}'),
    
    image: z.string().optional()

      .describe('ui:width=12;type=image;label={"ro": "Poză Profil", "en": "Profile Image"};section={"ro": "Profil", "en": "Profile"}'),
    
    role: z.string().default('user')
      .describe('ui:width=6;type=relation;target=role;icon=Shield;label={"ro": "Rol Sistem", "en": "System Role"};section={"ro": "Securitate", "en": "Security"}'),
    
    active: z.boolean().default(true)
      .describe('ui:width=6;icon=Activity;label={"ro": "Cont Activ", "en": "Active Account"};section={"ro": "Securitate", "en": "Security"}'),
  }),

  features: ['audit', 'timestamps'],


  hooks: {
    afterUpdate: async (ctx: any, data: any) => {
      const { env } = ctx;
      if (env?.KV && data.id) {
        const userId = data.id;
        const keys = await env.KV.list({ prefix: `perms_bundle_${userId}_` });
        for (const key of keys.keys) {
          await env.KV.delete(key.name);
        }
      }
    },
    afterDelete: async (ctx: any, data: any) => {
      const { env } = ctx;
      if (env?.KV && data.id) {
        const userId = data.id;
        const keys = await env.KV.list({ prefix: `perms_bundle_${userId}_` });
        for (const key of keys.keys) {
          await env.KV.delete(key.name);
        }
      }
    }
  },

  actions: [
    {
      id: 'check-admin',
      label: 'Verifică Admin Existent',
      handler: async (ctx: any) => {
        const { db, env } = ctx;
        if (env?.KV) {
            const cached = await env.KV.get('admin_exists');
            if (cached === 'true') return { exists: true };
        }
        const result = await db.query("SELECT COUNT(*) as count FROM user");
        const exists = (result?.[0]?.count || 0) > 0;
        if (exists && env?.KV) await env.KV.put('admin_exists', 'true');
        return { exists };
      }
    },
    {
      id: 'update-profile',
      label: 'Actualizează Profil',
      handler: async (ctx: any, input: any) => {
        const { db, user, selectedLang, renderString } = ctx;
        if (!user?.id) throw new Error(renderString({ ro: "Neautorizat", en: "Unauthorized" }, selectedLang));
        const { displayName, phone, company } = input;
        await db.update('contact', user.id, {
            name: displayName || user.name,
            phone: phone || null,
            company: company || null,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
      }
    },
    {
      id: 'setup-admin',
      label: 'Configurare Admin',
      handler: async (ctx: any, input: any) => {
        const { db, env, request, selectedLang, renderString, getAuth } = ctx;
        
        const data = input.data || input || {};
        const email = data.email;
        const password = data.password;
        const name = data.name;
        
        const workspaceId = 'system';
        const workspaceName = 'System Administration';
        const auth = getAuth(env, request);
        
        const anyUserResult = await db.query("SELECT COUNT(*) as count FROM user");
        const userCount = anyUserResult?.[0]?.count || 0;
        if (userCount > 0) {
            throw new Error(renderString({ 
                ro: `Sistemul este deja configurat (${userCount} utilizatori găsiți).`, 
                en: `System is already initialized (${userCount} users found).` 
            }, selectedLang));
        }

        if (!email || !password) throw new Error("Email and password are required.");

        const authResult: any = await auth.api.signUpEmail({
            body: { email, password, name: name || email.split('@')[0], role: 'superadmin', workspaceId }
        });

        if (!authResult || authResult.error) throw new Error(authResult?.error?.message || "Auth provider failed");

        const userId = authResult.user.id;
        const registerTime = new Date().toISOString();
        
        await db.batch([
            db.prepare("INSERT OR IGNORE INTO workspace (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)").bind(workspaceId, workspaceName, registerTime, registerTime),
            db.prepare("UPDATE user SET workspaceId = ?, role = ? WHERE id = ?").bind(workspaceId, 'superadmin', userId),
            db.prepare("INSERT OR REPLACE INTO contact (id, workspaceId, name, email, status, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(userId, workspaceId, name || email.split('@')[0], email, 'active', 'superadmin', registerTime, registerTime),
            db.prepare("INSERT OR REPLACE INTO workspace_user (id, workspaceId, userId, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").bind(`wu_${userId}`, workspaceId, userId, 'superadmin', registerTime, registerTime)
        ]);
        
        return { user: authResult.user, workspaceId };
      }
    }
  ],

  menuConfig: {
    showInMainMenu: true,
    category: 'administration',
    icon: 'User',
    priority: 80
  }
};
