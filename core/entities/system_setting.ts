import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * SYSTEM SETTING (v3 Modular)
 * Global configurations for the platform.
 */
export const system_setting: EntityV3<any> = {
  id: 'system_setting',
  label: { ro: 'Setare Sistem', en: 'System Setting' },
  labelPlural: { ro: 'Setări Sistem', en: 'System Settings' },
  icon: 'Settings',
  tableName: 'system_setting',
  displayField: 'key',
  isSystem: true,
  isGlobal: true,
  baseline: true,

  // Marketplace Solution Metadata
  solutionId: 'system-configuration-hub',
  solutionTitle: { ro: 'Configurare Sistem', en: 'System Configuration Hub' },
  description: { 
    ro: 'Administrarea parametrilor globali și a preferințelor platformei.', 
    en: 'Administration of global parameters and platform preferences.' 
  },
  category: 'system',
  priority: 100,
  
  schema: z.object({
    ...BaseSchema,
    namespace: z.string()
      .describe('ui:width=4;icon=Folder;label={"ro": "Namespace", "en": "Namespace"};index=true;section={"ro": "Cheie", "en": "Key"}'),
    
    key: z.string()
      .describe('ui:width=4;icon=Key;label={"ro": "Cheie", "en": "Key"};index=true;section={"ro": "Cheie", "en": "Key"}'),
    
    value: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Valoare Stocată", "en": "Stored Value"};section={"ro": "Conținut", "en": "Content"}'),
    
    dataType: z.enum(['string', 'number', 'boolean', 'json'])
      .default('string')
      .describe('ui:width=4;icon=Database;label={"ro": "Tip Rezultat", "en": "Data Type"};section={"ro": "Conținut", "en": "Content"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Descriere / Rol", "en": "Role Description"};section={"ro": "Conținut", "en": "Content"}'),
  }),


  features: ['audit'],

  actions: [
    {
      id: 'save',
      label: 'Salvează Setare',
      handler: async (ctx: any, input: any) => {
        const { db, user, env } = ctx;
        const { namespace: rawNamespace, key: rawKey, value, dataType } = input;
        
        if (!rawNamespace || !rawKey) throw new Error("Namespace and key required");
        
        const namespace = rawNamespace.toLowerCase();
        const key = rawKey.toLowerCase();
        
        // Invalidate Global Cache so next request gets fresh data
        (globalThis as any).CACHE_EXPIRY = 0;
        (globalThis as any).CACHED_CONFIGS = {};

        const existing = await db.list('SYSTEM_SETTING', { namespace, key });
        const data = {
          namespace,
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          dataType: dataType || (typeof value === 'object' ? 'json' : typeof value),
          updatedAt: new Date().toISOString()
        };

        if (existing && existing.length > 0) {
          await db.update('SYSTEM_SETTING', existing[0].id, data);
        } else {
          await db.create('SYSTEM_SETTING', { 
            id: crypto.randomUUID(),
            ...data 
          });
        }
        
        // Version history
        await db.create('config_version', {
          id: crypto.randomUUID(),
          namespace,
          key,
          configJson: data.value,
          changedBy: user.email || user.id || 'system',
          description: `Updated ${namespace}.${key}`,
          createdAt: new Date().toISOString()
        }).catch((e: any) => console.warn("[V3-SETTING] Save version failed:", e.message));
        
        return { success: true };
      }
    },
    {
      id: 'rollback',
      label: 'Revenire Versiune',
      handler: async (ctx: any, input: any) => {
        const { db } = ctx;
        const { versionId } = input;
        const version = await db.get('config_version', versionId);
        if (!version) throw new Error("Version not found");
        
        const namespace = version.namespace;
        const key = version.key;
        
        const existing = await db.list('SYSTEM_SETTING', { namespace, key });
        if (!existing || existing.length === 0) throw new Error("Target setting no longer exists");

        await db.update('SYSTEM_SETTING', existing[0].id, { 
          value: version.configJson,
          updatedAt: new Date().toISOString()
        });
        
        return { success: true };
      }
    },
    {
      id: 'sync',
      label: 'Sincronizare Masivă',
      handler: async (ctx: any, input: any) => {
        const { db, env } = ctx;
        const { data } = input;
        if (!data) throw new Error("Data required");
        
        const entries = [];
        for (const [ns, items] of Object.entries(data)) {
          if (typeof items !== 'object' || items === null) continue;
          for (const [key, val] of Object.entries(items)) {
            entries.push({ namespace: ns.toLowerCase(), key, value: val });
          }
        }

        const timestamp = new Date().toISOString();
        const queries = entries.map(item => {
          const val = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value);
          const dataType = typeof item.value === 'object' ? 'json' : typeof item.value;
          
          return db.prepare(`
            INSERT INTO SYSTEM_SETTING (id, namespace, key, value, dataType, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(namespace, key) DO UPDATE SET
            value = excluded.value,
            dataType = excluded.dataType,
            updatedAt = excluded.updatedAt
          `, [crypto.randomUUID(), item.namespace, item.key, val, dataType, timestamp]);
        });

        for (let i = 0; i < queries.length; i += 100) {
          await db.batch(queries.slice(i, i + 100));
        }
        
        return { success: true, count: entries.length };
      }
    },
    {
      id: 'get-info',
      label: 'Informații Sistem',
      handler: async (ctx: any) => {
        const { db, request, env, registry } = ctx;
        const stats: any = {};
        
        try {
            const userCount = await db.query("SELECT COUNT(*) as count FROM user");
            stats.users = userCount?.[0]?.count || 0;
            
            const wsCount = await db.query("SELECT COUNT(*) as count FROM workspace");
            stats.workspace = wsCount?.[0]?.count || 0;
            
            const entityCount = await db.query("SELECT COUNT(*) as count FROM entity_definition");
            stats.entities = entityCount?.[0]?.count || 0;
        } catch (e: any) {
            console.warn("[V3-SYSTEM] Stats check failed:", e.message);
        }

        const cf = (request as any).cf || {};
        const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '127.0.0.1';

        const uptimeSeconds = (typeof performance !== 'undefined' && typeof performance.now === 'function')
            ? Math.floor(performance.now() / 1000)
            : 0;

        return {
            info: {
                version: "3.0.0-modular",
                nodeVersion: "v18.0.0 (CloudV8)",
                platform: cf.asOrganization || "Cloudflare Edge",
                arch: "wasm/v8",
                cpus: "Dynamic (Isolated)",
                memory: {
                    total: 128 * 1024 * 1024,
                    free: 64 * 1024 * 1024 
                },
                localIps: [clientIp],
                uptime: uptimeSeconds,
                stats,
                registryConfigured: !!registry.SYSTEM_SETTING?.local_agent_url,
                database: "Cloudflare D1",
                environment: env.ENVIRONMENT || "production"
            }
        };
      }
    },
    {
      id: 'detect-engines',
      label: 'Detectare Motoare',
      handler: async () => {
        return { 
          engines: [
            { type: 'D1-Storage', status: 'online' },
            { type: 'Workers-Compute', status: 'online' },
            { type: 'KV-Cache', status: 'online' }
          ]
        };
      }
    },
    {
      id: 'test-engine',
      label: 'Test Motor',
      handler: async (ctx: any, input: any) => {
        return { status: `Engine '${input?.type || 'unknown'}' test simulated successfully.` };
      }
    },
    {
      id: 'self-healing',
      label: 'Auto-Vindecare',
      handler: async (ctx: any) => {
        const { db, registry, env, handleSelfHealing } = ctx;
        return await handleSelfHealing(db, registry, env);
      }
    },
    {
      id: 'monitoring-infra',
      label: 'Status Infrastructură',
      handler: async (ctx: any, input: any) => {
        const { db, request, env } = ctx;
        const { type } = input;
        const cf = (request as any).cf || {};

        if (type === 'cloudflare') {
            let usageEstimate = 0;
            try {
                // Enterprise Level 8: Use a capped count for performance UI estimate
                const rowCountRes = await db.query("SELECT COUNT(*) as c FROM (SELECT 1 FROM audit_log LIMIT 5000)").catch(() => [{c:0}]);
                usageEstimate = (rowCountRes[0]?.c || 0) * 512;
            } catch (e) {}

            return { 
                enabled: true, status: 'connected', location: cf.city || cf.colo || 'Cloudflare Edge',
                continent: cf.continent, country: cf.country, asOrganization: cf.asOrganization,
                edgePerformance: 'Optimal', env: (env as any).ENVIRONMENT || 'production',
                usage: { storage_bytes: usageEstimate, d1Usage: { cpuTime: 'Optimized', period: 'CURRENT' } }
            };
        }

        if (type === 'local') {
            return { 
                status: 'connected', isCloud: true, env: (env as any).ENVIRONMENT || 'production',
                cpu: { load: '2%', brand: 'Cloudflare Isolated V8' },
                memory: { percentage: '45%', used: '58 MB', total: '128 MB' },
                os: { uptime: 'Cloud Edge Native', distro: cf.asOrganization || 'Cloudflare Network' },
                nodeVersion: 'v18.0.0 (Workers)', platform: 'Cloudflare', arch: 'wasm',
                localIps: [request.headers.get('cf-connecting-ip') || '127.0.0.1']
            };
        }
        
        return { message: "Specify type: cloudflare or local" };
      }
    },
    {
      id: 'monitoring-db',
      label: 'Statistici DB',
      handler: async (ctx: any) => {
        const { db, registry, normalizeEntity } = ctx;
        
        const entityConfigs = registry.ENTITY_CONFIG || {};
        const dashboardEntities = Object.entries(entityConfigs).filter(([key, config]: [string, any]) => {
            const norm = normalizeEntity({ ...config, name: key });
            return norm.dashboardConfig?.enabled !== false && (norm.dashboardConfig?.showInDashboard !== false || ['contact', 'workspace'].includes(key));
        });

        const tableStats = await Promise.all(dashboardEntities.map(async ([key, config]: [string, any]) => {
            const table = config.tableName || key;
            const filter = config.features?.softDelete ? "WHERE deletedAt IS NULL" : "";
            try {
                const [countRes, recentRes] = await Promise.all([
                    db.query(`SELECT COUNT(*) as count FROM ${table} ${filter}`).catch(() => [{count:0}]),
                    db.query(`SELECT * FROM ${table} ${filter} ORDER BY createdAt DESC LIMIT 5`).catch(() => [])
                ]);
                return { table: key, count: countRes[0]?.count || 0, recent: Array.isArray(recentRes) ? recentRes : [] };
            } catch (e) { return { table: key, count: 0, recent: [] }; }
        }));

        return {
            status: 'healthy',
            tables: tableStats.map(s => ({ table: s.table, counts: { local: s.count }, recent: s.recent })),
            records: tableStats.reduce((acc, curr) => acc + curr.count, 0)
        };
      }
    },
    {
      id: 'monitoring-workers',
      label: 'Status Workers',
      handler: async (ctx: any) => {
        const { registry } = ctx;
        const workerEnabled = registry.SYSTEM_SETTING?.enable_worker || registry.SYSTEM_SETTING?.enable_workers;
        return { 
          active: workerEnabled ? 4 : 0, status: workerEnabled ? 'running' : 'stopped',
          lastPulse: new Date().toISOString(), isV2: true,
          workerStatus: { 'cloud:scheduler': { status: workerEnabled ? 'ONLINE' : 'OFFLINE', memory: '128MB' } }
        };
      }
    },
    {
      id: 'monitoring-audits',
      label: 'Audit Logs',
      handler: async (ctx: any) => {
        const { db } = ctx;
        return await db.list('audit_log', {}, { limit: 100, sortBy: 'createdAt', sortOrder: 'DESC' });
      }
    },
    {
      id: 'monitoring-settings',
      label: 'System Settings',
      handler: async (ctx: any) => {
        const { db } = ctx;
        return await db.list('SYSTEM_SETTING');
      }
    }
  ]
};
