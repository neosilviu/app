import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * WORKSPACE ENTITY (v3 Modular)
 * Managed as a standalone business unit.
 */
export const workspace: EntityV3<any> = {
  id: 'workspace',
  label: { ro: 'Spațiu de Lucru', en: 'Workspace' },
  labelPlural: { ro: 'Spații de Lucru', en: 'Workspaces' },
  icon: 'Briefcase',
  tableName: 'workspace',
  displayField: 'name',
  excludeBaseFields: ['workspaceId'],
  isSystem: true,
  isGlobal: true,
  baseline: true,

  // Marketplace Solution Metadata
  solutionId: 'workspace-orchestrator',
  solutionTitle: { ro: 'Orchestrator Workspace', en: 'Workspace Orchestrator' },
  description: { 
    ro: 'Inima multi-tenancy: gestionarea spațiilor de lucru, proprietarilor și resurselor.', 
    en: 'Multi-tenancy heart: management of workspaces, owners, and resources.' 
  },
  category: 'system',
  priority: 200,

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .min(2, { ro: 'Nume prea scurt', en: 'Name too short' } as any)
      .describe('ui:width=12;icon=Layout;label={"ro": "Nume Workspace", "en": "Workspace Name"};searchable=true;section={"ro": "Profil", "en": "Profile"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Descriere", "en": "Description"};section={"ro": "Profil", "en": "Profile"}'),
    
    slug: z.string().min(2)
      .describe('ui:width=6;icon=Link;label={"ro": "Adresă URL (Slug)", "en": "Unique Slug"};section={"ro": "Configurare", "en": "Configuration"}'),
    
    ownerId: z.string()
      .describe('ui:width=6;type=relation;target=contact;icon=User;label={"ro": "Proprietar Legat", "en": "Owner"};section={"ro": "Configurare", "en": "Configuration"}'),
    
    avatarUrl: z.string().optional()
      .describe('ui:width=12;type=image;icon=Image;label={"ro": "Logo / Avatar", "en": "Workspace Logo"};section={"ro": "Profil", "en": "Profile"}'),
    
    setting: z.record(z.string(), z.any()).optional()
      .describe('ui:width=12;type=json;icon=Settings;label={"ro": "Setări Advanced (JSON)", "en": "Advanced Settings"};section={"ro": "Configurare", "en": "Configuration"}'),
    
    status: z.enum(['active', 'archived', 'deleted']).default('active')
      .describe('ui:width=6;icon=Activity;label={"ro": "Status Workspace", "en": "Status"};section={"ro": "Configurare", "en": "Configuration"}'),
  }),


  features: ['audit', 'soft-delete', 'deletable'],

  hooks: {
    beforeCreate: async (ctx: any, data: any) => {
      // Enterprise Level 10 Unified Logic
      if (!data.ownerId && ctx.user?.id) {
        data.ownerId = ctx.user.id;
      }
      return data;
    },
    afterUpdate: async (ctx: any, data: any) => {
      const { env } = ctx;
      if (env?.KV && data.id) {
        const wsId = data.id;
        const list = await env.KV.list({ prefix: `perms_bundle_` });
        for (const key of list.keys) {
          if (key.name.endsWith(`_${wsId}`)) {
            await env.KV.delete(key.name);
          }
        }
      }
    },
    afterDelete: async (ctx: any, data: any) => {
      const { env } = ctx;
      if (env?.KV && data.id) {
        const wsId = data.id;
        const list = await env.KV.list({ prefix: `perms_bundle_` });
        for (const key of list.keys) {
          if (key.name.endsWith(`_${wsId}`)) {
            await env.KV.delete(key.name);
          }
        }
      }
    }
  },

  actions: [
    {
      id: 'get-settings',
      label: 'Setări Workspace',
      handler: async (ctx: any) => {
        const { db, user, deepParse } = ctx;
        const ws = await db.get('workspace', user.workspaceId || 'system');
        return deepParse(ws?.setting || {});
      }
    },
    {
      id: 'update-settings',
      label: 'Actualizare Setări',
      handler: async (ctx: any, input: any) => {
        const { db, user, deepParse } = ctx;
        const ws = await db.get('workspace', user.workspaceId || 'system');
        const current = deepParse(ws?.setting || {});
        const newSettings = { ...current, ...(input.settings || input) };
        
        const updateData: any = { 
            setting: JSON.stringify(newSettings),
            updatedAt: new Date().toISOString()
        };

        if (newSettings.ai) {
            updateData.ai = JSON.stringify(newSettings.ai);
        }

        await db.update('workspace', user.workspaceId || 'system', updateData);
        return { success: true };
      }
    },
    {
      id: 'switch',
      label: 'Schimbă Workspace',
      handler: async (ctx: any, input: any) => {
        const { db, user } = ctx;
        const targetId = input.id || input.workspaceId;
        if (!targetId) throw new Error("Workspace ID required");

        await db.batch([
            db.prepare("UPDATE contact SET workspaceId = ? WHERE id = ?").bind(targetId, user.id),
            db.prepare("UPDATE user SET workspaceId = ? WHERE id = ?").bind(targetId, user.id)
        ]);
        return { workspaceId: targetId };
      }
    },
    {
      id: 'list-members',
      label: 'Membri Workspace',
      handler: async (ctx: any, input: any) => {
        const { db, user, registry, selectedLang, deepParse } = ctx;
        const targetId = input?.workspaceId || user.workspaceId || 'system';
        
        // Security check
        const isSuper = registry.SYSTEM_ROLE?.[user.role]?.permission?.includes('*');
        const isWsAdmin = registry.SYSTEM_ROLE?.[user.role]?.permission?.includes('workspace:manage') || isSuper;
        
        if (!isWsAdmin && user.workspaceId !== targetId) {
           throw new Error("Access denied to the user list");
        }

        try {
            // Enterprise Level 8: Hybrid User/Contact discovery
            // We search BOTH the 'user' table (Better-Auth identities) and 'contact' table (Business profiles)
            const effectiveWorkspaceId = targetId === 'all' ? undefined : targetId;
            
            // 1. Fetch from 'user' table (D1)
            let authUsers: any[] = [];
            try {
                const whereClause = effectiveWorkspaceId ? "WHERE (workspaceId = ? OR workspaceId IS NULL)" : "WHERE 1=1";
                const params = effectiveWorkspaceId ? [effectiveWorkspaceId] : [];
                authUsers = await db.query(
                    `SELECT id, name, email, image, role, workspaceId, active FROM user ${whereClause} AND (role IS NULL OR role != 'guest') AND (active IS NULL OR active != 0) ORDER BY name ASC LIMIT 1000`,
                    params
                );
            } catch (e) {}

            // 2. Fetch from 'contact' table (D1)
            let contactUsers: any[] = [];
            try {
                const whereClause = effectiveWorkspaceId ? "WHERE workspaceId = ?" : "WHERE 1=1";
                const params = effectiveWorkspaceId ? [effectiveWorkspaceId] : [];
                contactUsers = await db.query(
                    `SELECT id, name, email, role, workspaceId, status as active FROM contact ${whereClause} AND (role IS NULL OR role != 'guest') ORDER BY name ASC LIMIT 1000`,
                    params
                );
            } catch (e) {}

            // 3. Merge Results
            const mergedMap = new Map();
            contactUsers.forEach(u => mergedMap.set(u.email?.toLowerCase(), { ...u, source: 'contact' }));
            authUsers.forEach(u => {
                const email = u.email?.toLowerCase();
                const existing = mergedMap.get(email);
                mergedMap.set(email, {
                    ...(existing || {}),
                    ...u,
                    id: existing?.id || u.id,
                    userId: u.id,
                    source: existing ? 'merged' : 'auth'
                });
            });

            const finalResult = Array.from(mergedMap.values()).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
            return finalResult.map((u: any) => deepParse(u));
        } catch (e: any) {
            throw new Error(`Failed to fetch users: ${e.message}`);
        }
      }
    },
    {
      id: 'rbac',
      label: 'Configurație RBAC',
      handler: async (ctx: any) => {
        const { db, user, registry } = ctx;
        const rolesDef = registry.SYSTEM_ROLE || {};
        
        const rbacConfig = {
            roles: Object.entries(rolesDef).map(([id, cfg]: [string, any]) => ({
                id,
                name: cfg.label || id,
                description: cfg.description || '',
                permission: cfg.permission || []
            })),
            userRoles: (await db.list('contact', { workspaceId: user.workspaceId || 'system' }))
                .map((u: any) => ({ 
                    id: u.id, 
                    role: u.role || 'guest', 
                    email: u.email, 
                    name: u.name 
                }))
        };
        return rbacConfig;
      }
    },
    {
      id: 'user-permission',
      label: 'Permisiuni Utilizator',
      handler: async (ctx: any, input: any) => {
        const { db, user, registry, selectedLang, renderString } = ctx;
        const targetUserId = input.userId;
        if (!targetUserId) throw new Error("User ID required");
        
        let target = await db.get('contact', targetUserId);
        if (!target) {
            const list = await db.list('contact', { userId: targetUserId });
            if (list.length > 0) target = list[0];
        }
        if (!target && targetUserId.includes('@')) {
            const list = await db.list('contact', { email: targetUserId });
            if (list.length > 0) target = list[0];
        }

        if (!target) {
            throw new Error(renderString({
                ro: `Utilizatorul nu a fost găsit (${targetUserId})`,
                en: `User not found (${targetUserId})`
            }, selectedLang));
        }
        
        const workspaceId = input.workspaceId || user.workspaceId || 'system';
        let permissions = target.permission ? (typeof target.permission === 'string' ? JSON.parse(target.permission) : target.permission) : {};
        
        try {
            const wsMember = await db.query("SELECT permission FROM workspace_user WHERE userId = ? AND workspaceId = ? LIMIT 1", [target.id, workspaceId]);
            if (wsMember && wsMember.length > 0 && wsMember[0]?.permission) {
                const wsPerms = typeof wsMember[0].permission === 'string' ? JSON.parse(wsMember[0].permission) : wsMember[0].permission;
                permissions = { ...permissions, ...wsPerms };
            }
        } catch (e: any) {}
        
        return { 
            permission: permissions,
            role: target.role || 'guest'
        };
      }
    },
    {
      id: 'add-member',
      label: 'Adaugă Membru',
      handler: async (ctx: any, input: any) => {
        const { db, user, env, registry, selectedLang, request, url, renderString } = ctx;
        const { workspaceId, email, role, userId } = input;
        
        if (!email) throw new Error("Email address is required");
        
        let targetUser = userId ? await db.get('contact', userId) : null;
        if (!targetUser) {
            const found = await db.list('contact', { email });
            if (found && found.length > 0) targetUser = found[0];
        }

        const workspace = await db.get('workspace', workspaceId || user.workspaceId || 'system');
        const targetWorkspaceId = workspaceId || user.workspaceId || 'system';
        const wsName = workspace?.name || "Studio App";
        const registerTime = new Date().toISOString();
        
        if (targetUser) {
            await db.update('contact', targetUser.id, { 
                workspaceId: targetWorkspaceId,
                role: role || targetUser.role,
                updatedAt: registerTime
            });
            await db.query("UPDATE user SET role = ?, workspaceId = ? WHERE id = ? OR email = ?", [role || targetUser.role, targetWorkspaceId, targetUser.id, targetUser.email]).catch(() => {});
            await db.query("INSERT OR REPLACE INTO workspace_user (id, workspaceId, userId, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)", [
                `wu_${targetUser.id}_${targetWorkspaceId}`, targetWorkspaceId, targetUser.id, role || targetUser.role, registerTime, registerTime
            ]).catch(() => {});
        } else {
            const id = crypto.randomUUID();
            await db.create('contact', {
                id, email, name: email.split('@')[0], role: role || 'guest', workspaceId: targetWorkspaceId, emailVerified: 0, createdAt: registerTime, updatedAt: registerTime
            });
            await db.query("INSERT OR REPLACE INTO workspace_user (id, workspaceId, userId, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)", [
                `wu_${id}_${targetWorkspaceId}`, targetWorkspaceId, id, role || 'guest', registerTime, registerTime
            ]);
        }

        // Email logic
        const inviteEmailAddr = email || targetUser?.email;
        if (inviteEmailAddr) {
            const localAgentUrl = registry?.SYSTEM_SETTING?.local_agent_url || `http://localhost:${env.ENVIRONMENT === 'production' ? '5000' : '4001'}`;
            const fillTemplate = (tpl: string, vars: Record<string, string>) => {
                let res = tpl;
                for (const [k, v] of Object.entries(vars)) res = res.replace(new RegExp(`{{${k}}}`, 'g'), v);
                return res;
            };
            const template = registry?.EMAIL_TEMPLATE?.['workspace_invitation'];
            if (template) {
                const templateVars = { workspaceName: wsName, roleLabel: role || 'Membru', appUrl: url?.origin || '', userName: targetUser?.name || email.split('@')[0] };
                const emailPayload = {
                    to: inviteEmailAddr,
                    subject: fillTemplate(renderString(template.subject, selectedLang), templateVars),
                    body: fillTemplate(renderString(template.body, selectedLang), templateVars),
                    html: fillTemplate(renderString(template.html, selectedLang), templateVars),
                    workspaceId: targetWorkspaceId
                };
                fetch(`${localAgentUrl}/api/modules/mail/action/send`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(emailPayload)
                }).catch(e => console.error("[V3-INVITE] Mail failed:", e.message));
            }
        }
        return { success: true };
      }
    },
    {
      id: 'update-member-perms',
      label: 'Actualizare Permisiuni',
      handler: async (ctx: any, input: any) => {
        const { db, user, env, selectedLang, clearUserPermsCache, renderString } = ctx;
        const { userId, permission, workspaceId } = input;

        if (!userId) throw new Error("User ID required");
        
        let target = await db.get('contact', userId);
        if (!target) {
            const listByAuthId = await db.list('contact', { userId: userId });
            if (listByAuthId.length > 0) target = listByAuthId[0];
        }
        if (!target && String(userId).includes('@')) {
            const list = await db.list('contact', { email: userId });
            if (list.length > 0) target = list[0];
        }
        
        if (!target) throw new Error(renderString({ ro: `Utilizatorul nu a fost găsit (${userId})`, en: `User not found (${userId})` }, selectedLang));

        const finalContactId = target.id;
        const finalAuthUserId = target.userId || target.id;
        const timestamp = new Date().toISOString();
        const permsStr = JSON.stringify(permission || {});
        const targetWorkspaceId = workspaceId || user.workspaceId || 'system';

        await db.update('contact', finalContactId, { permission: permsStr, updatedAt: timestamp });
        
        if (targetWorkspaceId) {
            const existing = await db.query("SELECT id FROM workspace_user WHERE userId = ? AND workspaceId = ?", [finalAuthUserId, targetWorkspaceId]);
            if (existing && existing.length > 0) {
                await db.query("UPDATE workspace_user SET permission = ?, updatedAt = ? WHERE id = ?", [permsStr, timestamp, existing[0].id]);
            } else {
                await db.query("INSERT INTO workspace_user (id, workspaceId, userId, permission, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)", [
                    `wu_${finalAuthUserId}_${targetWorkspaceId}`, targetWorkspaceId, finalAuthUserId, permsStr, timestamp, timestamp
                ]);
            }
        }

        await db.query("UPDATE user SET permission = ?, updatedAt = ? WHERE id = ?", [permsStr, Date.now(), finalAuthUserId]).catch(() => {});
        await clearUserPermsCache(env, finalAuthUserId, targetWorkspaceId).catch(() => {});

        return { success: true };
      }
    },
    {
      id: 'remove-user',
      label: 'Elimină Utilizator',
      handler: async (ctx: any, input: any) => {
        const { db } = ctx;
        const userId = input.userId;
        if (!userId) throw new Error("User ID required");
        await db.update('contact', userId, { workspaceId: null, role: 'guest', updatedAt: Date.now() });
        return { success: true };
      }
    },
    {
      id: 'search-contact',
      label: 'Caută Contact',
      handler: async (ctx: any, input: any) => {
        const { db, user, deepParse } = ctx;
        const query = input.q || "";
        const filters: any = { workspaceId: user.workspaceId || 'system' };
        if (query) {
            const allContacts = await db.list('contact', { workspaceId: user.workspaceId || 'system' });
            const filtered = allContacts.filter((u: any) => 
                (u.email && u.email.toLowerCase().includes(query.toLowerCase())) ||
                (u.name && u.name.toLowerCase().includes(query.toLowerCase()))
            );
            return filtered.map((u: any) => { const c = deepParse(u); delete c.password; return c; });
        }
        const all = await db.list('contact', filters, { limit: 100 });
        return all.map((u: any) => { const c = deepParse(u); delete c.password; return c; });
      }
    },
    {
      id: 'list-all',
      label: 'Listare Workspace-uri',
      handler: async (ctx: any) => {
        const { db, user, registry, deepParse } = ctx;
        const isSuper = registry.SYSTEM_ROLE?.[user.role]?.permission?.includes('*');
        const isAdmin = registry.SYSTEM_ROLE?.[user.role]?.permission?.includes('workspace:manage') || user.role === 'workspace_admin';

        const list = (isSuper) 
            ? await db.list('workspace', { archived: 0 }) 
            : (isAdmin 
            ? await db.query("SELECT * FROM workspace WHERE id = ?", [user.workspaceId || 'system']).then((res: any) => res.filter((w: any) => !w.archived || w.archived == 0)).catch(() => [])
                : [await db.get('workspace', user.workspaceId || 'system')]);
        
        return (Array.isArray(list) ? list : [list]).filter(Boolean).map(deepParse);
      }
    },
    {
      id: 'create',
      label: 'Crează Workspace',
      handler: async (ctx: any, input: any) => {
        const { db, user } = ctx;
        const { name, ownerId } = input;
        if (!name) throw new Error("Workspace name is required");
        const workspaceId = crypto.randomUUID();
        await db.create('workspace', {
            id: workspaceId,
            name,
            ownerId: ownerId || user.id,
            setting: JSON.stringify({}),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return { id: workspaceId, name };
      }
    }
  ],

  menuConfig: {
    showInMainMenu: true,
    category: 'administration',
    icon: 'Briefcase',
    priority: 20
  }
};
