import { Router } from 'express';
import { RegistryManager } from '../../core/registry';
import { DatabaseDriver } from '../../db/driver';
import { AuditService } from '../../core/audit';

const router = Router();
const db = DatabaseDriver.getInstance();
const audit = new AuditService();

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
    res.json({ success: true, count: rows.length, data: rows });
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
    res.json({ success: true, data: row });
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

// Update and Delete handlers would follow similar pattern...

export const entityRouter = router;
