/**
 * AUTH SERVICE - Enterprise Level 10
 * Centralized logic for permissions, cache invalidation and security audits.
 */
import { mergeRegistryWithD1 } from './registry-service.server';
import { isGlobalAdmin, isWorkspaceAdmin } from './auth-utils';
import { safeParse } from './core';

const global = globalThis as any;

/**
 * Enterprise Level 10: State Synchronization (Permission Cache Invalidation)
 */
export async function clearUserPermsCache(env: any, userId: string, workspaceId?: string) {
    if (!env?.KV || !userId) return;
    try {
        const cacheKey = `perms_bundle_${userId}_${workspaceId || 'none'}`;
        await env.KV.delete(cacheKey);
        console.log(`[AUTH-SERVICE] Cleared User Perms KV for: ${userId} in ws:${workspaceId || 'none'}`);
    } catch (e) {
        console.error('[AUTH-SERVICE] User Perms KV Clear Error:', e);
    }
}

/**
 * Enterprise Level 10: Master RBAC Engine (Unified Contextual Access Control)
 */
export async function checkAccess(db: any, user: any, entity: string, action: string, subAction?: string, env?: any) {
    if (!user) return false;

    const effectiveEnv = env || (globalThis as any).LAST_ENV;
    const cacheKey = `perms_bundle_${user.id}_${user.workspaceId || 'none'}`;

    const registry = await mergeRegistryWithD1(db, user.workspaceId || 'system', effectiveEnv);
    
    if (isGlobalAdmin(user, registry)) return true;

    try {
        const uiActionMap: Record<string, string> = {
            'create': 'create', 'add': 'create', 'update': 'update', 'edit': 'update',
            'view': 'read', 'read': 'read', 'delete': 'delete'
        };
        const mappedAction = uiActionMap[action] || action;
        
        const synMap: Record<string, string[]> = {
            'read': ['read', 'view', 'list'],
            'create': ['create', 'add', 'insert'],
            'update': ['update', 'edit', 'save', 'modify'],
            'delete': ['delete', 'remove', 'destroy']
        };
        const potentialActions = synMap[mappedAction] || [mappedAction];

        const isBulk = subAction?.startsWith('bulk-') || subAction === 'import-csv' || subAction === 'import' || subAction === 'import-ai';
        const isAction = action === 'action' && subAction;

        let bundle: any = null;
        if (effectiveEnv?.KV) {
            try {
                bundle = await effectiveEnv.KV.get(cacheKey, 'json');
                if (bundle && bundle.userId !== user.id) bundle = null;
            } catch (kvErr) {
                console.error('[CHECK-ACCESS] KV Perms Read Error:', kvErr);
            }
        }

        if (!bundle) {
            const getContactByAuthId = async (authId: string) => {
                let c = await db.get('contact', authId);
                if (c) return c;
                const list = await db.list('contact', { userId: authId });
                return list[0] || null;
            };

            const [userContact, workspaceMember, workspaceRbacRes] = await Promise.all([
                getContactByAuthId(user.id),
                user.workspaceId ? db.query("SELECT permission FROM workspace_user WHERE userId = ? AND workspaceId = ? LIMIT 1", [user.id, user.workspaceId]).then((res: any) => res[0]).catch(() => null) : Promise.resolve(null),
                user.workspaceId ? db.query("SELECT permission FROM workspace_rbac WHERE workspaceId = ? LIMIT 1", [user.workspaceId]).then((res: any) => res[0]).catch(() => null) : Promise.resolve(null)
            ]);

            bundle = {
                userId: user.id,
                email: user.email,
                permissions: [],
                rbacOverrides: (workspaceRbacRes?.permission ? (typeof workspaceRbacRes.permission === 'string' ? safeParse(workspaceRbacRes.permission, {}) : workspaceRbacRes.permission) : {}),
                createdAt: new Date().toISOString()
            };

            if (userContact?.permission) {
                try { bundle.permissions.push(typeof userContact.permission === 'string' ? JSON.parse(userContact.permission) : userContact.permission); } catch(e) {}
            }
            if (workspaceMember?.permission) {
                try { bundle.permissions.push(typeof workspaceMember.permission === 'string' ? JSON.parse(workspaceMember.permission) : workspaceMember.permission); } catch(e) {}
            }

            if (effectiveEnv?.KV) {
                await effectiveEnv.KV.put(cacheKey, JSON.stringify(bundle), { expirationTtl: 300 }).catch(() => {});
            }
        }

        const combinedRaw = bundle.permissions || [];
        for (const perms of combinedRaw) {
            if (perms[entity] && typeof perms[entity] === 'object') {
                if (isBulk) {
                    if (perms[entity]['bulk'] === true) return true;
                    if (perms[entity]['bulk'] === false) return false;
                }
                if (isAction) {
                    if (perms[entity][`action:${subAction}`] === true) return true;
                    if (perms[entity]['action'] === true) return true;
                }
                if (potentialActions.some(a => perms[entity][a] === true)) return true;
                if (perms[entity][mappedAction] === false) return false; 
            }
            
            if (Array.isArray(perms)) {
                if (isBulk && perms.includes(`${entity}:bulk`)) return true;
                if (isAction && (perms.includes(`${entity}:action:${subAction}`) || perms.includes(`${entity}:action`))) return true;
                
                const hasPerm = potentialActions.some(a => perms.includes(`${entity}:${a}`)) || 
                                perms.includes(`${entity}:*`) || 
                                perms.includes('workspace:manage') ||
                                perms.includes('entity:manage') ||
                                perms.includes('*');

                if (hasPerm) {
                    if (isBulk) return isWorkspaceAdmin(user, registry);
                    return true;
                }
            }
        }

        const roleOverrides = bundle.rbacOverrides ? bundle.rbacOverrides[user.role] : null;
        if (roleOverrides) {
            const specificKey = `${entity}:${mappedAction}`;
            if (roleOverrides[specificKey] === true) return true;
            if (roleOverrides[specificKey] === false) return false;
            if (roleOverrides['*'] === true) return true;
        }

        const entityConfigs = registry.ENTITY_CONFIG || {};
        const entityDef = Object.values(entityConfigs).find((e: any) => e.tableName === entity || e.name === entity) as any;
        if (entityDef?.permission?.role) {
            const rolePerms = entityDef.permission.role[user.role];
            if (rolePerms && typeof rolePerms === 'object' && !Array.isArray(rolePerms)) {
                if (action === 'read' && rolePerms.read) return true;
                if ((action === 'create' || action === 'update') && rolePerms.write) return true;
                if (action === 'delete' && rolePerms.delete) return true;
            }
        }

        const roleDef = (registry.SYSTEM_ROLE || {})[user.role];
        if (!roleDef) return false;

        const rolePerms = roleDef.permission || [];
        const hasAccess = rolePerms.includes('*') || 
                          rolePerms.includes(mappedAction) || 
                          rolePerms.includes(`${entity}:*`) || 
                          (isAction && (rolePerms.includes(`${entity}:action:${subAction}`) || rolePerms.includes(`${entity}:action`))) ||
                          potentialActions.some(a => rolePerms.includes(`${entity}:${a}`)) ||
                          potentialActions.some(a => rolePerms.includes(a));
        
        return hasAccess;
    } catch (e: any) {
        console.error("[AUTH-SERVICE] Access check failure:", e.message);
        return false;
    }
}

/**
 * Enterprise Level 10: Centralized Incident Reporting & Telemetry
 */
export const logSystemError = async (db: any, err: any, request: Request, context: any = {}) => {
    try {
        console.error('[SYSTEM-ERROR-LOGGER]', err);
        const url = new URL(request.url);
        if (url.pathname.includes('/system_error')) return;

        await db.create('system_error', {
            message: err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err)),
            stack: err instanceof Error ? err.stack : undefined,
            path: url.pathname + url.search,
            method: request.method,
            status: context.status || 500,
            userId: context.userId,
            user: context.userName,
            workspaceId: context.workspaceId || 'system',
            context: JSON.stringify({ 
                requestId: context.requestId,
                recoveryLog: context.recoveryLog,
                extra: context.extra
            }),
            client_info: JSON.stringify({
                userAgent: request.headers.get('user-agent'),
                referer: request.headers.get('referer'),
                ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip'),
                country: request.headers.get('cf-ipcountry')
            })
        }).catch((e: any) => console.error('[FATAL-LOGGING-FAILED]', e));
    } catch (e) {
        console.error('[CRITICAL-LOGGER-FAILURE]', e);
    }
};
