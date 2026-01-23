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
