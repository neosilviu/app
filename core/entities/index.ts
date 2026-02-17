import { z } from 'zod';

/**
 * V3 ENTITY REGISTRY - Automated Level 10 (Registry-Less Discovery)
 */

export var AVAILABLE_V3_ENTITIES: Record<string, any> = {};

let discoveryPromise: Promise<void> | null = null;

// Enterprise Level 10 - On-Demand Entity Discovery
export async function discoverEntities() {
    if (discoveryPromise) return discoveryPromise;

    // Fast-Path (Synchronous): If eager glob is available, populate it immediately
    // so that getV3EntitiesAsLegacy() works even if called right after module load.
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && (import.meta as any).glob) {
            // @ts-ignore
            const globResult = (import.meta as any).glob([
                './*.ts', 
                '!./*.test.ts', 
                '!./*.spec.ts',
                '!./index.ts'
            ], { eager: true });
            if (globResult && Object.keys(globResult).length > 0) {
                Object.entries(globResult).forEach(([pathStr, module]: [string, any]) => {
                    processModule(pathStr, module);
                });
            }
        }
    } catch (e) { /* Browser/Vite context */ }

    discoveryPromise = (async () => {
        // Node.js Discovery - Hidden from static analysis to prevent browser bundle warnings
        if (Object.keys(AVAILABLE_V3_ENTITIES).length === 0 && typeof process !== 'undefined' && process.versions?.node) {

            try {
                // Use indirect imports to prevent bundlers like Vite/esbuild from following these
                // when scanning files for the frontend bundle.
                const nodePath = 'path';
                const nodeFs = 'fs';
                const path = await import(/* @vite-ignore */ nodePath);
                const fs = await import(/* @vite-ignore */ nodeFs);
                
                const pathDefault = path.default || path;
                const fsDefault = fs.default || fs;

                // @ts-ignore
                let dir = pathDefault.dirname(new URL(import.meta.url).pathname);
                if (dir.startsWith('/') && process.platform === 'win32') dir = dir.substring(1);
                const normalizedDir = pathDefault.resolve(dir);
                const scanPaths = [normalizedDir];

                for (const targetDir of scanPaths) {
                    if (!fsDefault.existsSync(targetDir)) continue;
                    const files = fsDefault.readdirSync(targetDir);
                    for (const file of files) {
                        if (file === 'index.ts' || file === 'index.js' || (!file.endsWith('.ts') && !file.endsWith('.js'))) continue;
                        if (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) continue;

                        const fullPath = pathDefault.join(targetDir, file);
                        try {
                            const fileUrl = pathDefault.isAbsolute(fullPath) ? `file://${fullPath.replace(/\\/g, '/')}` : `./${file}`;
                            const module = await import(/* @vite-ignore */ fileUrl);
                            processModule(file, module);
                        } catch (e) {
                            // Silently fail if import fails
                        }
                    }
                }
            } catch (e) { 
                // Silently fail if Node modules are not available
            }
        }
    })();

    return discoveryPromise;
}


// TURBO MODE: Defer entity discovery to first use, not module load
// This prevents blocking server startup
let discoveryScheduled = false;
const scheduleDiscovery = () => {
    if (discoveryScheduled) return;
    discoveryScheduled = true;
    // Non-blocking: schedule discovery async without awaiting
        setTimeout(() => {
        discoverEntities().catch(() => {});
    });
};

function processModule(pathStr: string, module: any) {
    if (pathStr.endsWith('index.ts') || pathStr.includes('.test.')) return;
    const parts = pathStr.split(/[\\/]/);
    const lastPart = parts[parts.length - 1];
    if (!lastPart) return;
    const name = lastPart.replace('.ts', '');
    const entity = module[name] || module.default || Object.values(module)[0];
    if (entity && typeof entity === 'object' && (entity.id || entity.tableName)) {
        AVAILABLE_V3_ENTITIES[entity.id || name] = entity;
    }
}

export function getActiveV3Entities(activeIds?: string[]) {
  // Ensure discovery is scheduled if not started
  scheduleDiscovery();
  
  // We don't await here to keep it sync for legacy compatibility, 
  // but we assume discovery is running or finished
  const ids = activeIds || Object.keys(AVAILABLE_V3_ENTITIES);
  const active: Record<string, any> = {};
  ids.forEach(id => {
    if (AVAILABLE_V3_ENTITIES[id]) {
      active[id] = AVAILABLE_V3_ENTITIES[id];
    }
  });
  return active;
}

/**
 * Helper: Extract metadata from Zod Schema
 */
function extractZodMetadata(schema: any) {
    const fields: Record<string, any> = {};
    const shape = schema?.shape || schema;
    if (!shape) return fields;

    Object.entries(shape).forEach(([key, zodField]: [string, any]) => {
        let currentField = zodField;
        
        // Unwrap ZodDefault, ZodOptional, ZodNullable
        while (currentField._def && (
            currentField._def.typeName === 'ZodOptional' || 
            currentField._def.typeName === 'ZodDefault' || 
            currentField._def.typeName === 'ZodNullable'
        )) {
            currentField = currentField._def.innerType || currentField._def.wrappedType;
        }

        const description = zodField._def?.description || currentField._def?.description || '';
        const metadata: any = { name: key };
        
        const typeName = currentField._def?.typeName;
        if (typeName === 'ZodString') metadata.type = 'string';
        else if (typeName === 'ZodNumber') metadata.type = 'number';
        else if (typeName === 'ZodBoolean') metadata.type = 'boolean';
        else if (typeName === 'ZodDate') metadata.type = 'datetime';
        else if (typeName === 'ZodEnum') metadata.type = 'enum';
        else if (typeName === 'ZodArray' || typeName === 'ZodObject') metadata.type = 'json';
        else metadata.type = 'string';

        if (description) {
            description.split(';').forEach((pair: string) => {
                const eqIndex = pair.indexOf('=');
                if (eqIndex === -1) return;
                const k = pair.substring(0, eqIndex).trim().replace('ui:', '');
                const v = pair.substring(eqIndex + 1).trim();
                try { metadata[k] = (v.startsWith('{') || v.startsWith('[')) ? JSON.parse(v) : (v === 'true' ? true : (v === 'false' ? false : v)); }
                catch { metadata[k] = v; }
            });
        }
        fields[key] = metadata;
    });
    return fields;
}

export function getV3EntitiesAsLegacy(marketplaceTemplates: any[] = []) {
  // Ensure discovery is scheduled if not started
  scheduleDiscovery();
  
  const legacy: Record<string, any> = {};
  
  Object.values(AVAILABLE_V3_ENTITIES).forEach((ent: any) => {
    const id = ent.id || ent.tableName;
    if (!id || legacy[id]) return;

    legacy[id] = {
      ...ent,
      fields: extractZodMetadata(ent.schema || ent.fields),
      v3: true
    };
  });

  marketplaceTemplates.forEach(template => {
    if (template.extensions) {
      Object.entries(template.extensions).forEach(([targetId, ext]: [string, any]) => {
        const target = legacy[targetId];
        if (!target) return;
        
        if (ext.schema) {
            target.fields = { ...target.fields, ...extractZodMetadata(ext.schema) };
            if (target.schema && typeof target.schema.extend === 'function') {
                target.schema = target.schema.extend(ext.schema);
            }
        }
        if (ext.flowRules) target.flowRules = { ...(target.flowRules || {}), ...ext.flowRules };
        if (ext.actions) target.actions = [...(target.actions || []), ...ext.actions];
        if (ext.menuConfig) target.menuConfig = { ...(target.menuConfig || {}), ...ext.menuConfig };
      });
    }
  });

  return legacy;
}

export function getV3Navigation() {
  // Ensure discovery is scheduled if not started
  scheduleDiscovery();
  
  const items: any[] = [];
  const seen = new Set();
  
  Object.values(AVAILABLE_V3_ENTITIES).forEach((ent: any) => {
    const id = ent.id || ent.tableName;
    if (!id || seen.has(id)) return;
    seen.add(id);

    const config = ent.menuConfig || {};
    // By default, if showInMainMenu is not explicitly false, we show it
    if (config.showInMainMenu !== false) {
      items.push({
        id: id,
        label: config.label || ent.labelRaw || ent.label, // Use bilingual label if available
        icon: config.icon || ent.icon,
        path: `/${id}`,
        category: config.category || 'main_menu',
        priority: config.priority || 50,
        isSystem: ent.isSystem || false,
        badge: config.badge,
      });
    }
  });
  return items.sort((a, b) => (a.priority || 0) - (b.priority || 0));
}
