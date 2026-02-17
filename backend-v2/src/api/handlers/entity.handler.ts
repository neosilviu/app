import { Router } from 'express';
import { RegistryManager } from '../../core/registry';
import { DatabaseDriver } from '../../db/driver';
import { AuditService } from '../../core/audit';

const router = Router();
const db = DatabaseDriver.getInstance();
const audit = new AuditService();

/**
 * TRANSLATION TRANSFORMER - Enterprise Level 10
 * Converts multilingual fields (e.g. { ro: "...", en: "..." }) to a single value
 * based on the requested language, recursively through the entire response tree.
 */
const transformTranslations = (obj: any, lang: string = 'ro', registry?: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Handle arrays recursively
    if (Array.isArray(obj)) {
        return obj.map(item => transformTranslations(item, lang, registry));
    }

    // Enterprise Level 10: Dynamic Multilingual Detection from Registry
    const keys = Object.keys(obj);
    const supportedLangs = registry?.I18N_CONFIG?.supportedLanguages || { ro: {}, en: {} };
    const validLangs = Object.keys(supportedLangs);
    
    // Level 10: Robust Detection - Must have at least one valid language key and all keys must be 2-letter codes
    const hasValidLang = validLangs.some(l => keys.includes(l));
    const isMultilingual = keys.length > 0 && hasValidLang && keys.every(k => validLangs.includes(k) || k.length === 2);
    
    if (isMultilingual) {
        // Return based on priority: exact match -> default -> fallback -> first available
        const defaultLang = registry?.I18N_CONFIG?.defaultLanguage || 'ro';
        const fallbackLang = registry?.I18N_CONFIG?.fallbackLanguage || 'en';
        return obj[lang] ?? obj[defaultLang] ?? obj[fallbackLang] ?? obj[keys[0]] ?? '';
    }

    // Regular object: recurse into values
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = transformTranslations(value, lang, registry);
    }
    return result;
};

/**
 * ENTITY POPULATOR - Enterprise Level 10
 * Resolves many-to-many relations (Modular V3 entity_relation_many) for a list of records.
 * Now supports 'dependencies' whitelist for direct relations.
 */
const populateRelations = async (name: string, rows: any[], registry: any) => {
    if (!rows || rows.length === 0) return rows;
    
    const entityConfigs = registry.ENTITY_CONFIG || registry.entity || {};
    const entityDef = entityConfigs[name];
    if (!entityDef || !entityDef.fields) return rows;
    
    const dependencies = Array.isArray(entityDef.dependencies) ? entityDef.dependencies : [];
    
    // Filter fields that need population
    const fieldsToPopulate = Object.entries(entityDef.fields).filter(([fieldName, f]: any) => {
        const fd = f as any;
        const target = (fd.relation?.target || fd.relationEntity || '').toLowerCase();
        // Many relations OR Direct relations that are in the dependency whitelist
        return fd.type === 'relation-many' || fd.type === 'tag' || 
               ((fd.type === 'relation' || fd.type === 'entity_relation') && 
                dependencies.map((d: string) => d.toLowerCase()).includes(target));
    });

    if (fieldsToPopulate.length === 0) return rows;
    
    const recordIds = rows.map(r => r.id).filter(Boolean);
    if (recordIds.length === 0) return rows;

    for (const [fieldName, fieldDef] of fieldsToPopulate) {
        try {
            const def = fieldDef as any;
            const targetType = (def.relation?.target || def.relationEntity || 'tag').toLowerCase();
            const isMany = def.type === 'relation-many' || def.type === 'tag' || def.type === 'multi-select';

            if (isMany) {
                // Enterprise Level 10: Unified V3 Many-to-Many Bridge
                const assignments: any[] = [];
                const CHUNK_SIZE = 80;
                for (let i = 0; i < recordIds.length; i += CHUNK_SIZE) {
                    const chunk = recordIds.slice(i, i + CHUNK_SIZE);
                    const chunkPlaceholder = chunk.map(() => '?').join(',');
                    // Note: In V3 we use sourceId/sourceType and targetId/targetType
                    const chunkAssignments = await db.query(`
                        SELECT sourceId, targetId FROM entity_relation_many 
                        WHERE sourceType = ? AND sourceId IN (${chunkPlaceholder})
                        AND (fieldName = ? OR fieldName IS NULL)
                    `, [name, ...chunk, fieldName]);
                    assignments.push(...chunkAssignments);
                }
                
                // Also check if the column itself contains IDs (JSON/CSV) as a fallback
                const columnIds: string[] = [];
                for (const row of rows) {
                    const val = row[fieldName];
                    if (typeof val === 'string' && val) {
                        const ids = val.split(/[,;|]/).map((s: string) => s.trim().replace(/[\\"[\]]/g, '')).filter(Boolean);
                        columnIds.push(...ids);
                    } else if (Array.isArray(val)) {
                        val.forEach(v => { if (typeof v === 'string') columnIds.push(v); });
                    }
                }

                const allRelatedIds = [...new Set([...assignments.map((a: any) => a.targetId), ...columnIds])].filter(Boolean);

                if (allRelatedIds.length > 0) {
                    const relatedObjects: any[] = [];
                    for (let i = 0; i < allRelatedIds.length; i += CHUNK_SIZE) {
                        const chunk = allRelatedIds.slice(i, i + CHUNK_SIZE);
                        const chunkPlaceholder = chunk.map(() => '?').join(',');
                        const chunkResults = await db.query(`SELECT * FROM "${targetType}" WHERE id IN (${chunkPlaceholder})`, chunk);
                        relatedObjects.push(...chunkResults);
                    }
                    const objectMap = new Map(relatedObjects.map((obj: any) => [obj.id, obj]));

                    for (const row of rows) {
                        const combinedIds = new Set<string>();
                        assignments.filter((a: any) => a.sourceId === row.id).forEach((a: any) => combinedIds.add(a.targetId));
                        
                        const val = row[fieldName];
                        if (typeof val === 'string' && val) {
                            const ids = val.split(/[,;|]/).map((s: string) => s.trim().replace(/[\\"[\]]/g, '')).filter(Boolean);
                            ids.forEach((id: string) => combinedIds.add(id));
                        } else if (Array.isArray(val)) {
                            val.forEach(v => { if (typeof v === 'string') combinedIds.add(v); });
                        }

                        row[fieldName] = Array.from(combinedIds).map(id => objectMap.get(id) || { id });
                    }
                } else {
                    for (const row of rows) row[fieldName] = [];
                }
            } else {
                // Direct Relation Population (Enterprise Level 10 Optimized)
                const allRelatedIds = [...new Set(rows.map(r => r[fieldName]))].filter(Boolean);
                if (allRelatedIds.length > 0) {
                    const relatedObjects: any[] = [];
                    const CHUNK_SIZE = 80;
                    for (let i = 0; i < allRelatedIds.length; i += CHUNK_SIZE) {
                        const chunk = allRelatedIds.slice(i, i + CHUNK_SIZE);
                        const chunkPlaceholder = chunk.map(() => '?').join(',');
                        const chunkResults = await db.query(`SELECT * FROM "${targetType}" WHERE id IN (${chunkPlaceholder})`, chunk);
                        relatedObjects.push(...chunkResults);
                    }
                    const objectMap = new Map(relatedObjects.map((obj: any) => [obj.id, obj]));

                    for (const row of rows) {
                        const id = row[fieldName];
                        if (id) row[fieldName] = objectMap.get(id) || { id };
                    }
                }
            }
        } catch (e: any) {
            console.warn(`[V2-POPULATE-ERR] Field ${fieldName} on ${name}: ${e.message}`);
        }
    }
    return rows;
};

/**
 * RECURSIVE DEPENDENCY CHECK - Enterprise Level 10
 * Scans the database to find if an entity is a dependency for others.
 */
const getEntityDependencies = async (name: string, id: string, registry: any) => {
    const dependencies: any[] = [];
    const entityConfigs = registry.entity || registry.ENTITY_CONFIG || {};
    const targetEntity = name.toLowerCase();

    for (const [otherEntity, config] of Object.entries(entityConfigs)) {
        const cfg = config as any;
        const tableName = cfg.tableName || otherEntity;
        const fields = cfg.fields || {};

        let found = false;
        for (const [fieldName, fieldDef] of Object.entries(fields)) {
            const fd = fieldDef as any;
            const linkTarget = (fd.relation?.target || fd.relationEntity || '').toLowerCase();

            if (linkTarget === targetEntity) {
                if (fd.type === 'relation' || fd.type === 'entity_relation') {
                    const res = await db.query(`SELECT COUNT(*) as count FROM ${tableName} WHERE ${fieldName} = ?`, [id]).catch(() => []);
                    const count = res[0]?.count || 0;
                    if (count > 0) {
                        dependencies.push({ entity: otherEntity, label: cfg.label?.ro || otherEntity, count });
                        found = true;
                        break;
                    }
                } else if (fd.type === 'relation-many' || fd.type === 'tag') {
                    // Enterprise Level 10: Check unified relation bridge
                    const res = await db.query(`
                        SELECT COUNT(*) as count FROM entity_relation_many 
                        WHERE targetId = ? AND targetType = ? AND sourceType = ?
                        AND (fieldName = ? OR fieldName IS NULL)
                    `, [id, targetEntity, otherEntity, fieldName]).catch(() => []);
                    
                    const count = res[0]?.count || 0;
                    if (count > 0) {
                        dependencies.push({ entity: otherEntity, label: cfg.label?.ro || otherEntity, count });
                        found = true;
                        break;
                    }
                }
            }
        }
    }
    return dependencies;
};

// Validation middleware could be added here

router.get('/', async (req, res) => {
  try {
    // List all entities defined in registry
    const registry = RegistryManager.getInstance().get();
    const entityList = Object.keys(registry.entity || {}).map(key => ({
      name: key,
      ...registry.entity[key]
    }));
    res.json({ success: true, data: entityList });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:name', async (req, res) => {
  const { name } = req.params;
  const registry = RegistryManager.getInstance().get();
  
  // Enterprise Level 10: Mapping alias 'me/self' to current user context
  // Note: Backend might need specific Auth middleware to inject req.user
  let resolvedId = req.query.id as string;
  if (resolvedId === 'me' || resolvedId === 'self') {
      // @ts-ignore
      resolvedId = req.user?.id || 'guest';
  }

  if (!registry.entity?.[name]) {
    return res.status(404).json({ success: false, error: 'Entity not found in registry' });
  }

  try {
    // Fetch data for this entity
    // Supports filtering via query params ?email=...
    let sql = `SELECT * FROM "${name}"`;
    const params: any[] = [];
    
    // Simple filter Implementation
    const filters = Object.keys(req.query).filter(k => k !== 'lang' && k !== 'populate' && k !== 'id');
    if (filters.length > 0) {
      const clauses = filters.map(key => `"${key}" = ?`).join(' AND ');
      sql += ` WHERE ${clauses}`;
      filters.forEach(key => params.push(req.query[key]));
    }
    
    // Limit/Offset
    sql += ` LIMIT 100`;

    const rows = await db.query(sql, params);
    
    // Level 10: Populate and Flatten
    const populated = await populateRelations(name, rows, registry);
    const flattened = transformTranslations(populated, (req.query.lang as string) || 'ro', registry);
    
    res.json({ success: true, count: rows.length, data: flattened });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:name/:id', async (req, res) => {
  const { name } = req.params;
  let id = req.params.id;
  const registry = RegistryManager.getInstance().get();

  // Enterprise Level 10: Mapping alias 'me/self'
  if (id === 'me' || id === 'self') {
      // @ts-ignore
      id = req.user?.id || 'guest';
  }

  if (!registry.entity?.[name]) {
    return res.status(404).json({ success: false, error: 'Entity not found in registry' });
  }

  try {
    const row = await db.get(`SELECT * FROM "${name}" WHERE id = ?`, [id]);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    
    // Level 10: Populate and Flatten
    const populated = await populateRelations(name, [row], registry);
    const flattened = transformTranslations(populated[0], (req.query.lang as string) || 'ro', registry);
    
    res.json({ success: true, data: flattened });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:name', async (req, res) => {
  const { name } = req.params;
  const data = req.body;
  const registry = RegistryManager.getInstance().get();

  if (!registry.entity?.[name]) {
    return res.status(404).json({ success: false, error: 'Entity definition not found' });
  }

  try {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO "${name}" (${fields.map(f => `"${f}"`).join(', ')}) VALUES (${placeholders})`;
    
    const result = await db.run(sql, Object.values(data));
    const newId = result.lastID?.toString() || data.id;

    // Handle many-to-many relations if provided in payload
    for (const [key, value] of Object.entries(data)) {
        const fieldDef = registry.entity[name].fields?.[key] as any;
        if (fieldDef && (fieldDef.type === 'relation-many' || fieldDef.type === 'tag') && Array.isArray(value)) {
            for (const targetId of value) {
                const targetIdVal = typeof targetId === 'object' ? targetId.id : targetId;
                if (!targetIdVal) continue;
                await db.run(`
                    INSERT OR IGNORE INTO entity_relation_many (sourceId, sourceType, targetId, targetType, fieldName)
                    VALUES (?, ?, ?, ?, ?)
                `, [newId, name, targetIdVal, fieldDef.relation?.target || fieldDef.relationEntity || 'tag', key]);
            }
        }
    }
    
    // Audit
    await audit.log({
      entityType: name,
      entityId: newId,
      action: 'CREATE',
      actorId: 'API_USER',
      changes: { new: data }
    });

    res.json({ success: true, id: newId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update and Delete handlers
router.put('/:name/:id', async (req, res) => {
  const { name, id } = req.params;
  const data = req.body;
  const registry = RegistryManager.getInstance().get();

  if (!registry.entity?.[name]) return res.status(404).json({ success: false, error: 'Entity definition not found' });

  try {
    const fields = Object.keys(data).filter(k => {
        const fieldDef = registry.entity[name].fields?.[k] as any;
        return fieldDef && fieldDef.type !== 'relation-many' && fieldDef.type !== 'tag';
    });
    
    if (fields.length > 0) {
        const sql = `UPDATE "${name}" SET ${fields.map(f => `"${f}" = ?`).join(', ')} WHERE id = ?`;
        await db.run(sql, [...fields.map(f => data[f]), id]);
    }
    
    // Update many-to-many relations
    for (const [key, value] of Object.entries(data)) {
        const fieldDef = registry.entity[name].fields?.[key] as any;
        if (fieldDef && (fieldDef.type === 'relation-many' || fieldDef.type === 'tag') && Array.isArray(value)) {
            // Delete old
            await db.run(`DELETE FROM entity_relation_many WHERE sourceId = ? AND sourceType = ? AND fieldName = ?`, [id, name, key]);
            // Insert new
            for (const targetId of value) {
                const targetIdVal = typeof targetId === 'object' ? targetId.id : targetId;
                if (!targetIdVal) continue;
                await db.run(`
                    INSERT OR IGNORE INTO entity_relation_many (sourceId, sourceType, targetId, targetType, fieldName)
                    VALUES (?, ?, ?, ?, ?)
                `, [id, name, targetIdVal, fieldDef.relation?.target || fieldDef.relationEntity || 'tag', key]);
            }
        }
    }
    
    // Audit
    await audit.log({
      entityType: name,
      entityId: id,
      action: 'UPDATE',
      actorId: 'API_USER',
      changes: { updated: data }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:name/:id', async (req, res) => {
  const { name, id } = req.params;
  const registry = RegistryManager.getInstance().get();
  const force = req.query.force === 'true';

  if (!registry.entity?.[name]) return res.status(404).json({ success: false, error: 'Entity definition not found' });

  try {
    // Enterprise Level 10: Recursive Safety Check
    if (!force) {
        const deps = await getEntityDependencies(name, id, registry);
        if (deps.length > 0) {
            return res.json({ 
                success: true, 
                hasDependencies: true, 
                dependencies: deps,
                message: `Record has associated data in: ${deps.map(d => d.label).join(', ')}. Use ?force=true to delete anyway.`
            });
        }
    }

    const sql = `DELETE FROM "${name}" WHERE id = ?`;
    await db.run(sql, [id]);
    
    // Cleanup assignments
    await db.run(`DELETE FROM entity_relation_many WHERE (sourceId = ? AND sourceType = ?) OR (targetId = ? AND targetType = ?)`, [id, name, id, name]).catch(() => {});

    // Audit
    await audit.log({
      entityType: name,
      entityId: id,
      action: 'DELETE',
      actorId: 'API_USER'
    });

    res.json({ success: true, deleted: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export const entityRouter = router;
