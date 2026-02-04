import { Router } from 'express';
import { RegistryManager } from '../../core/registry';
import { DatabaseDriver } from '../../db/driver';
import { AuditService } from '../../core/audit';

const router = Router();
const db = DatabaseDriver.getInstance();
const audit = new AuditService();

/**
 * TRANSLATION TRANSFORMER - Enterprise Level 8
 * Converts multilingual fields (e.g. { ro: "...", en: "..." }) to a single value
 * based on the requested language.
 */
const transformTranslations = (obj: any, lang: string = 'ro'): any => {
    if (!obj) return obj;
    if (typeof obj === 'object' && !Array.isArray(obj) && 
        (typeof obj['ro'] === 'string' || typeof obj['en'] === 'string') &&
        Object.keys(obj).every(k => ['ro', 'en', 'defaultValue'].includes(k))) {
        return obj[lang] || obj['en'] || obj['ro'] || '';
    }
    if (Array.isArray(obj)) return obj.map(item => transformTranslations(item, lang));
    if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = transformTranslations(value, lang);
        }
        return result;
    }
    return obj;
};

/**
 * ENTITY POPULATOR - Enterprise Level 8
 * Resolves many-to-many relations (Tags, etc) for a list of records.
 * Now supports 'dependencies' whitelist for direct relations.
 */
const populateRelations = async (name: string, rows: any[], registry: any) => {
    if (!rows || rows.length === 0) return rows;
    
    // Support both 'entity' (baseline) and 'ENTITY_CONFIG' (full) structures
    const entityConfigs = registry.entity || registry.ENTITY_CONFIG || {};
    const entityDef = entityConfigs[name];
    if (!entityDef || !entityDef.fields) return rows;
    
    const dependencies = Array.isArray(entityDef.dependencies) ? entityDef.dependencies : [];
    const fieldsToPopulate = Object.entries(entityDef.fields).filter(([fieldName, f]: any) => {
        const fd = f as any;
        const target = (fd.relation?.target || fd.relationEntity || '').toLowerCase();
        return fd.type === 'relation-many' || ( (fd.type === 'relation' || fd.type === 'entity_relation') && dependencies.map(d => d.toLowerCase()).includes(target) );
    });

    if (fieldsToPopulate.length === 0) return rows;
    
    const recordIds = rows.map(r => r.id).filter(Boolean);
    if (recordIds.length === 0) return rows;

    for (const [fieldName, fieldDef] of fieldsToPopulate) {
        try {
            const def = fieldDef as any;
            const targetEntity = def.relationEntity || def.relation?.target || 'tag';
            
            if (def.type === 'relation-many') {
                // 1. Get assignments from tag_assignment table
                // Enterprise Level 8: Chunking to avoid D1 "too many SQL variables" limit
                const assignments: any[] = [];
                const CHUNK_SIZE = 80;
                for (let i = 0; i < recordIds.length; i += CHUNK_SIZE) {
                    const chunk = recordIds.slice(i, i + CHUNK_SIZE);
                    const chunkPlaceholder = chunk.map(() => '?').join(',');
                    const chunkAssignments = await db.query(`SELECT entityId, tagId FROM tag_assignment WHERE entityType = ? AND entityId IN (${chunkPlaceholder})`, [name, ...chunk]);
                    assignments.push(...chunkAssignments);
                }
                
                // 2. Also check if the column itself contains IDs (JSON/CSV)
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

                const allRelatedIds = [...new Set([...assignments.map((a: any) => a.tagId), ...columnIds])].filter(Boolean);

                if (allRelatedIds.length > 0) {
                    // Enterprise Level 8: Chunking to avoid D1 "too many SQL variables" limit
                    const relatedObjects: any[] = [];
                    const CHUNK_SIZE = 80;
                    for (let i = 0; i < allRelatedIds.length; i += CHUNK_SIZE) {
                        const chunk = allRelatedIds.slice(i, i + CHUNK_SIZE);
                        const chunkPlaceholder = chunk.map(() => '?').join(',');
                        const chunkResults = await db.query(`SELECT * FROM ${targetEntity} WHERE id IN (${chunkPlaceholder})`, chunk);
                        relatedObjects.push(...chunkResults);
                    }
                    const objectMap = new Map(relatedObjects.map((obj: any) => [obj.id, obj]));

                    for (const row of rows) {
                        const combinedIds = new Set<string>();
                        assignments.filter((a: any) => a.entityId === row.id).forEach((a: any) => combinedIds.add(a.tagId));
                        
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
                // Direct Relation
                const allRelatedIds = [...new Set(rows.map(r => r[fieldName]))].filter(Boolean);
                if (allRelatedIds.length > 0) {
                    // Enterprise Level 8: Chunking to avoid D1 "too many SQL variables" limit
                    const relatedObjects: any[] = [];
                    const CHUNK_SIZE = 80;
                    for (let i = 0; i < allRelatedIds.length; i += CHUNK_SIZE) {
                        const chunk = allRelatedIds.slice(i, i + CHUNK_SIZE);
                        const chunkPlaceholder = chunk.map(() => '?').join(',');
                        const chunkResults = await db.query(`SELECT * FROM ${targetEntity} WHERE id IN (${chunkPlaceholder})`, chunk);
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
 * RECURSIVE DEPENDENCY CHECK - Enterprise Level 8
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
                } else if (fd.type === 'relation-many') {
                    const res = await db.query(`SELECT COUNT(*) as count FROM tag_assignment WHERE entityType = ? AND tagId = ?`, [otherEntity, id]).catch(() => []);
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
    const entityList = Object.keys(registry.entity).map(key => ({
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
  
  if (!registry.entity[name]) {
    return res.status(404).json({ success: false, error: 'Entity not found in registry' });
  }

  try {
    // Fetch data for this entity
    // Supports filtering via query params ?email=...
    let sql = `SELECT * FROM ${name}`;
    const params: any[] = [];
    
    // Simple filter Implementation
    const filters = Object.keys(req.query);
    if (filters.length > 0) {
      const clauses = filters.map(key => `${key} = ?`).join(' AND ');
      sql += ` WHERE ${clauses}`;
      filters.forEach(key => params.push(req.query[key]));
    }
    
    // Limit/Offset
    sql += ` LIMIT 100`;

    const rows = await db.query(sql, params);
    
    // Level 8: Populate and Flatten
    const populated = await populateRelations(name, rows, registry);
    const flattened = transformTranslations(populated, (req.query.lang as string) || 'ro');
    
    res.json({ success: true, count: rows.length, data: flattened });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:name/:id', async (req, res) => {
  const { name, id } = req.params;
  const registry = RegistryManager.getInstance().get();

  if (!registry.entity[name]) {
    return res.status(404).json({ success: false, error: 'Entity not found in registry' });
  }

  try {
    const row = await db.get(`SELECT * FROM ${name} WHERE id = ?`, [id]);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    
    // Level 8: Populate and Flatten
    const populated = await populateRelations(name, [row], registry);
    const flattened = transformTranslations(populated[0], (req.query.lang as string) || 'ro');
    
    res.json({ success: true, data: flattened });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:name', async (req, res) => {
  const { name } = req.params;
  const data = req.body;
  const registry = RegistryManager.getInstance().get();

  if (!registry.entity[name]) {
    return res.status(404).json({ success: false, error: 'Entity definition not found' });
  }

  try {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT INTO ${name} (${fields.join(', ')}) VALUES (${placeholders})`;
    
    const result = await db.run(sql, Object.values(data));
    
    // Audit
    await audit.log({
      entityType: name,
      entityId: result.lastID?.toString() || 'unknown',
      action: 'CREATE',
      actorId: 'API_USER', // TODO: Get from Auth header
      changes: { new: data }
    });

    res.json({ success: true, id: result.lastID });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update and Delete handlers
router.put('/:name/:id', async (req, res) => {
  const { name, id } = req.params;
  const data = req.body;
  const registry = RegistryManager.getInstance().get();

  if (!registry.entity[name]) return res.status(404).json({ success: false, error: 'Entity definition not found' });

  try {
    const fields = Object.keys(data);
    const sql = `UPDATE ${name} SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;
    await db.run(sql, [...Object.values(data), id]);
    
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

  if (!registry.entity[name]) return res.status(404).json({ success: false, error: 'Entity definition not found' });

  try {
    // Enterprise Level 8: Recursive Safety Check
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

    const sql = `DELETE FROM ${name} WHERE id = ?`;
    await db.run(sql, [id]);
    
    // Cleanup assignments
    await db.run(`DELETE FROM tag_assignment WHERE entityType = ? AND entityId = ?`, [name, id]).catch(() => {});

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
