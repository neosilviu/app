import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * AI PROMPT ENTITY (v3 Modular)
 * Managed AI prompts and autonomous architectural operations.
 */
export const ai_prompt: EntityV3<any> = {
  id: 'ai_prompt',
  label: { ro: 'Prompt AI', en: 'AI Prompt' },
  labelPlural: { ro: 'Prompturi AI', en: 'AI Prompts' },
  icon: 'Terminal',
  tableName: '_ai_prompt',
  displayField: 'name',
  isSystem: true,

  // Marketplace Metadata
  solutionTitle: { ro: 'Manager Prompter AI', en: 'AI Prompt Manager' },
  description: { ro: 'Gestiune prompt-uri de sistem și șabloane pentru AI.', en: 'Manage system prompts and AI templates.' },
  category: 'system',

  schema: z.object({
    ...BaseSchema,
    name: z.string().describe('ui:width=12;label={"ro": "Nume Prompt", "en": "Prompt Name"}'),
    systemPrompt: z.string().optional().describe('ui:width=12;type=textarea;label={"ro": "System Prompt", "en": "System Prompt"}'),
    userPromptTemplate: z.string().optional().describe('ui:width=12;type=textarea;label={"ro": "User Prompt Template", "en": "User Prompt Template"}'),
    model: z.string().optional().describe('ui:width=6;label={"ro": "Model AI Interface", "en": "Model AI Interface"}'),
    provider: z.string().optional().describe('ui:width=6;label={"ro": "Furnizor Implicit", "en": "Default Provider"}'),
    inputContext: z.string().optional().describe('ui:width=12;label={"ro": "Context Input (global, list, etc", "en": "Context Input (global, list, etc"}'),
    outputField: z.string().optional().describe('ui:width=6;label={"ro": "Câmp Output", "en": "Output Field"}'),
    category: z.string().optional().describe('ui:width=6;label={"ro": "Categorie", "en": "Category"}'),
    isLocked: z.boolean().default(false).describe('ui:width=6;label={"ro": "Sistem / Blocat", "en": "System / Locked"}'),
  }),

  features: ['audit', 'deletable', 'timestamps'],

  actions: [
    {
      id: 'architect',
      label: { ro: 'Arhitect Entități', en: 'Entity Architect' },
      description: 'Generates Level 9 Metadata DNA from natural language descriptions.',
      input: z.any(),
      handler: async (ctx: any, input: any) => {
        const { db, env, registry, AiService } = ctx;
        
        const { prompt: userPrompt, provider, model } = input || {};
        
        const aiConfig = registry.AI_CONFIG || {};
        const ai = new AiService(env, { ai_config: aiConfig, registry, db: db.rawBinding || db });
        
        const entities = Object.entries(registry.ENTITY_CONFIG || {}).map(([id, cfg]: [any, any]) => ({ 
            id, 
            label: cfg.label 
        }));
        
        const promptContext = await ai.getPrompt(db, 'entity_architect', { 
            userPrompt, 
            message: userPrompt, 
            currentEntities: JSON.stringify(entities) 
        });

        try {
            const response = await ai.chat(promptContext.prompt, [], {
                systemPrompt: promptContext.systemPrompt,
                provider: provider || aiConfig.active_provider,
                model: promptContext.model || model || aiConfig.model,
                response_mime_type: 'application/json'
            });
            
            const result = (ai as any).engine.extractJson(response);
            return result || { raw: response };
        } catch (err: any) {
            throw new Error(`Architect failed: ${err.message}`);
        }
      }
    },
    {
        id: 'magic-fill',
        label: { ro: 'Magic Fill', en: 'Magic Fill' },
        description: 'Auto-completes fields based on context',
        input: z.any(),
        handler: async (ctx: any, input: any) => {
            const { db, env, registry, AiService } = ctx;
            const { entityType, currentData, schema = {} } = input || {};
            
            const ai = new AiService(env, { ai_config: registry.AI_CONFIG, registry, db: db.rawBinding || db });
            const systemPromptObj = registry.AI_PROMPT.system.find((p: any) => p.id === 'magic_fill');
            const systemPrompt = systemPromptObj?.content;
            const userPrompt = `Entity: ${entityType}\nData: ${JSON.stringify(currentData)}\nSchema: ${JSON.stringify(schema)}`;

            const response = await ai.chat(userPrompt, [], { 
                systemPrompt, 
                response_mime_type: 'application/json' 
            });
            return (ai as any).engine.extractJson(response);
        }
    },
    {
        id: 'solve-task',
        label: { ro: 'Execută Sarcina (Autonomous)', en: 'Solve Task (Autonomous)' },
        description: 'AI-ul analizează sarcina și folosește uneltele disponibile pentru a o rezolva.',
        input: z.object({
            task: z.string().describe('ui:label={"ro": "{", "en": "{"}"ro": "{", "en": "{"}"ro": "{", "en": "{"}"ro": "Descrierea Sarcinii", "en": "Task Description"}'),
            history: z.array(z.any()).optional()
        }),
        handler: async (ctx: any, input: any) => {
            const { db, env, registry, AiService, AVAILABLE_V3_ENTITIES } = ctx;
            const { task, history = [] } = input || {};
            
            const ai = new AiService(env, { ai_config: registry.AI_CONFIG, registry, db: db.rawBinding || db });
            
            // Re-inject AV3E if missing from ctx (it should be there via dispatcher)
            const entities = AVAILABLE_V3_ENTITIES || {};
            
            const result = await ai.runTask(task, {
                ...ctx,
                v3Entities: entities
            }, { 
                history 
            });

            return result;
        }
    }
  ],
  
  menuConfig: {
    showInMainMenu: true,
    category: 'system',
    icon: 'Terminal',
    priority: 95
  }
};

export default ai_prompt;
