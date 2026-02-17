
import { Hono } from 'hono';
import { z } from 'zod';
import * as Entities from '../../core/entities/index.ts';

console.log('[hono-server] module loaded');

const app = new Hono();

// Registry încălzit o singură dată la startup pentru performanță
const entityRegistry: Record<string, any> = Entities.getV3EntitiesAsLegacy ? Entities.getV3EntitiesAsLegacy() : Entities;
// Helper: get entity definition from registry (lookup robust, case-insensitive)
function getEntityDef(entityId: string): any {
	if (!entityId) return null;
	const key = Object.keys(entityRegistry).find(k => k.toLowerCase() === entityId.toLowerCase());
	return key ? entityRegistry[key] : null;
}

// Helper: get table (simulate with in-memory for demo)
const db: Record<string, any[]> = {};

// List entities
app.get('/api/:entity', (c) => {
	const entityId = c.req.param('entity');
	const def = getEntityDef(entityId);
	if (!def) return c.json({ success: false, error: 'Entity not found' }, 404);
	db[entityId] = db[entityId] || [];
	return c.json({ success: true, items: db[entityId] });
});

// Get by id
app.get('/api/:entity/:id', (c) => {
	const entityId = c.req.param('entity');
	const id = c.req.param('id');
	const def = getEntityDef(entityId);
	if (!def) return c.json({ success: false, error: 'Entity not found' }, 404);
	db[entityId] = db[entityId] || [];
	const item = db[entityId].find((r: any) => String(r.id) === String(id));
	if (!item) return c.json({ success: false, error: 'Not found' }, 404);
	return c.json({ success: true, item });
});

// Create
app.post('/api/:entity', async (c) => {
	const entityId = c.req.param('entity');
	const def = getEntityDef(entityId);
	if (!def) return c.json({ success: false, error: 'Entity not found' }, 404);
	const body = await c.req.json();
	const schema = def.schema || z.object({});
	const parsed = schema.safeParse(body);
	if (!parsed.success) return c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400);
	db[entityId] = db[entityId] || [];
	const newItem = { ...parsed.data, id: parsed.data.id || Date.now().toString() };
	db[entityId].push(newItem);
	return c.json({ success: true, item: newItem });
});

// Update
app.put('/api/:entity/:id', async (c) => {
	const entityId = c.req.param('entity');
	const id = c.req.param('id');
	const def = getEntityDef(entityId);
	if (!def) return c.json({ success: false, error: 'Entity not found' }, 404);
	const body = await c.req.json();
	db[entityId] = db[entityId] || [];
	const idx = db[entityId].findIndex((r: any) => String(r.id) === String(id));
	if (idx === -1) return c.json({ success: false, error: 'Not found' }, 404);
	const schema = def.schema ? def.schema.partial() : z.object({});
	const parsed = schema.safeParse(body);
	if (!parsed.success) return c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400);
	db[entityId][idx] = { ...db[entityId][idx], ...parsed.data };
	return c.json({ success: true, item: db[entityId][idx] });
});

// Delete
app.delete('/api/:entity/:id', (c) => {
	const entityId = c.req.param('entity');
	const id = c.req.param('id');
	const def = getEntityDef(entityId);
	if (!def) return c.json({ success: false, error: 'Entity not found' }, 404);
	db[entityId] = db[entityId] || [];
	const idx = db[entityId].findIndex((r: any) => String(r.id) === String(id));
	if (idx === -1) return c.json({ success: false, error: 'Not found' }, 404);
	db[entityId].splice(idx, 1);
	return c.json({ success: true, deleted: true });
});

// Health check
app.get('/health', (c) => c.json({ ok: true, message: 'Hono server running!' }));




// Pentru rulare locală identică cu app-v3 folosește infrastructura Vite+proxy sau worker (wrangler)!

export default app;
