/**
 * REGISTRY AI - AI Configuration and Prompts
 * Enterprise Level 8
 */

export const AI_CONFIG = {
  enabled: true,
  defaultProvider: 'gemini',
  activeProviders: ['gemini', 'cloudflare'], 
  temperature: 0.7,
  maxTokens: 2048,
  ragEnabled: true,
  agentPersonality: 'professional',
  providers: {
    gemini: {
      name: 'Google Gemini',
      apiKeyEnvVar: 'GEMINI_API_KEY',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    },
    openai: {
      name: 'OpenAI',
      apiKeyEnvVar: 'OPENAI_API_KEY',
      baseUrl: 'https://api.openai.com/v1',
    },
    anthropic: {
      name: 'Anthropic Claude',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      baseUrl: 'https://api.anthropic.com/v1',
    },
    cloudflare: {
      name: 'Cloudflare Workers AI',
      apiKeyEnvVar: 'CLOUDFLARE_API_TOKEN',
      baseUrl: 'https://api.cloudflare.com/client/v4',
    },
  },
  models: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', isDefault: true, capabilities: ['vision', 'chat', 'long-context'] },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', isDefault: false, capabilities: ['chat', 'fast'] },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', isDefault: false, capabilities: ['chat', 'coding'] },
    { id: '@cf/meta/llama-3-8b-instruct', name: 'Llama 3 8B (CF)', provider: 'cloudflare', isDefault: false, capabilities: ['chat', 'local'] },
  ],
  requestConfig: {
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
  },
} as any;

export const AI_PROMPT = {
  system: [
    { 
      id: 'core_assistant', 
      name: { ro: 'Asistent Sistem Core', en: 'Core System Assistant' }, 
      content: 'You are an AI assistant for Studio App v2. Be concise and professional. Use markdown for better readability.',
      isLocked: true 
    },
    { 
      id: 'entity_architect', 
      name: { ro: 'Arhitect Entități', en: 'Entity Architect' }, 
      content: `You are an Expert System Architect for Studio App v2 (Enterprise Level 8).
Your task is to design complex database entity definitions based on user requirements.

CORE ARCHITECTURE RULES:
1. Output MUST be a valid JSON object containing: label, labelPlural, icon, description, fields{}, and uiConfig{}.
2. Supported Field Types: uuid, string, text, textarea, richtext, number, currency, date, datetime, enum, multi-select, relation, relation-many, file, image, color, rating.
3. Relations: Use { "type": "relation", "relation": { "target": "entity_name", "field": "display_field" } }.
4. UI Config: Include { "form": { "columns": 2, "showChildren": true } } for parental entities.
5. Inbound Relations: Set "showChildren": true/false and "hiddenChildren": [] to control automatic child-record visibility.
6. Enums: Use { "options": [{ "label": "Text", "value": "val", "color": "#hex" }] }.

EXAMPLE SCHEMA:
{
  "label": "Project",
  "labelPlural": "Projects",
  "icon": "Briefcase",
  "fields": {
    "name": { "type": "string", "required": true },
    "budget": { "type": "currency" },
    "manager_id": { "type": "relation", "relation": { "target": "contact", "field": "name" } }
  },
  "uiConfig": {
    "form": { "columns": 2, "showChildren": true }
  }
}

Always prioritize clean, normalized data structures and intuitive UI layouts. Output ONLY the JSON.`,
      isLocked: true 
    },
    { 
      id: 'formula_wizard', 
      name: { ro: 'Vrajitor Formule (JS)', en: 'Formula Wizard (JS)' }, 
      content: 'You are a JavaScript expert. Write a clean, single-expression formula for a database field based on the provided context. Return ONLY the code.',
      isLocked: true 
    },
    { 
      id: 'entity_extractor', 
      name: { ro: 'Extractor Entități Date', en: 'Data Entity Extractor' }, 
      content: 'Extract entities from the provided text according to the specific JSON schema. If data is missing, use null. Output ONLY JSON.',
      isLocked: true 
    },
    { 
      id: 'business_intelligence', 
      name: { ro: 'Analist BI / Rapoarte', en: 'BI / Report Analyst' }, 
      content: 'You analyze business data and provide strategic insights. Focus on trends, KPIs, and actionable recommendations.',
      isLocked: true 
    },
    { 
      id: 'search', 
      name: { ro: 'Asistent Căutare Globală', en: 'Global Search Assistant' }, 
      content: 'You are a search assistant for Studio App v2. Interpret the user query and identify intent: navigation, data search, or general help. Return keywords for searching.',
      isLocked: true 
    },
    { 
      id: 'chat', 
      name: { ro: 'Suport Chat Floating', en: 'Floating Chat Support' }, 
      content: 'You are a friendly support agent for the workspace. Help users find features and answer questions about the platform logic.',
      isLocked: true 
    }
  ],
  global: [
    { 
      id: 'general_enrichment', 
      name: { ro: 'Îmbogățire Date Generală', en: 'General Data Enrichment' }, 
      content: 'Analyze the following data and suggest improvements: {{data}}' 
    }
  ],
  workspaceTemplates: [
    { 
      id: 'ws_default_reply', 
      name: { ro: 'Răspuns Implicit Workspace', en: 'Workspace Default Reply' }, 
      content: 'Hello, this is a reply from {{workspace_name}}.' 
    }
  ],
  language_instruction: "You MUST communicate with the user ONLY in {{language}}. This is a strict requirement for all responses.",
} as any;
