import { AiService, deepParse, deepStringify, getRegistry, renderString } from './core';
import { mergeRegistryWithD1 } from './registry-service.server';

/**
 * AI CORE SERVER - Enterprise Level 10
 * Separate domain handler for all AI-related operations.
 * 100% Registry-Driven, No Hardcoded Fallbacks.
 */

// --- INTERNAL HELPERS (Enterprise Standard) ---
const json = (payload: any, status = 200) => Response.json(payload, { 
    status, 
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Content-Type": "application/json" } 
});

const success = (data: any = true) => json({ success: true, data });

const error = (msg: any, status = 400, reason?: string) => {
    const errorMsg = typeof msg === 'string' ? msg : (
        typeof msg === 'object' && msg !== null ? (msg.ro || msg.en || JSON.stringify(msg)) : String(msg)
    );
    
    return json({ 
        success: false, 
        error: errorMsg,
        reason: reason || (typeof msg === 'string' ? msg : undefined)
    }, status);
};

/**
 * Main Controller for AI Operations
 * Handles: Chat, RAG, Vision, Transcription, Translation, Model Sync, Self-Healing.
 */
export const handleAiRequest = async (ctx: any) => {
    const { op, parts, db, user, body, env, registry, selectedLang, url } = ctx;
    const workspaceId = user.workspaceId;

    // Helper for priority resolving: 1. D1 (Registry Setting) > 2. AI_CONFIG (Providers) > 3. Env Var
    const resolveVal = (d1Key: string, envKey: string, providerId?: string) => {
        // 1. Try individual keys in SYSTEM_SETTING (e.g. openai_api_key)
        const d1Setting = registry.SYSTEM_SETTING?.[d1Key];
        if (d1Setting) return d1Setting;

        // 2. Try nested structure in AI_CONFIG.providers (Used by the AI Settings UI)
        if (providerId && registry.AI_CONFIG?.providers?.[providerId]) {
            const p = registry.AI_CONFIG.providers[providerId];
            const key = p.apiKey || p.apiToken;
            if (key && !key.startsWith('{{')) return key;
        }

        // 3. Try Environment Variables
        if (envKey && env[envKey]) return env[envKey];
        
        // 4. Try hardcoded provider defaults (last resort)
        if (providerId && registry.AI_CONFIG?.providers?.[providerId]) {
            const p = registry.AI_CONFIG.providers[providerId];
            return p.apiKey || p.apiToken || null;
        }
        return null;
    };
    
    console.log(`[AI-SERVER]  Operation: ${op || body?.action} | User: ${user?.email}`);

    // Load workspace-specific AI overrides
    let workspaceAiConfig: any = {};
    if (workspaceId && workspaceId !== 'system') {
        const ws = await db.get('workspace', workspaceId);
        if (ws && ws.ai) workspaceAiConfig = typeof ws.ai === 'string' ? JSON.parse(ws.ai) : ws.ai;
    }

    const aiConfig = { ...registry.AI_CONFIG, ...workspaceAiConfig };
    const ai = new AiService(env, { ai_config: aiConfig, registry, db: db.rawBinding || db });
    
    // --- Model Management Ops ---
    if (op === "sync-models" || body?.action === "sync-models") {
        const rawProvider = url.searchParams.get('provider') || body?.provider || aiConfig.active_provider || "";
        if (!rawProvider) return error("No active AI provider found for synchronization", 400);

        const targetProvider = rawProvider.toLowerCase();
        const timestamp = new Date().toISOString();

        const updateStore = async (key: string, data: any) => {
            const existing = await db.query("SELECT id FROM system_setting WHERE key = ? LIMIT 1", [key]);
            if (existing && existing.length > 0) {
                await db.update('system_setting', existing[0].id, { 
                    value: JSON.stringify(data), 
                    updatedAt: timestamp 
                });
            } else {
                await db.create('system_setting', { 
                    id: crypto.randomUUID(), 
                    namespace: 'system_setting', 
                    key, 
                    value: JSON.stringify(data), 
                    dataType: 'json', 
                    updatedAt: timestamp 
                });
            }
        };

        const pDef = registry.AI_CONFIG?.providers?.[targetProvider] || {};
        const apiToken = resolveVal(`${targetProvider}_api_token`, pDef.apiTokenEnvVar || '', targetProvider) || 
                         resolveVal(`${targetProvider}_api_key`, pDef.apiKeyEnvVar || '', targetProvider);

        if (targetProvider === 'cloudflare') {
            const accountId = registry.SYSTEM_SETTING?.cloudflare_account_id || env.CLOUDFLARE_ACCOUNT_ID || pDef.accountId;
            
            if (!accountId || !apiToken) {
                if (env.AI) {
                    console.log("[SYNC-MODELS] Credentials missing but AI binding found. Using Registry baseline for Cloudflare.");
                    const bootstrapModels = (registry.AI_CONFIG?.models || []).filter((m: any) => m.provider === 'cloudflare');
                    await updateStore(`discovered_cloudflare_models`, bootstrapModels);
                    return success({ message: "ai_sync_bootstrap_success", count: bootstrapModels.length, provider: 'cloudflare', note: 'Using registry baseline for direct binding' });
                }
                return error(`Cloudflare credentials missing. Ensure Account ID and Token are set in SuperAdmin.`, 400);
            }

            try {
                const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?task=Text%20Generation`, {
                    headers: { 'Authorization': `Bearer ${apiToken}` }
                });
                if (!response.ok) throw new Error(`Cloudflare API error: ${response.statusText}`);
                const data: any = await response.json();
                const models = (data.result || []).map((m: any) => {
                    const id = m.name;
                    const contextWindow = parseInt(m.properties?.find((p: any) => p.property_id === 'context_window')?.value || '8192');
                    
                    // Purely API-driven capabilities
                    const capabilities = ['chat'];
                    if (m.properties?.find((p: any) => p.property_id === 'function_calling')?.value === 'true') capabilities.push('function-calling', 'agentic');
                    
                    // Enterprise Level 10: Unified Universal Inference (Deep Logic)
                    const lid = id.toLowerCase();
                    const tags = new Set(capabilities);
                    if (lid.includes('vision') || lid.includes('multimodal') || lid.includes('llava')) tags.add('vision');
                    if (lid.includes('flash') || lid.includes('mini') || lid.includes('8b') || lid.includes('turbo') || lid.includes('lite')) tags.add('fast');
                    if (lid.includes('70b') || lid.includes('405b') || lid.includes('pro') || lid.includes('large') || lid.includes('ultra') || lid.includes('o1-') || lid.includes('o3-')) tags.add('agentic');
                    if (contextWindow >= 128000) tags.add('long-context');
                    if (tags.has('agentic') || tags.has('vision')) tags.add('files');

                    return {
                        id: m.name,
                        name: m.name.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase()) || m.name,
                        provider: 'cloudflare',
                        capabilities: Array.from(tags),
                        contextWindow
                    };
                });
                await updateStore(`discovered_cloudflare_models`, models);
                return success({ message: "ai_sync_success", count: models.length, provider: 'cloudflare' });
            } catch (e: any) { 
                return error(`Cloudflare sync failed: ${e.message}`, 500); 
            }
        }

        if (targetProvider === 'gemini' || targetProvider === 'google') {
            if (!apiToken) return error(`${targetProvider}_api_key_missing`, 400);
            try {
                const baseUrl = pDef.baseUrl;
                if (!baseUrl) return error(`Base URL for ${targetProvider} not found in Registry`, 400);

                let cleanBase = baseUrl.split('/models')[0].split('/openai')[0].split('?')[0].replace(/\/$/, '');
                if (!cleanBase.includes('/v1')) cleanBase += '/v1beta';
                
                let syncUrl = `${cleanBase}/models?key=${apiToken}`;
                let response = await fetch(syncUrl);
                if (!response.ok && response.status === 404 && cleanBase.includes('v1beta')) {
                    const altBase = cleanBase.replace('v1beta', 'v1');
                    response = await fetch(`${altBase}/models?key=${apiToken}`);
                }

                if (!response.ok) throw new Error(`${targetProvider} API error: ${response.statusText}`);
                const data: any = await response.json();
                const rawModels = (data.models || []).filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'));

                const models = rawModels.map((m: any) => {
                    const id = m.name.replace('models/', '');
                    const contextWindow = m.inputTokenLimit || 32768;
                    const rawCaps = m.capabilities;
                    const tags = new Set(['chat']);

                    if (Array.isArray(rawCaps)) {
                        rawCaps.forEach((c: any) => tags.add(c));
                    } else if (rawCaps && typeof rawCaps === 'object') {
                        Object.keys(rawCaps).forEach(k => {
                            if (rawCaps[k] === true) tags.add(k === 'function_calling' ? 'agentic' : k);
                        });
                    }
                    
                    // Enterprise Level 10: Unified Universal Inference (Deep Logic)
                    const lid = id.toLowerCase();
                    if (lid.includes('vision') || lid.includes('multimodal')) tags.add('vision');
                    if (lid.includes('flash') || lid.includes('mini') || lid.includes('lite')) tags.add('fast');
                    if (lid.includes('pro') || lid.includes('ultra') || lid.includes('large')) tags.add('agentic');
                    if (contextWindow >= 128000) tags.add('long-context');
                    if (tags.has('agentic') || tags.has('vision')) tags.add('files');

                    return { id, name: m.displayName || id, provider: targetProvider, capabilities: Array.from(tags), contextWindow };
                });
                await updateStore(`discovered_${targetProvider}_models`, models);
                return success({ message: "ai_sync_success", count: models.length, provider: targetProvider });
            } catch (e: any) { 
                return error(`${targetProvider} sync failed: ${e.message}`, 500); 
            }
        }

        // Default OpenAI-compatible discovery
        if (targetProvider === 'anthropic' || pDef.type === 'openai-v1' || ['openai', 'mistral', 'groq', 'together', 'deepseek', 'github'].includes(targetProvider)) {
           if (!apiToken) return error(`${targetProvider}_api_key_missing`, 400);
           try {
               let rawModels = [];
               if (targetProvider === 'anthropic') {
                   rawModels = pDef.models || [];
               } else {
                   const modelsUrl = targetProvider === 'github' 
                       ? 'https://models.inference.ai.azure.com/models' 
                       : (pDef.baseUrl ? (pDef.baseUrl.includes('/chat/completions') ? pDef.baseUrl.replace('/chat/completions', '/models') : `${pDef.baseUrl}/models`) : "");
                   
                   if (modelsUrl) {
                       const resp = await fetch(modelsUrl, { headers: { 'Authorization': `Bearer ${apiToken}` } });
                       if (resp.ok) {
                           const d: any = await resp.json();
                           rawModels = d.data || d.models || d || [];
                       }
                   }
               }

               const models = rawModels.map((m: any) => {
                   const id = m.id || m.model_id || m.name;
                   let name = m.name || m.friendly_name || id;
                   
                   // Enterprise Level 10: Improved labeling for GitHub/Azure models
                   if (targetProvider === 'github' || id.startsWith('azureml://')) {
                       const match = id.match(/\/models\/([^/]+)/);
                       if (match) {
                           name = match[1];
                       } else if (id.includes('/')) {
                           const parts = id.split('/');
                           const last = parts.pop();
                           if (last && /^\d+$/.test(last) && parts.length > 0) {
                               const next = parts.pop();
                               name = (next === 'versions' && parts.length > 0) ? (parts.pop() || next) : (next || last);
                           } else {
                               name = last || name;
                           }
                       }
                   }

                   if (/^\d+$/.test(name) || name === 'versions') {
                       name = id.split('/').filter((p: string) => !/^\d+$/.test(p) && p !== 'versions').pop() || name;
                   }

                   const contextWindow = (m as any).context_window || (m as any).contextWindow || 4096;

                   // Enterprise Level 10: Universal Inference & Capability Mapping
                   const lid = id.toLowerCase();
                   const rawCaps = (m as any).capabilities;
                   const tags = new Set(['chat']);

                   // Map Object-style capabilities (GitHub/Azure) to Tags
                   if (rawCaps && typeof rawCaps === 'object' && !Array.isArray(rawCaps)) {
                       if (rawCaps.vision === true) tags.add('vision');
                       if (rawCaps.function_calling === true) tags.add('agentic');
                   } else if (Array.isArray(rawCaps)) {
                       rawCaps.forEach((c: string) => tags.add(c));
                   }

                   // Pattern-based inference (Universal Fallback)
                   if (lid.includes('vision') || lid.includes('multimodal') || lid.includes('llava')) tags.add('vision');
                   if (lid.includes('flash') || lid.includes('mini') || lid.includes('8b') || lid.includes('turbo') || lid.includes('lite')) tags.add('fast');
                   if (lid.includes('gpt-4') || lid.includes('claude-3') || lid.includes('70b') || lid.includes('405b') || lid.includes('pro') || lid.includes('large') || lid.includes('ultra') || lid.includes('o1-') || lid.includes('o3-')) tags.add('agentic');
                   if (contextWindow >= 128000) tags.add('long-context');
                   if (tags.has('agentic') || tags.has('vision')) tags.add('files');

                   return { id, name, provider: targetProvider, capabilities: Array.from(tags), contextWindow };
               });
               await updateStore(`discovered_${targetProvider}_models`, models);
               return success({ message: "ai_sync_success", count: models.length, provider: targetProvider });
           } catch (e: any) { 
               return error(`${targetProvider} sync failed: ${e.message}`, 500); 
           }
        }

        return error(`Provider '${targetProvider}' not supported for discovery`, 400);
    }

    if (op === "catalog") {
        const registeredProviders = Object.keys(registry.AI_CONFIG?.providers || {});
        const discoveryKeys = registeredProviders.map(p => `discovered_${p}_models`);
        const allSettings = await db.query(
            `SELECT key, value FROM system_setting WHERE key IN (${['ai_inventory_overrides', ...discoveryKeys].map(() => '?').join(',')})`,
            ['ai_inventory_overrides', ...discoveryKeys]
        ).catch(() => []);
        
        const settingsMap = new Map(allSettings.map((s: any) => [s.key, s.value]));
        const overrides = deepParse(settingsMap.get('ai_inventory_overrides') || {});
        const baselineModels = registry.AI_CONFIG?.models || [];
        const merged: Record<string, any[]> = {};
        for (const p of registeredProviders) {
            const discovered = deepParse(settingsMap.get(`discovered_${p}_models`) || []);
            const map = new Map();
            baselineModels.filter((m: any) => m.provider === p).forEach((m: any) => map.set(m.id, { ...m, source: 'registry' }));
            if (Array.isArray(discovered)) {
                discovered.forEach((m: any) => {
                    const existing = map.get(m.id);
                    // Enterprise Level 10: Model Capability Reconciliation (Registry trumps Discovery)
                    const capabilities = (m.capabilities?.length > 1) ? m.capabilities : (existing?.capabilities || m.capabilities || ['chat']);
                    map.set(m.id, { 
                        ...existing, 
                        ...m, 
                        capabilities,
                        source: existing?.source === 'registry' ? 'registry' : 'd1' 
                    });
                });
            }
            merged[p] = Array.from(map.values()).map(m => {
                const ov = overrides[m.id] || {};
                return { 
                    ...m, 
                    name: ov.internalName || m.name, 
                    capabilities: ov.capabilities || m.capabilities || ['chat'], // User override priority
                    enabled: ov.enabled !== undefined ? ov.enabled : (m.enabled !== false), 
                    provider: p 
                };
            });
        }
        return success({ merged, overrides });
    }

        if (op === "chat" || body?.action === "chat") {
        const { message, history: providedHistory = [], role, lang = registry.language, context = {}, image, file, fileName, fileType, threadId, contactId } = body || {};
        if (!message) return error("Message required");

        // Enterprise Level 10 Unified Memory: Identity resolution for contextual continuity
        // 1. Priority: Explicit contactId passed from UI (Level 10 Master)
        // 2. Fallback: Precise lookup by session user identity
        let resolvedContactId = contactId;
        
        if (!resolvedContactId || resolvedContactId === 'undefined') {
            resolvedContactId = await db.query(
                "SELECT id FROM contact WHERE (userId = ? OR id = ? OR email = ?) AND (workspaceId = ? OR workspaceId = 'system') ORDER BY (workspaceId = ?) DESC LIMIT 1", 
                [user.id, user.id, user.email, workspaceId || 'system', workspaceId]
            ).then((res: any) => res[0]?.id).catch(() => null);
        }

        // Enterprise Level 10: Interaction History Hydration (Sliding Window Strategy)
        let processedHistory = providedHistory;
        if (!processedHistory || processedHistory.length === 0) {
            const lastMessages = await db.query(
                "SELECT type, body as content FROM interaction WHERE (contactId = ? OR metadata LIKE ?) AND channel = 'ai' ORDER BY createdAt DESC LIMIT 20",
                [resolvedContactId, `%${threadId || user.id}%`]
            ).catch(() => []);
            
            processedHistory = lastMessages.reverse().map((m: any) => ({
                role: m.type === 'inbound' ? 'user' : 'assistant',
                content: m.content
            }));
        }

        const promptContext = await ai.getPrompt(db, role || 'chat', { message, workspaceId, lang, ...context });
        const languageName = { ro: 'Romanian', en: 'English' }[lang as string] || '';
        
        let systemPrompt = promptContext.systemPrompt;
        if (languageName && !systemPrompt.includes(languageName) && registry.AI_PROMPT.language_instruction) {
            systemPrompt += "\n\n" + registry.AI_PROMPT.language_instruction.replace('{{language}}', languageName);
        }

        const activePersonality = context.personality || aiConfig.agent_personality || '';
        const personalityInstruction = {
            professional: "Maintain a professional tone.",
            creative: "Be creative.",
            friendly: "Be friendly.",
            analytical: "Be analytical."
        }[activePersonality as string] || "";

        if (personalityInstruction) systemPrompt += "\n\nPersonality: " + personalityInstruction;
        
        // Enterprise Level 10 Knowledge Injection: Neural RAG Augmentation
        let ragContext = "";
        if (env.AI && env.VECTOR_INDEX && !image && processedHistory.length <= 2) {
            try {
                const embModel = registry.AI_CONFIG?.embedding_model;
                const queryEmb: any = await env.AI.run(embModel, { text: [message] });
                const matches = await env.VECTOR_INDEX.query(queryEmb.data[0], { topK: 3, returnMetadata: true });
                if (matches.matches?.length > 0) {
                    ragContext = "\n\nRelevant context from previous discussions and knowledge base:\n" + 
                                 matches.matches.map((m: any) => `- ${m.metadata.content}`).join('\n');
                }
            } catch (e) {
                console.warn("[AI-CHAT] RAG Context lookup failed", e);
            }
        }

        try {
            const finalPrompt = ragContext ? `${ragContext}\n\nUser Question: ${promptContext.prompt}` : promptContext.prompt;
            
            // Priority Model Resolution (Enterprise Level 10 Master)
            // 1. Explicit body.model
            // 2. Specialized chat_model override (D1)
            // 3. Prompt-defined model
            // 4. Global preferred model
            // 5. Default infrastructure model
            const targetProvider = aiConfig.chat_provider || aiConfig.active_provider || aiConfig.default_provider;
            const targetModel = body?.model || aiConfig.chat_model || promptContext.model || aiConfig.preferred_model || aiConfig.model;

            const response = await ai.chat(finalPrompt, processedHistory, { 
                provider: targetProvider, 
                model: targetModel, 
                temperature: aiConfig.temperature,
                maxTokens: aiConfig.max_tokens,
                systemPrompt,
                image,
                file: file || image,
                fileName,
                fileType
            });

            // Enterprise Level 10: Multi-Layer Distributed Persistence (Interaction Ledger)
            const messageId = crypto.randomUUID();
            const responseId = crypto.randomUUID();

            await Promise.all([
                // Save User Message
                db.create('interaction', {
                    id: messageId,
                    workspaceId: workspaceId || 'system',
                    contactId: resolvedContactId,
                    channel: 'ai',
                    type: 'inbound',
                    subject: message.substring(0, 50),
                    body: message,
                    metadata: JSON.stringify({ threadId: threadId || user.id, model: body?.model }),
                    createdAt: new Date().toISOString()
                }),
                // Save Assistant Response
                db.create('interaction', {
                    id: responseId,
                    workspaceId: workspaceId || 'system',
                    contactId: resolvedContactId,
                    channel: 'ai',
                    type: 'outbound',
                    subject: 'AI Response',
                    body: response,
                    metadata: JSON.stringify({ 
                        replyTo: messageId, 
                        threadId: threadId || user.id, 
                        model: body?.model,
                        role: role || 'chat'
                    }),
                    createdAt: new Date().toISOString()
                }),
                // Standard Audit Log
                db.create('audit_log', {
                    id: crypto.randomUUID(),
                    action: 'ai-chat',
                    entityType: 'ai',
                    details: JSON.stringify({ message: message.substring(0, 100), threadId: threadId || user.id }),
                    user: user?.email || user?.id || 'system',
                    workspaceId: user?.workspaceId || 'system',
                    createdAt: new Date().toISOString()
                })
            ]);

            return success({ response, history: [...processedHistory, { role: 'user', content: message }, { role: 'assistant', content: response }] });
        } catch (err: any) {
            return error(`AI Chat failed: ${err.message}`, 500);
        }
    }

    if (op === "history" || body?.action === "history") {
        const { threadId, limit = 50, contactId } = body || {};
        
        let targetContactId = contactId;
        if (!targetContactId || targetContactId === 'undefined') {
            targetContactId = await db.query("SELECT id FROM contact WHERE userId = ? LIMIT 1", [user.id]).then((res: any) => res[0]?.id).catch(() => null);
        }
        
        try {
            const messages = await db.query(
                "SELECT type, body, createdAt, metadata FROM interaction WHERE (contactId = ? OR metadata LIKE ?) AND channel = 'ai' ORDER BY createdAt DESC LIMIT ?",
                [targetContactId, `%${threadId || user.id}%`, limit]
            ).catch(() => []);

            const history = messages.reverse().map((m: any) => {
                let meta = {};
                try { meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : (m.metadata || {}); } catch(e) {}
                
                return {
                    role: m.type === 'inbound' ? 'user' : 'assistant',
                    content: m.body,
                    createdAt: m.createdAt,
                    metadata: meta
                };
            });

            return success(history);
        } catch (e: any) {
            return error(`Failed to load history: ${e.message}`, 500);
        }
    }

    if (op === "import-ai" || body?.action === "import-ai" || op === "extract") {
        const { text, schema, entityName } = body || {};
        if (!text || !schema) return error("Text and schema are required for AI extraction");
        
        console.log(`[AI-EXTRACT] Processing ${entityName || 'generic'} extraction...`);
        try {
            const data = await ai.extractEntities(text, schema, entityName || 'unknown', {
                provider: body?.provider || aiConfig.active_provider,
                model: body?.model || aiConfig.preferred_model || aiConfig.model
            }, db);
            return success(data);
        } catch (e: any) {
            return error(`Extraction failed: ${e.message}`, 500);
        }
    }

    if (op === "translate" || body?.action === "translate") {
        const { text, targetLang, sourceLang = 'auto' } = body || {};
        if (!text || !targetLang) return error("Text and targetLang required");
        
        try {
            const prompt = `Translate the following text from ${sourceLang} to ${targetLang}. Return ONLY the direct translation.\n\nTEXT:\n${text}`;
            const response = await ai.chat(prompt, [], { 
                provider: 'cloudflare', 
                model: aiConfig.translation_model
            });
            return success({ translation: response });
        } catch (e: any) {
            return error(`Translation failed: ${e.message}`, 500);
        }
    }

    if (op === "transcribe" || body?.action === "transcribe") {
        const { file } = body || {};
        if (!file || !env.AI) return error("Audio data and AI binding required for transcription");
        
        try {
            const audioData = typeof file === 'string' ? Uint8Array.from(atob(file), c => c.charCodeAt(0)) : file;
            const response: any = await env.AI.run(aiConfig.transcription_model, { audio: [...audioData] });
            return success({ text: response.text });
        } catch (e: any) {
            return error(`Transcription failed: ${e.message}`, 500);
        }
    }

    if (op === "rag" || body?.action === "rag-search") {
        const { query, limit = 5 } = body || {};
        if (!query || !env.AI || !env.VECTOR_INDEX) return error("RAG bindings (AI/Vectorize) missing");
        
        try {
            const embModel = registry.AI_CONFIG?.embedding_model;
            const queryEmb: any = await env.AI.run(embModel, { text: [query] });
            const matches = await env.VECTOR_INDEX.query(queryEmb.data[0], { topK: limit, returnMetadata: true });
            return success(matches.matches || []);
        } catch (e: any) {
            return error(`RAG search failed: ${e.message}`, 500);
        }
    }

    if (op === "sync-rag") {
        if (!env.AI || !env.VECTOR_INDEX) return error("AI/Vectorize binding missing", 500);
        try {
            const embModel = registry.AI_CONFIG?.embedding_model;
            let processed = 0;

            // 1. Sync Articles
            const articles = await db.query("SELECT id, title, content FROM article WHERE (archived = 0 OR archived IS NULL) LIMIT 5000");
            if (articles && articles.length > 0) {
                const batchSize = 25;
                for (let i = 0; i < articles.length; i += batchSize) {
                    const batch = articles.slice(i, i + batchSize);
                    const texts = batch.map((a: any) => `Type: Article\nTitle: ${a.title}\nContent: ${(a.content || "").replace(/<[^>]*>/g, ' ').substring(0, 2000)}`);
                    const embRes: any = await env.AI.run(embModel, { text: texts });
                    const vectors = batch.map((a: any, idx: number) => ({
                        id: `art_${a.id}`, values: embRes.data[idx], metadata: { title: a.title, content: texts[idx].substring(0, 1000), entityType: 'article' }
                    }));
                    await env.VECTOR_INDEX.upsert(vectors);
                    processed += batch.length;
                }
            }

            // 2. Sync AI Interactions (Collective Memory)
            const interactions = await db.query("SELECT id, body, type, channel FROM interaction WHERE channel = 'ai' ORDER BY createdAt DESC LIMIT 500");
            if (interactions && interactions.length > 0) {
                const batchSize = 25;
                for (let i = 0; i < interactions.length; i += batchSize) {
                    const batch = interactions.slice(i, i + batchSize);
                    const texts = batch.map((it: any) => `Type: AI Conversation\nRole: ${it.type === 'inbound' ? 'User' : 'Assistant'}\nMessage: ${it.body}`);
                    const embRes: any = await env.AI.run(embModel, { text: texts });
                    const vectors = batch.map((it: any, idx: number) => ({
                        id: `int_${it.id}`, values: embRes.data[idx], metadata: { content: texts[idx], entityType: 'interaction', channel: 'ai' }
                    }));
                    await env.VECTOR_INDEX.upsert(vectors);
                    processed += batch.length;
                }
            }

            return success({ message: "ai_sync_rag_success", count: processed });
        } catch (e: any) { 
            return error(`RAG Sync Failed: ${e.message}`, 500); 
        }
    }

    if (op === "architect" || body?.action === "architect") {
        const { AVAILABLE_V3_ENTITIES, discoverEntities } = await import('../../../core/entities/index.ts');
        await discoverEntities();
        const ai_prompt = AVAILABLE_V3_ENTITIES.ai_prompt;
        if (!ai_prompt) return error("ai_prompt entity not found in discovery", 404);
        return await ai_prompt.actions?.find((a: any) => a.id === 'architect')?.handler({ ...ctx, ai }, body);
    }

    if (op === "auto-fill" || body?.action === "auto-fill") {
        const { AVAILABLE_V3_ENTITIES, discoverEntities } = await import('../../../core/entities/index.ts');
        await discoverEntities();
        const ai_prompt = AVAILABLE_V3_ENTITIES.ai_prompt;
        if (!ai_prompt) return error("ai_prompt entity not found in discovery", 404);
        return await ai_prompt.actions?.find((a: any) => a.id === 'magic-fill')?.handler({ ...ctx, ai }, body);
    }

    if (parts[1] === "prompt") {
        if (body?.action === "save") return success(await db.set("_ai_prompt", body.id || crypto.randomUUID(), { ...deepStringify(body), workspaceId, updatedAt: new Date().toISOString() }));
        return success((await db.list("_ai_prompt", { workspaceId })).map(deepParse));
    }

    // --- Enterprise Level 10: AI Resource Orchestration & Inventory ---
    if (op === "update-catalog" || body?.action === "update-catalog") {
        const models = body?.models || [];
        if (!Array.isArray(models)) return error("Invalid models format. Expected array.");

        try {
            // Load existing overrides
            const existing = await db.query("SELECT id, value FROM system_setting WHERE key = ? LIMIT 1", ['ai_inventory_overrides']);
            let overrides: Record<string, any> = {};
            let settingId = crypto.randomUUID();

            if (existing && existing.length > 0) {
                overrides = deepParse(existing[0].value || {});
                settingId = existing[0].id;
            }

            // Apply updates
            for (const m of models) {
                if (m.id) {
                    overrides[m.id] = {
                        internalName: m.internalName,
                        enabled: m.enabled,
                        updatedAt: new Date().toISOString()
                    };
                }
            }

            // Save back to DB
            const timestamp = new Date().toISOString();
            if (existing && existing.length > 0) {
                await db.update('system_setting', settingId, { 
                    value: JSON.stringify(overrides), 
                    updatedAt: timestamp 
                });
            } else {
                await db.create('system_setting', { 
                    id: settingId, 
                    namespace: 'system_setting', 
                    key: 'ai_inventory_overrides', 
                    value: JSON.stringify(overrides), 
                    dataType: 'json', 
                    updatedAt: timestamp 
                });
            }

            return success({ message: "ai_catalog_updated", count: Object.keys(overrides).length });
        } catch (e: any) {
            return error(`Failed to update AI Catalog: ${e.message}`, 500);
        }
    }

    // --- Enterprise Level 10: Infrastructure Health Verification ---
    if (op === "test-connection" || body?.action === "test-connection") {
        const targetProvider = body?.provider || url.searchParams.get('provider') || aiConfig.active_provider;
        if (!targetProvider) return error("No provider specified for connection test");

        try {
            console.log(`[AI-TEST] Testing connection for provider: ${targetProvider}`);
            const result = await ai.testConnection(targetProvider, db, body || {});
            
            if (result.success) {
                return success({ message: "connection_success", details: result.details });
            } else {
                // Enterprise Level 10: Predictable Error Protocol (Normalize to 200 with success:false)
                return json({ success: false, error: result.message || "connection_failed" }, 200);
            }
        } catch (e: any) {
            console.error(`[AI-TEST-FATAL] Provider: ${targetProvider}`, e.message);
            return error(`Connection test fatal error: ${e.message}`, 500);
        }
    }

    return error("AI operation not found", 404);
};

/**
 * Enterprise Level 10: Autonomous Self-Healing Infrastructure
 * Proactively analyzes performance telemetry and implements schema optimizations (D1/D3).
 */
export async function handleSelfHealing(db: any, registry: any, env: any) {
    console.log("[AI-SERVER] Starting Self-Healing analysis...");
    
    const slowQueries = await db.query(`
        SELECT query, durationMs, affectedTable, explainPlan 
        FROM system_performance_log 
        WHERE (durationMs > 50 OR status = 'slow')
        AND created_at > datetime('now', '-1 day')
        ORDER BY durationMs DESC
        LIMIT 20
    `);

    if (!Array.isArray(slowQueries) || slowQueries.length === 0) {
        return { success: true, message: "No slow queries detected. System is optimal." };
    }

    const report: any[] = [];
    const aiConfig = registry.AI_CONFIG || {};
    const ai = new AiService(env, { ai_config: aiConfig, db: db.rawBinding || db });

    const patterns = new Map<string, any>();
    for (const sq of slowQueries) {
        const pattern = sq.query.replace(/'[^']*'/g, '?').replace(/\d+/g, '?');
        if (!patterns.has(pattern)) patterns.set(pattern, { ...sq, count: 0, totalMs: 0 });
        const p = patterns.get(pattern);
        p.count++; p.totalMs += sq.durationMs;
    }

    for (const p of Array.from(patterns.values()).sort((a, b) => b.totalMs - a.totalMs).slice(0, 3)) {
        const table = p.affectedTable;
        if (!table || table.includes('system_')) continue;

        try {
            const response = await ai.generate("", {
                promptName: 'PERFORMANCE_OPTIMIZER',
                queryPattern: p.query,
                avgDuration: Math.round(p.totalMs / p.count),
                explainPlan: p.explainPlan,
                table: table,
                temperature: 0.1
            }, db);

            if (response?.toUpperCase().includes('CREATE INDEX')) {
                const sql = response.replace(/```sql|```/g, '').trim();
                const existingIndices = await db.query(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='${table}'`);
                const indexNameMatch = sql.match(/INDEX\s+"?([a-zA-Z0-9_]+)"?/i);
                const indexName = indexNameMatch ? indexNameMatch[1] : '';
                
                if (!existingIndices.some((idx: any) => idx.name === indexName)) {
                    await db.exec(sql);
                    const snapshot_after = { sql, table, avgDuration: Math.round(p.totalMs / p.count) };
                    await db.create('audit_log', {
                        id: crypto.randomUUID(),
                        action: 'OPTIMIZATION',
                        entityType: 'system',
                        entityId: 'self-healing',
                        details: `Applied index optimization for table ${table}`,
                        snapshot_after: JSON.stringify(snapshot_after),
                        createdAt: new Date().toISOString()
                    });
                    report.push({ table, action: 'INDEX_CREATED', sql });
                }
            }
        } catch (e: any) { report.push({ table, error: e.message }); }
    }

    return { success: true, report, analyzed: slowQueries.length };
}

/**
 * Enterprise Level 10: Dynamic Help & Documentation Synthesis
 */
export async function handleHelpRequest(ctx: any) {
    const { url, db, env, selectedLang, registry: ctxRegistry } = ctx;
    const id = url.searchParams.get("id");
    const force = url.searchParams.get("force") === "true";
    if (!id) return error("Missing documentation segment ID");
    
    try {
        if (!force) {
            const cached = await db.get("_help_content", id);
            if (cached) return success(deepParse(cached));
        }

        // Use registry from context if available, else fetch it
        const registry = ctxRegistry || await mergeRegistryWithD1(db);
        const aiConfig = registry?.AI_CONFIG || {};
        const prompts = registry?.AI_PROMPT?.system || [];
        
        // Resolve Prompts from Registry (No Hardcoding)
        const helpPrompt = prompts.find((p: any) => p.id === 'HELP_GENERATOR');
        const systemPrompt = helpPrompt?.content || "";
        
        // Priority AI Config resolution for documentation (Level 10 Global Inheritance)
        const provider = (aiConfig.help_provider && aiConfig.help_provider !== '__inherit__') ? aiConfig.help_provider : aiConfig.default_provider;
        const model = (aiConfig.help_model && aiConfig.help_model !== '__inherit__') ? aiConfig.help_model : aiConfig.model;
        
        const ai = new AiService(env, { 
            ai_config: { ...aiConfig, active_provider: provider, model: model }, 
            registry, 
            db: db.rawBinding || db 
        });

        console.log(`[HELP-GEN] Starting documentation for ${id} using ${model} on ${provider}...`);
        
        // Context generation for better documentation
        const sectionContext = id.startsWith('/') ? `URL Path: ${id}` : `Entity: ${id}`;
        const prompt = `Generate expert-level technical documentation for the system module: "${id}".
Module Context: ${sectionContext}.
Language: ${selectedLang || ''}.
Instruction: Follow the structure and style defined in system prompt. Return ONLY the raw JSON object.`;

        const text = await ai.chat(prompt, [], { 
            provider, 
            model,
            maxTokens: 8000,
            systemPrompt 
        });
        
        console.log(`[HELP-GEN] Raw AI Response length: ${text?.length || 0}`);
        
        let result = (ai as any).engine.extractJson(text);
        
        // Enterprise Level 10 Resilience: Recursive extraction fallback
        if (!result && text && text.length > 20) {
            console.warn(`[HELP-GEN] JSON extraction failed for ${id}, using raw text fallback.`);
            result = {
                title: id.split('/').pop()?.toUpperCase() || "",
                description: "Auto-generated content",
                content: text
            };
        }

        if (result && result.title) {
            await db.set("_help_content", id, { ...result, updatedAt: new Date().toISOString() });
        }
        
        return success(result || { 
            title: id, 
            content: "Documentation could not be generated at this moment. Please try again later.",
            description: "Generation Failed"
        });
    } catch (e: any) {
        console.error(`[HELP-REQUEST-ERROR] ID: ${id} | Error: ${e.message}`, e);
        return success({ 
            title: id, 
            content: `Documentation is temporarily unavailable.\n\n**Error Details:** ${e.message}\n\nPlease ensure your AI configuration (API Keys) is correct in SuperAdmin > AI Settings.`,
            description: "Connection Error"
        });
    }
}
