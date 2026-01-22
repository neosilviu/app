import { verifyAuth } from './auth-core.server';
import { hasPermission } from './registry';
import { D1Driver } from './d1.server';

/**
 * Auth Middleware
 */
export async function requireAuth(request: Request, env: any) {
    const user = await verifyAuth(request, env);
    if (!user) throw new Response("Unauthorized", { status: 401 });
    return user;
}

export async function getOptionalAuth(request: Request, env: any) {
    return await verifyAuth(request, env);
}

/**
 * RBAC Middleware
 */
export async function checkPermission(
    db: D1Driver,
    userId: string,
    requiredPermission: string,
    workspaceId?: string
): Promise<{ allowed: boolean; error?: string; role?: string }> {
    try {
        const user = await db.get('contact', userId);
        if (user && user.role === 'superadmin') return { allowed: true, role: 'superadmin' };
        if (!workspaceId) return { allowed: false, error: 'Workspace ID required' };
        const workspaceUsers = await db.list('workspace_users', { userId, workspaceId });
        if (!workspaceUsers || workspaceUsers.length === 0) return { allowed: false, error: 'User not in workspace' };
        const role = workspaceUsers[0].role;
        if (hasPermission(role, requiredPermission)) return { allowed: true, role };
        return { allowed: false, error: 'Insufficient permissions' };
    } catch (e: any) { return { allowed: false, error: 'Internal RBAC error' }; }
}

/**
 * Validation Middleware
 */
export function validateBody(body: any, schema: Record<string, string>) {
    const errors: Record<string, string> = {};
    for (const [field, type] of Object.entries(schema)) {
        const value = body[field];
        if (type.includes('required') && (value === undefined || value === null || value === '')) { 
            errors[field] = `${field} is required`; continue; 
        }
        if (value !== undefined && value !== null) {
            if (type.includes('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field] = `${field} must be a valid email`;
            if (type.includes('number') && isNaN(Number(value))) errors[field] = `${field} must be a number`;
        }
    }
    return { isValid: Object.keys(errors).length === 0, errors };
}

