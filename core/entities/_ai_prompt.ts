import { z } from 'zod';
import { BaseSchema, type EntityV3 } from '../schemas/base';

/**
 * AI PROMPT ENTITY (v3 Modular)
 * Internal system table for the AI Brain.
 */
export const ai_prompt: EntityV3<any> = {
  id: '_ai_prompt',
  label: { ro: 'Prompt AI Sistem', en: 'System AI Prompt' },
  labelPlural: { ro: 'Prompte AI Sistem', en: 'System AI Prompts' },
  icon: 'Terminal',
  tableName: '_ai_prompt',
  displayField: 'name',
  isSystem: true,
  isGlobal: true,

  // Marketplace Solution Metadata
  solutionId: 'ai-prompt-engine',
  solutionTitle: { ro: 'Motor Prompte AI', en: 'AI Prompt Engine' },
  description: { 
    ro: 'Configurarea și managementul instrucțiunilor pentru Inteligența Artificială.', 
    en: 'Configuration and management of instructions for Artificial Intelligence.' 
  },
  category: 'ai',
  priority: 10,

  schema: z.object({
    ...BaseSchema,
    name: z.string()
      .min(1)
      .describe('ui:width=12;unique=true;icon=Type;label={"ro": "Nume Prompt", "en": "Prompt Name"};searchable=true;section={"ro": "General", "en": "General"}'),
    
    template: z.string()
      .describe('ui:width=12;type=textarea;icon=Terminal;label={"ro": "Template Prompt", "en": "Prompt Template"};section={"ro": "Conținut", "en": "Content"}'),
    
    systemPrompt: z.string().optional()
      .describe('ui:width=12;type=textarea;icon=Shield;label={"ro": "Prompt Sistem", "en": "System Prompt"};section={"ro": "Conținut", "en": "Content"}'),
    
    userPromptTemplate: z.string().optional()
      .describe('ui:width=12;type=textarea;icon=User;label={"ro": "Template User", "en": "User Template"};section={"ro": "Conținut", "en": "Content"}'),
    
    model: z.string().optional()
      .describe('ui:width=4;icon=Cpu;label={"ro": "Model Recomandat", "en": "Recommended Model"};section={"ro": "Configurare", "en": "Configuration"}'),
    
    provider: z.string().optional()
      .describe('ui:width=4;icon=Server;label={"ro": "Provider", "en": "Provider"};section={"ro": "Configurare", "en": "Configuration"}'),
    
    config: z.string().optional()
      .describe('ui:width=4;type=json;label={"ro": "Parametri Tehnici", "en": "Technical Params"};section={"ro": "Configurare", "en": "Configuration"}'),
    
    inputContext: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Context Input", "en": "Input Context"};section={"ro": "Execuție", "en": "Execution"}'),
    
    outputField: z.string().optional()
      .describe('ui:width=12;label={"ro": "Câmp Output", "en": "Output Field"};section={"ro": "Execuție", "en": "Execution"}'),
    
    category: z.string().optional()
      .describe('ui:width=6;label={"ro": "Categorie", "en": "Category"};section={"ro": "Organizare", "en": "Organization"}'),
    
    description: z.string().optional()
      .describe('ui:width=12;type=textarea;label={"ro": "Descriere", "en": "Description"};section={"ro": "General", "en": "General"}'),
    
    isLocked: z.boolean().default(false).optional()
      .describe('ui:width=6;label={"ro": "Blocat", "en": "Locked"};section={"ro": "Securitate", "en": "Security"}'),
  }),


  features: ['audit', 'timestamps'],
};
