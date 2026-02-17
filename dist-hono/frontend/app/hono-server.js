var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { Hono } from 'hono';
import { z } from 'zod';
import * as Entities from '../../core/entities/index.ts';
console.log('[dist/hono-server] module loaded');
var app = new Hono();
// Registry încălzit o singură dată la startup pentru performanță
var entityRegistry = Entities.getV3EntitiesAsLegacy ? Entities.getV3EntitiesAsLegacy() : Entities;
// Helper: get entity definition from registry (lookup robust, case-insensitive)
function getEntityDef(entityId) {
    if (!entityId)
        return null;
    var key = Object.keys(entityRegistry).find(function (k) { return k.toLowerCase() === entityId.toLowerCase(); });
    return key ? entityRegistry[key] : null;
}
// Helper: get table (simulate with in-memory for demo)
var db = {};
// List entities
app.get('/api/:entity', function (c) {
    var entityId = c.req.param('entity');
    var def = getEntityDef(entityId);
    if (!def)
        return c.json({ success: false, error: 'Entity not found' }, 404);
    db[entityId] = db[entityId] || [];
    return c.json({ success: true, items: db[entityId] });
});
// Get by id
app.get('/api/:entity/:id', function (c) {
    var entityId = c.req.param('entity');
    var id = c.req.param('id');
    var def = getEntityDef(entityId);
    if (!def)
        return c.json({ success: false, error: 'Entity not found' }, 404);
    db[entityId] = db[entityId] || [];
    var item = db[entityId].find(function (r) { return String(r.id) === String(id); });
    if (!item)
        return c.json({ success: false, error: 'Not found' }, 404);
    return c.json({ success: true, item: item });
});
// Create
app.post('/api/:entity', function (c) { return __awaiter(void 0, void 0, void 0, function () {
    var entityId, def, body, schema, parsed, newItem;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                entityId = c.req.param('entity');
                def = getEntityDef(entityId);
                if (!def)
                    return [2 /*return*/, c.json({ success: false, error: 'Entity not found' }, 404)];
                return [4 /*yield*/, c.req.json()];
            case 1:
                body = _a.sent();
                schema = def.schema || z.object({});
                parsed = schema.safeParse(body);
                if (!parsed.success)
                    return [2 /*return*/, c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400)];
                db[entityId] = db[entityId] || [];
                newItem = __assign(__assign({}, parsed.data), { id: parsed.data.id || Date.now().toString() });
                db[entityId].push(newItem);
                return [2 /*return*/, c.json({ success: true, item: newItem })];
        }
    });
}); });
// Update
app.put('/api/:entity/:id', function (c) { return __awaiter(void 0, void 0, void 0, function () {
    var entityId, id, def, body, idx, schema, parsed;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                entityId = c.req.param('entity');
                id = c.req.param('id');
                def = getEntityDef(entityId);
                if (!def)
                    return [2 /*return*/, c.json({ success: false, error: 'Entity not found' }, 404)];
                return [4 /*yield*/, c.req.json()];
            case 1:
                body = _a.sent();
                db[entityId] = db[entityId] || [];
                idx = db[entityId].findIndex(function (r) { return String(r.id) === String(id); });
                if (idx === -1)
                    return [2 /*return*/, c.json({ success: false, error: 'Not found' }, 404)];
                schema = def.schema ? def.schema.partial() : z.object({});
                parsed = schema.safeParse(body);
                if (!parsed.success)
                    return [2 /*return*/, c.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, 400)];
                db[entityId][idx] = __assign(__assign({}, db[entityId][idx]), parsed.data);
                return [2 /*return*/, c.json({ success: true, item: db[entityId][idx] })];
        }
    });
}); });
// Delete
app.delete('/api/:entity/:id', function (c) {
    var entityId = c.req.param('entity');
    var id = c.req.param('id');
    var def = getEntityDef(entityId);
    if (!def)
        return c.json({ success: false, error: 'Entity not found' }, 404);
    db[entityId] = db[entityId] || [];
    var idx = db[entityId].findIndex(function (r) { return String(r.id) === String(id); });
    if (idx === -1)
        return c.json({ success: false, error: 'Not found' }, 404);
    db[entityId].splice(idx, 1);
    return c.json({ success: true, deleted: true });
});
// Health check
app.get('/health', function (c) { return c.json({ ok: true, message: 'Hono server running!' }); });
// Pentru rulare locală identică cu app-v3 folosește infrastructura Vite+proxy sau worker (wrangler)!
export default app;
