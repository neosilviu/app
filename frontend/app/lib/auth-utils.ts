/**
 * AUTH UTILITIES - Shared between Server (Brain) and Client (UI)
 */

export const isGlobalAdmin = (user: any, registry: any) => {
    if (!user) return false;
    const roles = registry?.SYSTEM_ROLE || {};
    const roleDef = roles[user.role];
    return roleDef?.permission?.includes('*') || user.role === 'superadmin';
};

export const hasPermission = (user: any, permission: string, registry: any) => {
    if (!user) return false;
    if (isGlobalAdmin(user, registry)) return true;
    const roles = registry?.SYSTEM_ROLE || {};
    const roleDef = roles[user.role];
    return roleDef?.permission?.includes(permission);
};

export const hasPageAccess = (user: any, pageId: string, registry: any) => {
    if (!user) return false;
    const roles = registry?.SYSTEM_ROLE || {};
    const roleDef = roles[user.role];
    if (!roleDef) return false;
    if (roleDef.allowedPage?.includes('*')) return true;
    // Support group matching like 'entity:*' or 'worker:*'
    if (pageId.includes(':')) {
        const [group] = pageId.split(':');
        if (roleDef.allowedPage?.includes(`${group}:*`)) return true;
    }
    return roleDef.allowedPage?.includes(pageId);
};

export const isWorkspaceAdmin = (user: any, registry: any) => {
    return hasPermission(user, 'workspace:manage', registry) || 
           hasPermission(user, 'workspace:members:manage', registry);
};

/**
 * UNIFIED ASYNC PERMISSION ENGINE (Enterprise Level 8)
 * 
 * Single source of truth for ALL permission checks - replaces scattered hasPermission()
 * calls across the codebase.
 * 
 * Priority Hierarchy:
 * 1. Global Admin (superadmin role) → ALWAYS allowed
 * 2. Granular User-Level Permissions (contact + workspace_user) → Entity-specific overrides
 * 3. Entity-Specific Config (ENTITY_CONFIG.permission.role) → Builder-defined rules
 * 4. Global Role Permissions (SYSTEM_ROLE.permission) → Fallback
 * 
 * Action Mapping: UI (add|edit|view|delete) ↔ Backend (create|update|view|delete)
 */
export async function checkAccessAsync(
    db: any, 
    user: any, 
    entity: string, 
    action: string,
    registry: any
): Promise<boolean> {
    if (!user) return false;
    if (isGlobalAdmin(user, registry)) return true;

    try {
        // UI Action Mapping
        const uiActionMap: Record<string, string> = {
            'create': 'add',
            'update': 'edit',
            'view': 'view',
            'delete': 'delete'
        };
        const mappedAction = uiActionMap[action] || action;

        // 1. Check Granular User-Level Permissions
        // Merge global (contact.permission) + workspace-specific (workspace_user.permission)
        const [userContact, workspaceMember] = await Promise.all([
            db.get('contact', user.id).catch(() => null),
            user.workspaceId 
                ? db.query("SELECT permission FROM workspace_user WHERE userId = ? AND workspaceId = ? LIMIT 1", [user.id, user.workspaceId])
                    .then((res: any) => res?.[0])
                    .catch(() => null)
                : Promise.resolve(null)
        ]);

        const combinedRaw = [];
        if (userContact?.permission) combinedRaw.push(userContact.permission);
        if (workspaceMember?.permission) combinedRaw.push(workspaceMember.permission);

        for (const raw of combinedRaw) {
            try {
                const perms = typeof raw === 'string' ? JSON.parse(raw) : raw;
                
                // Case 1: Granular Entity Object { "lead": { "view": true, "add": false } }
                if (perms[entity] && typeof perms[entity] === 'object') {
                    if (perms[entity][mappedAction] === true) return true;
                }
                
                // Case 2: Array of permission strings ["contact:view", "contact:edit"]
                if (Array.isArray(perms)) {
                    if (perms.includes(`${entity}:${mappedAction}`) || perms.includes(`${entity}:*`) || perms.includes('*')) return true;
                }
            } catch (e) {
                console.warn("[PERMISSION-ENGINE] Failed to parse user permissions", e);
            }
        }

        // 2. Check Entity-Specific Config (Builder)
        const entityConfigs = registry.ENTITY_CONFIG || {};
        const entityDef = Object.values(entityConfigs).find((e: any) => e.tableName === entity || e.name === entity) as any;
        
        if (entityDef?.permission?.role) {
            const rolePerms = entityDef.permission.role[user.role];
            if (rolePerms && typeof rolePerms === 'object' && !Array.isArray(rolePerms)) {
                if (action === 'view' && rolePerms.read) return true;
                if ((action === 'create' || action === 'update') && rolePerms.write) return true;
                if (action === 'delete' && rolePerms.delete) return true;
            }
        }

        // 3. Fallback to Global Role Permissions
        const roleDef = (registry.SYSTEM_ROLE || {})[user.role];
        if (!roleDef) return false;

        const rolePerms = roleDef.permission || [];
        const hasAccess = rolePerms.includes('*') || 
                         rolePerms.includes(action) || 
                         rolePerms.includes(`${entity}:*`) || 
                         rolePerms.includes(`${entity}:${action}`);
        
        if (!hasAccess) {
            console.warn(`[PERMISSION-ENGINE] Denied: user=${user.email} role=${user.role} entity=${entity} action=${action}`);
        }
        
        return hasAccess;
    } catch (e: any) {
        console.error("[PERMISSION-ENGINE-ERROR]", e.message);
        return false;
    }
}
