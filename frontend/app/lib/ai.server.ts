/**
 * AI SERVER ENGINE - Isolated for Cloudflare Workers
 * No browser-only dependencies (socket.io, axios, etc.)
 */

let _registry: any = null;
export function initAiRegistry(registry: any) {
    _registry = registry;
}

// --- PROMPT MANAGER ---

export const PROMPT_MANAGER = {
    interpolate: (template: string, context: any) => {
        if (!template || typeof template !== 'string') return template;
        let result = template;
        Object.keys(context || {}).forEach(key => {
            const val = context[key];
            const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
            result = result.split(`{{${key}}}`).join(strVal);
        });
        return result;
    },
    getPrompt: async ({ db, registry, name, context = {} }: { db?: any, registry: any, name: string, context?: any }) => {
        const reg = registry || _registry;
        const prompts = reg?.AI_PROMPT || {};
        
        let systemPrompt = "";
        let userTemplate = "{{message}}";
        let model = "";

        // 1. Check System Prompts (Locked)
        const systemMatch = prompts.system?.find((p: any) => p.id === name || p.id === `${name}_system`);
        if (systemMatch) {
            systemPrompt = systemMatch.content;
            if (systemMatch.model) model = systemMatch.model;
        }

        // 2. Check Global Prompts
        const globalMatch = prompts.global?.find((p: any) => p.id === name);
        if (globalMatch) {
            userTemplate = globalMatch.content;
            if (globalMatch.model) model = globalMatch.model;
        }

        // 3. Check Workspace custom prompts
        const workspacePrompts = context.workspace_prompt || prompts.workspacePrompts || [];
        const wsMatch = workspacePrompts.find((p: any) => p.id === name || p.name === name);
        if (wsMatch) {
            userTemplate = wsMatch.content;
            if (wsMatch.model) model = wsMatch.model;
        }

        if (!systemPrompt) {
            systemPrompt = prompts[`${name}_system`] || 
                           prompts.systemPrompts?.[name] || 
                           prompts.systemPrompts?.default ||
                           "You are a helpful AI assistant.";
        }

        if (userTemplate === "{{message}}") {
            userTemplate = prompts[`${name}_user`] || 
                           prompts[name] ||
                           context.prompt || 
                           context.message || 
                           "{{message}}";
        }

        return {
            systemPrompt: PROMPT_MANAGER.interpolate(systemPrompt, context),
            prompt: PROMPT_MANAGER.interpolate(userTemplate, context),
            model: model || context.model
        };
    }
};

// --- BASE ENGINE ---

export class BaseAiEngine {
    config: any; fetch: any; logger: any; db: any; env: any;
    constructor(adapter: any = {}) {
        this.config = adapter.config || _registry?.AI_CONFIG || {};
        this.fetch = adapter.fetch || (typeof fetch !== 'undefined' ? fetch.bind(undefined) : null);
        this.logger = adapter.logger || console;
        this.db = adapter.db || null;
        this.env = adapter.env || {};
    }
    
    async chat(prompt: string, history: any[] = [], options: any = {}) {
        let providerName = options.provider;
        let modelId = options.model;

        if (!providerName && modelId && this.config.models) {
            const foundModel = this.config.models.find((m: any) => m.id === modelId);
            if (foundModel) providerName = foundModel.provider;
        }

        if (!providerName) {
            providerName = this.config.active_provider || 
                          (Array.isArray(this.config.activeProviders) ? this.config.activeProviders[0] : null) ||
                          this.config.defaultProvider;
        }

        const providerConfig = this.config.providers?.[providerName];
        if (!providerConfig) {
            throw new Error(`AI Provider "${providerName}" not found!`);
        }

        const model = modelId || (providerConfig.models && providerConfig.models[0]) || providerConfig.defaultModel || this.config.model;
        const apiKey = this.resolveApiKey(providerConfig);
        let url = (providerConfig.baseUrl || "").replace('{{model}}', model || "").replace('{{apiKey}}', apiKey || "").replace('{{accountId}}', providerConfig.accountId || this.env.CLOUDFLARE_ACCOUNT_ID || "");
        
        const type = providerConfig.type || (providerName === 'openai' || providerName === 'gemini' || url.includes('openai') ? 'openai-v1' : 
                                 providerName === 'anthropic' ? 'anthropic-v1' : 
                                 providerName === 'cloudflare' ? 'cloudflare-rpc' : 'openai-v1');

        const configWithKey = { ...providerConfig, apiKey };

        switch (type) {
            case 'google-v1beta': return await this.callGoogle(url, prompt, history, options, configWithKey);
            case 'openai-v1': return await this.callOpenAi(url, prompt, history, options, configWithKey, model);
            case 'anthropic-v1': return await this.callAnthropic(url, prompt, history, options, configWithKey, model);
            case 'cloudflare-rpc': return await this.callCloudflare(url, prompt, history, options, configWithKey);
            default: return await this.callOpenAi(url, prompt, history, options, configWithKey, model);
        }
    }

    resolveApiKey(p: any) {
        if (p.apiKey && !p.apiKey.startsWith('{{')) return p.apiKey;
        if (p.apiKeyEnvVar && this.env[p.apiKeyEnvVar]) return this.env[p.apiKeyEnvVar];
        return '';
    }

    async callOpenAi(url: string, prompt: string, history: any[], options: any, p: any, model: string) {
        const messages = [
            ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            ...history,
            { role: 'user', content: prompt }
        ];
        const body: any = { 
            model, 
            messages, 
            temperature: options.temperature ?? this.config.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? this.config.maxTokens ?? 2048
        };
        if (options.response_mime_type === 'application/json') body.response_format = { type: 'json_object' };

        const resp = await this.fetch(url + (url.endsWith('/') ? '' : '/') + 'chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.apiKey || ""}` },
            body: JSON.stringify(body)
        });
        const data = await resp.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return data.choices?.[0]?.message?.content || null;
    }

    async callGoogle(url: string, prompt: string, history: any[], options: any, p: any) {
        const contents = [{ role: 'user', parts: [{ text: (options.systemPrompt ? `${options.systemPrompt}\n\n` : '') + prompt }] }];
        const body = { 
            contents, 
            generationConfig: { 
                temperature: options.temperature ?? this.config.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens ?? this.config.maxTokens ?? 2048
            } 
        };
        const response = await this.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json(); return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    async callAnthropic(url: string, prompt: string, history: any[], options: any, p: any, model: string) {
        const body = { 
            model, 
            messages: [{ role: 'user', content: prompt }], 
            system: options.systemPrompt,
            temperature: options.temperature ?? this.config.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? this.config.maxTokens ?? 2048
        };
        const resp = await this.fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'x-api-key': p.apiKey, 'anthropic-version': '2023-06-01' }, 
            body: JSON.stringify(body) 
        });
        const data = await resp.json(); return data.content?.[0]?.text || null;
    }

    async callCloudflare(url: string, prompt: string, history: any[], options: any, p: any) {
        const response = await this.fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${p.apiToken || p.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'system', content: options.systemPrompt || "" }, { role: 'user', content: prompt }] }) });
        const data = await response.json(); return data.result?.response || data.result?.text || null;
    }

    extractJson(text: string) {
        if (!text) return null;
        const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (match) { try { return JSON.parse(match[0]); } catch (e) { } }
        return null;
    }
}

// --- AI SERVICE ---

export class AiService {
    private engine: BaseAiEngine;
    private config: any;
    constructor(env: any = {}, options: any = {}) {
        this.config = options.ai_config || _registry?.AI_CONFIG;
        this.engine = new BaseAiEngine({ config: this.config, fetch: options.fetch, db: options.db, env: env });
    }
    
    getAvailableModels() { return this.config?.models || []; }
    getActiveProviders() { return this.config?.activeProviders || []; }

    async chat(prompt: string, history: any[] = [], options: any = {}) { return this.engine.chat(prompt, history, options); }
    async getPrompt(db: any, name: string, context: any = {}) {
        const registry = { ..._registry, AI_CONFIG: this.config };
        return PROMPT_MANAGER.getPrompt({ db, registry, name, context });
    }
    async generate(message: string, options: any = {}, db: any = null) {
        const registry = { ..._registry, AI_CONFIG: this.config };
        const promptContext = await PROMPT_MANAGER.getPrompt({ db, registry, name: options.promptName || 'chat', context: { message, ...options } });
        const model = options.model || promptContext.model || this.config.model || (this.config.models?.[0]?.id);
        return this.chat(promptContext.prompt, options.history || [], { ...options, systemPrompt: promptContext.systemPrompt, model });
    }
    async extractEntities(text: string, schema: any, entityName: string, options: any = {}, db: any = null) {
        const registry = { ..._registry, AI_CONFIG: this.config };
        const promptConfig = await PROMPT_MANAGER.getPrompt({ db, registry, name: 'ENTITY_EXTRACTION', context: { entityName, schema: JSON.stringify(schema), text, lang: options.lang || registry?.DEFAULT_LANG } });
        const resp = await this.chat(promptConfig.prompt, [], { ...options, systemPrompt: promptConfig.systemPrompt, model: promptConfig.model || options.model, response_mime_type: 'application/json' });
        return this.engine.extractJson(resp);
    }
}
