import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * WORKER ENTITY (v3 Modular)
 * Manages background processes like WhatsApp, Gmail, and Indexers.
 */
export const worker: EntityV3<any> = {
  id: 'worker',
  label: { ro: 'Worker Background', en: 'Background Worker' },
  labelPlural: { ro: 'Workeri Background', en: 'Background Workers' },
  icon: 'Cpu',
  tableName: 'worker',
  displayField: 'name',
  isSystem: true,
  indexes: [
    'workspaceId, createdAt DESC'
  ],

  // Marketplace Solution Metadata
  solutionId: 'worker-engine-core',
  solutionTitle: { ro: 'Motor Execuție Workeri', en: 'Worker Execution Engine' },
  description: { 
    ro: 'Orchestrarea proceselor de fundal pentru integrări și sarcini programate.', 
    en: 'Orchestrating background processes for integrations and scheduled tasks.' 
  },
  category: 'system',
  priority: 15,

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .describe('ui:width=6;icon=Cpu;label={"ro": "Nume Proces", "en": "Process Name"};section={"ro": "Stare", "en": "Status"}'),
    
    type: z.enum(['whatsapp', 'gmail', 'indexer', 'task', 'scheduler', 'proxy'])
      .describe('ui:width=6;icon=Filter;label={"ro": "Tip Worker", "en": "Worker Type"};section={"ro": "Stare", "en": "Status"}'),
    
    status: z.enum(['running', 'stopped', 'error', 'initializing', 'restarting'])
      .default('stopped')
      .describe('ui:width=4;icon=Activity;label={"ro": "Status Curent", "en": "Current Status"};section={"ro": "Stare", "en": "Status"}'),
    
    lastPulse: z.string().optional()
      .describe('ui:width=4;icon=Zap;label={"ro": "Ultimul Semnal", "en": "Last Pulse"};section={"ro": "Stare", "en": "Status"}'),

    isEnabled: z.boolean().default(true)
      .describe('ui:width=4;icon=Power;label={"ro": "Activat", "en": "Enabled"};section={"ro": "Stare", "en": "Status"}'),
    
    error: z.string().optional()
      .describe('ui:width=12;icon=AlertTriangle;label={"ro": "Mesaj Eroare", "en": "Error Message"};section={"ro": "Diagnostic", "en": "Diagnostic"}'),
    
    config: z.string().optional()
      .describe('ui:width=12;type=json;label={"ro": "Configurație (JSON)", "en": "Configuration"};section={"ro": "Diagnostic", "en": "Diagnostic"}'),
  }),


  features: ['audit'],

  actions: [
    {
      id: 'toggle',
      label: { ro: 'Comută (Start/Stop)', en: 'Toggle (Start/Stop)' },
      handler: async (ctx: any, input: any) => {
        const { db, body, registry } = ctx;
        const id = body?.id || input?.id;
        if (!id) throw new Error("Worker ID required");

        const w = await db.get('worker', id);
        if (!w) throw new Error("Worker not found");

        const newStatus = w.status === 'running' ? 'stopped' : 'initializing';
        await db.update('worker', id, { 
            status: newStatus,
            updatedAt: new Date().toISOString()
        });

        // Trigger Local Agent Refresh
        const localAgentUrl = registry.SYSTEM_SETTING?.local_agent_url || 'http://localhost:4001';
        try {
            await fetch(`${localAgentUrl}/api/system/workers/refresh`, { method: 'POST' });
        } catch (e: any) {
            console.warn("[WORKER-ACTION] Failed to notify local agent:", e.message);
        }

        return { success: true, status: newStatus };
      }
    },
    {
      id: 'restart-all',
      label: { ro: 'Repornește Toți Workerii', en: 'Restart All Workers' },
      handler: async (ctx: any) => {
        const { db, registry } = ctx;
        await db.query("UPDATE worker SET status = 'initializing' WHERE status = 'running'");
        
        // Trigger Local Agent Refresh
        const localAgentUrl = registry.SYSTEM_SETTING?.local_agent_url || 'http://localhost:4001';
        try {
            await fetch(`${localAgentUrl}/api/system/workers/refresh`, { method: 'POST' });
        } catch (e: any) {
            console.warn("[WORKER-ACTION] Failed to notify local agent:", e.message);
        }
        
        return { success: true, message: "Restart signal sent to all workers" };
      }
    },
    {
      id: 'sync-v2',
      label: { ro: 'Sincronizare din Legacy', en: 'Sync from Legacy' },
      handler: async (ctx: any) => {
        const { db, registry } = ctx;
        const baseline = [
            { id: 'worker-whatsapp', name: 'WhatsApp Worker', type: 'whatsapp', enabled: !!registry.SYSTEM_SETTING?.worker_whatsapp_enabled },
            { id: 'worker-gmail', name: 'Gmail Worker', type: 'gmail', enabled: !!registry.SYSTEM_SETTING?.worker_gmail_enabled },
            { id: 'worker-indexer', name: 'Indexer Worker', type: 'indexer', enabled: !!registry.SYSTEM_SETTING?.worker_indexer_enabled },
            { id: 'worker-tasks', name: 'Tasks/Events Worker', type: 'task', enabled: true }
        ];

        for (const item of baseline) {
            const existing = await db.get('worker', item.id);
            if (!existing) {
                await db.create('worker', {
                    id: item.id,
                    workspaceId: 'system',
                    name: item.name,
                    type: item.type,
                    isEnabled: item.enabled,
                    status: 'stopped',
                    createdAt: new Date().toISOString()
                });
            } else {
                await db.update('worker', item.id, { isEnabled: item.enabled });
            }
        }
        return { success: true, count: baseline.length };
      }
    },
    {
      id: 'get-status',
      label: { ro: 'Actualizează Statusuri', en: 'Refresh Statuses' },
      handler: async (ctx: any) => {
        const { registry } = ctx;
        const localAgentUrl = registry.SYSTEM_SETTING?.local_agent_url || 'http://localhost:4001';
        
        try {
          const resp = await fetch(`${localAgentUrl}/api/system/workers/status`);
          const data = await resp.json();
          return { success: true, statuses: data };
        } catch (e: any) {
          return { success: false, error: "Local agent not reachable" };
        }
      }
    }
  ]
};
