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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
/**
 * V3 ENTITY REGISTRY - Automated Level 10 (Registry-Less Discovery)
 */
export var AVAILABLE_V3_ENTITIES = {};
var discoveryPromise = null;
// Enterprise Level 10 - On-Demand Entity Discovery
export function discoverEntities() {
    return __awaiter(this, void 0, void 0, function () {
        var globResult;
        var _this = this;
        return __generator(this, function (_a) {
            if (discoveryPromise)
                return [2 /*return*/, discoveryPromise];
            // Fast-Path (Synchronous): If eager glob is available, populate it immediately
            // so that getV3EntitiesAsLegacy() works even if called right after module load.
            try {
                // @ts-ignore
                if (typeof import.meta !== 'undefined' && import.meta.glob) {
                    globResult = import.meta.glob([
                        './*.ts',
                        '!./*.test.ts',
                        '!./*.spec.ts',
                        '!./index.ts'
                    ], { eager: true });
                    if (globResult && Object.keys(globResult).length > 0) {
                        Object.entries(globResult).forEach(function (_a) {
                            var pathStr = _a[0], module = _a[1];
                            processModule(pathStr, module);
                        });
                    }
                }
            }
            catch (e) { /* Browser/Vite context */ }
            discoveryPromise = (function () { return __awaiter(_this, void 0, void 0, function () {
                var nodePath, nodeFs, path, fs, pathDefault, fsDefault, dir, normalizedDir, scanPaths, _i, scanPaths_1, targetDir, files, _a, files_1, file, fullPath, fileUrl, module_1, e_1, e_2;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (!(Object.keys(AVAILABLE_V3_ENTITIES).length === 0 && typeof process !== 'undefined' && ((_b = process.versions) === null || _b === void 0 ? void 0 : _b.node))) return [3 /*break*/, 13];
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 12, , 13]);
                            nodePath = 'path';
                            nodeFs = 'fs';
                            return [4 /*yield*/, import(/* @vite-ignore */ nodePath)];
                        case 2:
                            path = _c.sent();
                            return [4 /*yield*/, import(/* @vite-ignore */ nodeFs)];
                        case 3:
                            fs = _c.sent();
                            pathDefault = path.default || path;
                            fsDefault = fs.default || fs;
                            dir = pathDefault.dirname(new URL(import.meta.url).pathname);
                            if (dir.startsWith('/') && process.platform === 'win32')
                                dir = dir.substring(1);
                            normalizedDir = pathDefault.resolve(dir);
                            scanPaths = [normalizedDir];
                            _i = 0, scanPaths_1 = scanPaths;
                            _c.label = 4;
                        case 4:
                            if (!(_i < scanPaths_1.length)) return [3 /*break*/, 11];
                            targetDir = scanPaths_1[_i];
                            if (!fsDefault.existsSync(targetDir))
                                return [3 /*break*/, 10];
                            files = fsDefault.readdirSync(targetDir);
                            _a = 0, files_1 = files;
                            _c.label = 5;
                        case 5:
                            if (!(_a < files_1.length)) return [3 /*break*/, 10];
                            file = files_1[_a];
                            if (file === 'index.ts' || file === 'index.js' || (!file.endsWith('.ts') && !file.endsWith('.js')))
                                return [3 /*break*/, 9];
                            if (file.endsWith('.test.ts') || file.endsWith('.spec.ts'))
                                return [3 /*break*/, 9];
                            fullPath = pathDefault.join(targetDir, file);
                            _c.label = 6;
                        case 6:
                            _c.trys.push([6, 8, , 9]);
                            fileUrl = pathDefault.isAbsolute(fullPath) ? "file://".concat(fullPath.replace(/\\/g, '/')) : "./".concat(file);
                            return [4 /*yield*/, import(/* @vite-ignore */ fileUrl)];
                        case 7:
                            module_1 = _c.sent();
                            processModule(file, module_1);
                            return [3 /*break*/, 9];
                        case 8:
                            e_1 = _c.sent();
                            return [3 /*break*/, 9];
                        case 9:
                            _a++;
                            return [3 /*break*/, 5];
                        case 10:
                            _i++;
                            return [3 /*break*/, 4];
                        case 11: return [3 /*break*/, 13];
                        case 12:
                            e_2 = _c.sent();
                            return [3 /*break*/, 13];
                        case 13: return [2 /*return*/];
                    }
                });
            }); })();
            return [2 /*return*/, discoveryPromise];
        });
    });
}
// TURBO MODE: Defer entity discovery to first use, not module load
// This prevents blocking server startup
var discoveryScheduled = false;
var scheduleDiscovery = function () {
    if (discoveryScheduled)
        return;
    discoveryScheduled = true;
    // Non-blocking: schedule discovery async without awaiting
    setTimeout(function () {
        discoverEntities().catch(function () { });
    });
};
function processModule(pathStr, module) {
    if (pathStr.endsWith('index.ts') || pathStr.includes('.test.'))
        return;
    var parts = pathStr.split(/[\\/]/);
    var lastPart = parts[parts.length - 1];
    if (!lastPart)
        return;
    var name = lastPart.replace('.ts', '');
    var entity = module[name] || module.default || Object.values(module)[0];
    if (entity && typeof entity === 'object' && (entity.id || entity.tableName)) {
        AVAILABLE_V3_ENTITIES[entity.id || name] = entity;
    }
}
export function getActiveV3Entities(activeIds) {
    // Ensure discovery is scheduled if not started
    scheduleDiscovery();
    // We don't await here to keep it sync for legacy compatibility, 
    // but we assume discovery is running or finished
    var ids = activeIds || Object.keys(AVAILABLE_V3_ENTITIES);
    var active = {};
    ids.forEach(function (id) {
        if (AVAILABLE_V3_ENTITIES[id]) {
            active[id] = AVAILABLE_V3_ENTITIES[id];
        }
    });
    return active;
}
/**
 * Helper: Extract metadata from Zod Schema
 */
function extractZodMetadata(schema) {
    var fields = {};
    var shape = (schema === null || schema === void 0 ? void 0 : schema.shape) || schema;
    if (!shape)
        return fields;
    Object.entries(shape).forEach(function (_a) {
        var _b, _c, _d;
        var key = _a[0], zodField = _a[1];
        var currentField = zodField;
        // Unwrap ZodDefault, ZodOptional, ZodNullable
        while (currentField._def && (currentField._def.typeName === 'ZodOptional' ||
            currentField._def.typeName === 'ZodDefault' ||
            currentField._def.typeName === 'ZodNullable')) {
            currentField = currentField._def.innerType || currentField._def.wrappedType;
        }
        var description = ((_b = zodField._def) === null || _b === void 0 ? void 0 : _b.description) || ((_c = currentField._def) === null || _c === void 0 ? void 0 : _c.description) || '';
        var metadata = { name: key };
        var typeName = (_d = currentField._def) === null || _d === void 0 ? void 0 : _d.typeName;
        if (typeName === 'ZodString')
            metadata.type = 'string';
        else if (typeName === 'ZodNumber')
            metadata.type = 'number';
        else if (typeName === 'ZodBoolean')
            metadata.type = 'boolean';
        else if (typeName === 'ZodDate')
            metadata.type = 'datetime';
        else if (typeName === 'ZodEnum')
            metadata.type = 'enum';
        else if (typeName === 'ZodArray' || typeName === 'ZodObject')
            metadata.type = 'json';
        else
            metadata.type = 'string';
        if (description) {
            description.split(';').forEach(function (pair) {
                var eqIndex = pair.indexOf('=');
                if (eqIndex === -1)
                    return;
                var k = pair.substring(0, eqIndex).trim().replace('ui:', '');
                var v = pair.substring(eqIndex + 1).trim();
                try {
                    metadata[k] = (v.startsWith('{') || v.startsWith('[')) ? JSON.parse(v) : (v === 'true' ? true : (v === 'false' ? false : v));
                }
                catch (_a) {
                    metadata[k] = v;
                }
            });
        }
        fields[key] = metadata;
    });
    return fields;
}
export function getV3EntitiesAsLegacy(marketplaceTemplates) {
    if (marketplaceTemplates === void 0) { marketplaceTemplates = []; }
    // Ensure discovery is scheduled if not started
    scheduleDiscovery();
    var legacy = {};
    Object.values(AVAILABLE_V3_ENTITIES).forEach(function (ent) {
        var id = ent.id || ent.tableName;
        if (!id || legacy[id])
            return;
        legacy[id] = __assign(__assign({}, ent), { fields: extractZodMetadata(ent.schema || ent.fields), v3: true });
    });
    marketplaceTemplates.forEach(function (template) {
        if (template.extensions) {
            Object.entries(template.extensions).forEach(function (_a) {
                var targetId = _a[0], ext = _a[1];
                var target = legacy[targetId];
                if (!target)
                    return;
                if (ext.schema) {
                    target.fields = __assign(__assign({}, target.fields), extractZodMetadata(ext.schema));
                    if (target.schema && typeof target.schema.extend === 'function') {
                        target.schema = target.schema.extend(ext.schema);
                    }
                }
                if (ext.flowRules)
                    target.flowRules = __assign(__assign({}, (target.flowRules || {})), ext.flowRules);
                if (ext.actions)
                    target.actions = __spreadArray(__spreadArray([], (target.actions || []), true), ext.actions, true);
                if (ext.menuConfig)
                    target.menuConfig = __assign(__assign({}, (target.menuConfig || {})), ext.menuConfig);
            });
        }
    });
    return legacy;
}
export function getV3Navigation() {
    // Ensure discovery is scheduled if not started
    scheduleDiscovery();
    var items = [];
    var seen = new Set();
    Object.values(AVAILABLE_V3_ENTITIES).forEach(function (ent) {
        var id = ent.id || ent.tableName;
        if (!id || seen.has(id))
            return;
        seen.add(id);
        var config = ent.menuConfig || {};
        // By default, if showInMainMenu is not explicitly false, we show it
        if (config.showInMainMenu !== false) {
            items.push({
                id: id,
                label: config.label || ent.labelRaw || ent.label, // Use bilingual label if available
                icon: config.icon || ent.icon,
                path: "/".concat(id),
                category: config.category || 'main_menu',
                priority: config.priority || 50,
                isSystem: ent.isSystem || false,
                badge: config.badge,
            });
        }
    });
    return items.sort(function (a, b) { return (a.priority || 0) - (b.priority || 0); });
}
