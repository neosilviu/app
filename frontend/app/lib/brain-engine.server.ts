
import { getDb, clearColumnCache } from './d1.server';
import { getAuth, verifyAuth } from "./auth-core.server";
import { AiService } from './ai.server';
import { getRegistry, resolveCollection, getPrimaryKey } from './registry-lite';
import { normalizeEntity, safeParse, getDisplayValue } from './entity-engine';
import { renderString } from './utils';
import { isGlobalAdmin, hasPermission, hasPageAccess, isWorkspaceAdmin, checkAccessAsync } from './auth-utils';
import { ensureSystemTables, waitForDbReady, syncEntityTable } from './db-init.server';

/**
 * BRAIN-ENGINE - Enterprise Level 8 Metaprogramming Dispatcher
 */

const json = (payload: any, status = 200) => Response.json(payload, { 
    status, 
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } 
});
const success = (data: any = true) => json({ success: true, data });
const error = (msg: string | Record<string, string>, status = 400, selectedLang = 'ro') => {
    let errorMsg = msg;
    if (typeof msg === 'object') errorMsg = msg[selectedLang] || msg.en || msg.ro || JSON.stringify(msg);
    return json({ success: false, error: String(errorMsg) }, status);
};

const deepParse = (obj: any): any => {
    if (typeof obj === 'string' && (obj.startsWith('{') || obj.startsWith('['))) {
        try { return deepParse(JSON.parse(obj)); } catch { return obj; }
    }
    if (!obj || typeof obj !== 'object') return obj;
    const result = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const key in result) result[key] = deepParse(result[key]);
    return result;
};

const deepStringify = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    const result: any = Array.isArray(obj) ? [] : {};
    for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            try { result[k] = JSON.stringify(v); } catch { result[k] = v; }
        } else result[k] = v;
    }
    return result;
};

const isGlobalEntity = (name: string, registry: any) => {
    const normalizedName = (name || '').toLowerCase();
    // Level 8: Hardcoded safety for core system tables to prevent SQL errors (no-such-column: workspaceId)
    if (['workspace', 'user', 'role', 'entity_definition', 'system_setting', 'audit_log', '_ai_prompt', 'tag', 'verification', 'session', 'account'].includes(normalizedName)) {
        return true;
    }
    const list = registry?.CONSTANT?.globalEntity || [];
    return list.map((e: string) => e.toLowerCase()).includes(normalizedName);
};

/**
 * THE UNIVERSAL ENTITY DISPATCHER
 * Handles CRUD, Search, Stats, Workflow and AI extraction for ANY entity defined in Registry.
 */
export async function executeEntityAction(ctx: any) {
    const { db, user, method, body, url, parts, op, registry, selectedLang, env, resource } = ctx;
    
    // 1. Resolve Path Segmenting (Enterprise Level 8)
    const rawParts = parts || [];
    let collection = (resource === 'db' 
        ? (rawParts[1] === 'collection' ? rawParts[2] : (rawParts[1] || '')) 
        : (resource || rawParts[0] || 'unknown')).toLowerCase();
    
    // Safety: If resource is 'db' but no collection provided, or if collection resolved to 'db'
    if (resource === 'db' && (!collection || collection === 'db')) {
        return error("Missing collection name", 400, selectedLang);
    }
    
    console.log(`[BRAIN-ENGINE] [${method}] resource="${resource}" collection="${collection}" op="${op}" parts=[${rawParts.join(',')}]`);

    if (collection.startsWith('ws_') && collection.includes('_')) {
        collection = collection.split('_').slice(2).join('_'); 
    }

    let id: string | undefined;
    let subAction: string | undefined;

    const segmentIdx = parts.indexOf(collection);
    if (segmentIdx !== -1) {
        let next = parts[segmentIdx + 1];
        if (next === 'item') {
            id = parts[segmentIdx + 2];
            subAction = parts[segmentIdx + 3];
        } else {
            id = next;
            subAction = parts[segmentIdx + 2];
        }
    }

    if (id === 'all' || id === 'list' || id === 'all?' || !id) id = undefined;

    const entityConfigs = registry.ENTITY_CONFIG || {};
    const entityDef = Object.values(entityConfigs).find((e: any) => e.tableName === collection || e.name === collection) as any;
    
    // 2. Security & RBAC
    const isSuper = isGlobalAdmin(user, registry);
    const isGlobal = isGlobalEntity(collection, registry);
    const actionMap: any = { 'GET': 'view', 'POST': 'create', 'PUT': 'update', 'PATCH': 'update', 'DELETE': 'delete' };
    const requiredAction = subAction || actionMap[method] || 'view';

    if (!(await checkAccessAsync(db, user, collection, requiredAction, registry))) {
        return error(`Acces refuzat: ${requiredAction} pe ${collection}`, 403, selectedLang);
    }

    const effectiveWorkspaceId = url.searchParams.get("workspaceId") || body.workspaceId || user.workspaceId;

    // 3. Dispatch Logic
    try {
        // --- BATCH OPS ---
        if (method === 'POST' && (subAction === 'batch' || collection === 'batch' || Array.isArray(body.operations))) {
            const items = body.operations || body.items || (Array.isArray(body) ? body : []);
            const results: string[] = [];
            for (const item of items) {
                const target = item.collection || collection;
                const data = { ...deepStringify(item.data || item), workspaceId: isGlobalEntity(target, registry) ? 'system' : effectiveWorkspaceId, createdBy: user.id };
                const pk = getPrimaryKey(target);
                if (!data[pk]) data[pk] = crypto.randomUUID();
                await db.create(target, data);
                results.push(data[pk]);
            }
            return success({ count: results.length, ids: results });
        }

        // --- SEARCH ---
        if (method === 'GET' && (subAction === 'search' || url.searchParams.has('query'))) {
            const query = url.searchParams.get('query') || '';
            const searchFields = entityDef?.searchFields || [entityDef?.displayField || 'name'];
            const searchClause = searchFields.map((f: string) => `"${f}" LIKE ?`).join(' OR ');
            let sql = `SELECT * FROM "${resolveCollection(collection)}" WHERE (${searchClause})`;
            const params: any[] = searchFields.map(() => `%${query}%`);

            if (!isGlobal) {
                sql += ` AND (workspaceId = ? OR workspaceId = 'system')`;
                params.push(effectiveWorkspaceId);
            }
            if (entityDef?.features?.softDelete) sql += ` AND deletedAt IS NULL`;
            
            sql += ` LIMIT 100`;
            const results = await db.query(sql, params);
            return success(results.map(deepParse));
        }

        // --- READ ---
        if (method === 'GET') {
            if (id) {
                const item = await db.get(collection, id);
                if (!item) return error("NotFound", 404);
                if (!isSuper && !isGlobal && item.workspaceId !== user.workspaceId && item.workspaceId !== 'system') return error("Forbidden", 403);
                return success(deepParse(item));
            }
            
            const filters: any = isGlobal ? {} : { workspaceId: effectiveWorkspaceId };
            if (entityDef?.features?.softDelete) filters.deletedAt = null;
            
            url.searchParams.forEach((v: string, k: string) => { 
                if (!['pageSize', 'page', 'sortBy', 'sortOrder', 'limit', 'offset', 'workspaceId'].includes(k)) filters[k] = v; 
            });

            const results = await db.list(collection, filters, {
                sortBy: url.searchParams.get("sortBy") || "createdAt",
                sortOrder: url.searchParams.get("sortOrder") || "DESC",
                limit: parseInt(url.searchParams.get("limit") || "100"),
                offset: parseInt(url.searchParams.get("offset") || "0")
            });
            return success(results.map(deepParse));
        }

        // --- WRITE ---
        if (method === 'POST') {
            const data = { 
                ...deepStringify(body), 
                id: body.id || crypto.randomUUID(),
                workspaceId: isGlobal ? 'system' : effectiveWorkspaceId,
                createdBy: user.id,
                createdAt: new Date().toISOString()
            };
            await db.create(collection, data);
            return success(deepParse(data));
        }

        if (['PUT', 'PATCH'].includes(method) && id) {
            const updates = { ...deepStringify(body), updatedAt: new Date().toISOString(), updatedBy: user.id };
            if (!isSuper) delete updates.workspaceId;
            await db.update(collection, id, updates);
            return success(deepParse({ id, ...updates }));
        }

        if (method === 'DELETE' && id) {
            await db.delete(collection, id);
            return success({ id, deleted: true });
        }

    } catch (e: any) {
        console.error(`[ENGINE-ERROR] ${collection}:`, e.message);
        return error(`Engine Error: ${e.message}`, 500);
    }

    return error("Method Not Allowed", 405);
}
