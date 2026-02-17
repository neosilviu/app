import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * AI TASK ENTITY (v3 Modular)
 * Tracks autonomous jobs executed by the agent.
 */
export const ai_task: EntityV3<any> = {
  id: 'ai_task',
  label: { ro: 'Job AI Autonom', en: 'Autonomous AI Job' },
  labelPlural: { ro: 'Job-uri AI', en: 'AI Jobs' },
  icon: 'BrainCircuit',
  tableName: 'ai_task',
  displayField: 'prompt',
  features: ['audit', 'timestamps'],
  
  // Enterprise Level 10: Extension Protocol
  extensions: {
    interaction: {
      schema: {
        // Adding 'ai' option to the existing channel enum
        channel: z.enum(['whatsapp', 'email', 'sms', 'system', 'call', 'ai'])
          .describe('ui:width=4;label={"ro": "Canal (Extended AI", "en": "Channel (Extended AI"}'),
      },
      actions: [
        {
          id: 'summarize-interactions',
          label: { ro: 'Rezumat AI', en: 'AI Summary' },
          handler: async (ctx: any) => {
             // Logic to summarize thread...
             return { summary: "This is a modular AI summary logic" };
          }
        }
      ]
    }
  },

  // Marketplace Metadata
  solutionTitle: { ro: 'Agenți AI Autonomi', en: 'Autonomous AI Agents' },
  description: { ro: 'Gestiune și urmărire sarcini executate autonom de agenți AI.', en: 'Manage and track tasks executed autonomously by AI agents.' },
  category: 'system',

  schema: z.object({
    ...BaseSchema,
    prompt: z.string().describe('ui:width=12;label={"ro": "Prompt / Obiectiv", "en": "Prompt / Objective"}'),
    status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending').describe('ui:width=4;label={"ro": "Status", "en": "Status"}'),
    result: z.string().optional().describe('ui:width=12;label={"ro": "Rezultat Final", "en": "Final Result"}'),
    logs: z.string().optional().describe('ui:hidden=true'),
    iterations: z.number().default(0).describe('ui:width=4;label={"ro": "Iterații", "en": "Iterations"}'),
  }),

  actions: [
    {
      id: 'execute',
      label: { ro: 'Execută Acum', en: 'Execute Now' },
      handler: async (ctx: any) => {
        const { db, id, AiService } = ctx;
        const task = await db.get('ai_task', id);
        if (!task) throw new Error("Job not found");

        await db.update('ai_task', id, { status: 'running', updatedAt: new Date().toISOString() });

        const ai = new AiService(ctx.env, { ai_config: ctx.registry.AI_CONFIG });
        const res = await ai.runTask(task.prompt, ctx, { maxIterations: 10 });

        await db.update('ai_task', id, { 
            status: res.success ? 'completed' : 'failed',
            result: res.result || res.error,
            iterations: res.iterations,
            updatedAt: new Date().toISOString()
        });

        return res;
      }
    }
  ],

  menuConfig: {
    showInMainMenu: true,
    category: 'system',
    icon: 'BrainCircuit',
    priority: 90
  }
};

export default ai_task;
