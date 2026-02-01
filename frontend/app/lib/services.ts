/**
 * SERVICES LAYER - SSOT
 * Merged from ai-engine, prompt-manager, api-client, socket, core-services
 */

import axios from 'axios';
import { io, type Socket } from "socket.io-client";
import { XMLParser } from 'fast-xml-parser';

const logger = console;

let _registry: any = null;
let DISABLE_SOCKET_BY_REGISTRY = false;

export function initRegistry(registry: any) {
    _registry = registry;
    
    // Enterprise Level 8: Update DISABLE_SOCKET_BY_REGISTRY flag based on Registry setting
    const newDisableState = registry?.SYSTEM_SETTING?.use_local_agent === false;
    if (newDisableState !== DISABLE_SOCKET_BY_REGISTRY) {
        DISABLE_SOCKET_BY_REGISTRY = newDisableState;
        if (DISABLE_SOCKET_BY_REGISTRY && socket.connected) {
            console.log('[SOCKET] Local Agent disabled in Registry, disconnecting...');
            socket.disconnect();
            whatsappSocket.disconnect();
        }
    }
    
    // Level 8: Dynamic Socket Re-alignment (only if Local Agent is enabled)
    if (!DISABLE_SOCKET_BY_REGISTRY) {
        const newUrl = getLocalAgentUrl();
        if (isBrowser && newUrl && socket && (socket as any).io) {
            if ((socket as any).io.uri !== newUrl) {
                console.log(`[SOCKET] Re-aligning to Registry URL: ${newUrl}`);
                (socket as any).io.uri = newUrl;
                if (whatsappSocket && (whatsappSocket as any).io) {
                    (whatsappSocket as any).io.uri = `${newUrl}/whatsapp`;
                }
            }
        }
    }
}

// --- SOCKET.IO ---

const isBrowser = typeof window !== 'undefined' && !(window as any).__is_shim;

export const getLocalAgentUrl = () => {
    const env = (import.meta as any).env || {};
    
    // 1. Try from Environment Variables
    const envUrl = env.VITE_SOCKET_URL || env.VITE_LOCAL_API_URL;
    if (envUrl) return envUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    
    // 2. Local-First Preference: Leverage Vite Proxy (Enterprise Architecture)
    // If we are on a dev machine, return the current origin so the request goes
    // through the Vite Proxy (port 8788) which then forwards to Backend V2 (port 4001).
    // This avoids direct port 4001 access which often hits firewall blocks on Windows.
    if (isBrowser) {
        const { hostname, origin } = window.location;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.endsWith('.local');
        if (isLocal) {
            return origin; 
        }
    }

    // 3. Try from Registry (The Brain's Configuration) - Level 8 Preference
    const registryUrl = _registry?.SYSTEM_SETTING?.local_agent_url || _registry?.local_agent_url;
    if (registryUrl) {
        return registryUrl.replace(/\/$/, '');
    }

    // 4. Fallback to intelligent detection
    const PORT = _registry?.SYSTEM_SETTING?.local_agent_port || _registry?.local_agent_port || 4001;

    if (isBrowser) {
        const { hostname, protocol } = window.location;
        
        // 1. Domain mapping for Local/Dev (localhost, 127.0.0.1, internal IPs)
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.') || hostname.endsWith('.local');
        if (isLocal) {
            // Enterprise Level 8: Always use Proxy-First approach for Local/Dev
            // This ensures we pass through Vite's proxy (port 8788) which is already mapped to Backend V2
            return origin;
        }

        // 2. Enterprise Fallback: If we are on public domain and have NO registry yet,
        // we should NOT default to current domain for Socket.IO as Cloudflare Workers don't support it.
        // Instead, we try localhost:PORT as a guess that the user has the agent on their PC.
        const isPublic = !isLocal;
        if (isPublic && !_registry) {
            // Use http for localhost even if on https, typically handled by browser exceptions or local certs
            return `http://localhost:${PORT}`;
        }
        
        // 3. Same domain fallback (only if registry didn't give us anything else)
        return `${protocol}//${hostname}`;
    }
    return env.DEV ? `http://127.0.0.1:${PORT}` : '';
};

let SOCKET_URL = isBrowser ? getLocalAgentUrl() : '';

const getSocketAuth = () => {
    // Pass namespace based on context, or default to root
    if (isBrowser) {
        const token = localStorage.getItem("token");
        const email = localStorage.getItem("userEmail");
        return token ? { token, email } : { email };
    }
    return {};
};

const mockSocket: any = { on: () => { }, off: () => { }, emit: () => { }, connect: () => { }, disconnect: () => { }, connected: false, once: () => { } };

// Enterprise Level 8: Check if Local Agent is explicitly disabled
let DISABLE_SOCKET = false; 

// Implementation: We might need separate sockets for namespaces /whatsapp, /gmail
// For backward compatibility, we connect to root '/' but we also need '/whatsapp'
// The current frontend code expects `socket.on('whatsapp:qr')` on the MAIN socket.
// But the Local Agent emits on `/whatsapp` namespace.
// We should bridge this or update the frontend to use namespaces.
// For now, let's keep it simple: Local Agent should allow connecting to '/' and listen for all events if possible, OR we update Frontend to use namespaces.

// DECISION: Update Frontend to use namespaced sockets would be cleaner but requires touching many file.
// EASIER: Create a specialized Socket proxy that handles namespaces transparently?
// OR: Just expose the root socket and have Local Agent re-emit events from namespaces to root? -> No, Socket.IO namespaces are strict.
//
// Let's create a 'whatsappSocket' export here.

export const socket: Socket = (isBrowser && !DISABLE_SOCKET && !DISABLE_SOCKET_BY_REGISTRY && SOCKET_URL)
    ? io(SOCKET_URL, { 
        path: "/api/socket.io", 
        autoConnect: false, 
        reconnection: true, 
        reconnectionAttempts: 1, // Enterprise Level 8: Stop spamming if the agent is not present
        reconnectionDelay: 10000, 
        auth: getSocketAuth(),
        timeout: 2000 // Short timeout for faster failover
    })
    : mockSocket as Socket;

// WhatsApp Namespace Socket
export const whatsappSocket: Socket = (isBrowser && !DISABLE_SOCKET && !DISABLE_SOCKET_BY_REGISTRY && SOCKET_URL)
    ? io(`${SOCKET_URL}/whatsapp`, { 
        path: "/api/socket.io", 
        autoConnect: false, 
        reconnection: true, 
        reconnectionAttempts: 1, 
        auth: getSocketAuth(),
        timeout: 2000
    })
    : mockSocket as Socket;

// Proxy 'whatsapp:*' events on the main `socket` to `whatsappSocket` for backward compatibility
if (isBrowser && !DISABLE_SOCKET) {
    const originalOn = socket.on.bind(socket);
    const originalEmit = socket.emit.bind(socket);
    const originalOff = socket.off.bind(socket);

    // Intercept .on('whatsapp:...')
    (socket as any).on = (event: string, ...args: any[]) => {
        if (event.startsWith('whatsapp:')) {
            // Map 'whatsapp:qr' -> 'qr' on whatsappSocket
            const newEvent = event.replace('whatsapp:', '');
            return (whatsappSocket as any).on(newEvent, ...args);
        }
        return (originalOn as any)(event, ...args);
    };

    (socket as any).off = (event: string, ...args: any[]) => {
        if (event.startsWith('whatsapp:')) {
            const newEvent = event.replace('whatsapp:', '');
            return (whatsappSocket as any).off(newEvent, ...args);
        }
        return (originalOff as any)(event, ...args);
    };

    (socket as any).emit = (event: string, ...args: any[]) => {
        if (event.startsWith('whatsapp:')) {
             const newEvent = event.replace('whatsapp:', '');
             return (whatsappSocket as any).emit(newEvent, ...args);
        }
        return (originalEmit as any)(event, ...args);
    };
}


export function socketRequest(event: string, data: any = {}): Promise<any> {
    // Enterprise Level 8: Brain Fallback for system and common data events
    // This allows the app to work even if the Local Agent is not running.
    if (event.startsWith('system:') || event.startsWith('registry:') || event.startsWith('workspace:') || event.startsWith('monitoring:')) {
        const parts = event.split(':');
        const resource = parts[0];
        const op = parts.slice(1).join('/');
        
        const isWrite = event.includes(':update') || event.includes(':save') || event.includes(':set-') || event.includes(':delete') || event.includes(':toggle') || event.includes(':sync');
        const method = isWrite ? 'post' : 'get';
        const url = `${resource}/${op}`;

        // Enterprise Level 8: Only attempt Brain fallback if we have a token
        const hasToken = isBrowser && !!localStorage.getItem('token');

        if (hasToken) {
            return new Promise((resolve) => {
                const apiCall = isWrite ? api.brain.post(url, data) : api.brain.get(url, { params: data });
                
                apiCall.then((res: any) => {
                    if (res && res.success !== false) {
                        resolve(res);
                    } else {
                        // Level 8: Only fallback to socket if Agent is enabled in Registry
                        if (_registry?.SYSTEM_SETTING?.use_local_agent) {
                            socket.emit(event, data, (socketRes: any) => resolve(socketRes));
                        } else {
                            resolve(res);
                        }
                    }
                }).catch((err: any) => {
                    // Level 8: Only fallback to socket if Agent is enabled in Registry
                    if (_registry?.SYSTEM_SETTING?.use_local_agent) {
                        console.warn(`[SERVICES] Brain API fallback for ${event} failed (${err.message}). Trying socket...`);
                        socket.emit(event, data, (socketRes: any) => resolve(socketRes));
                    } else {
                        console.error(`[SERVICES] Request for ${event} failed: ${err.message}`);
                        resolve({ success: false, error: err.message });
                    }
                });
            });
        }
    }

    return new Promise((resolve, reject) => {
        // Level 8: Block direct socket requests if the agent is disabled
        if (_registry && _registry.SYSTEM_SETTING && _registry.SYSTEM_SETTING.use_local_agent === false) {
            return reject(new Error('LOCAL_AGENT_DISABLED'));
        }

        // We removed the warning here to support L8 lazy connection (managed by AuthProvider)
        const timeout = setTimeout(() => reject(new Error(`Socket timeout: ${event}`)), 10000);
        socket.emit(event, data, (res: any) => {
            clearTimeout(timeout);
            if (res && res.error) reject(new Error(res.error));
            else resolve(res);
        });
    });
}

// --- API CLIENT ---

const isProd = typeof window !== 'undefined' && window.location.hostname === 'service.aemdpc.ro';

// In production and dev, use the internal /api/ route (The Brain / Cloudflare Worker)
// We only use the Local Agent for specific local/hardware task via api.local
export const getBrainApiUrl = () => {
    return '/api'; 
};

const BRAIN_API_URL = getBrainApiUrl();

export const brainApi = axios.create({ baseURL: BRAIN_API_URL, timeout: 45000 }); // Increased timeout for migrations

/**
 * Resolve a direct Local Agent API base URL (NOT via Vite proxy).
 * This ensures requests intended for the Local Agent are sent directly
 * to the agent process (typically port 4001) and not handled by Vite's
 * dev server which may intentionally exclude certain /api/* routes.
 */
export const getLocalAgentApiBaseUrl = () => {
    const env = (import.meta as any).env || {};
    if (env.VITE_LOCAL_API_URL) return env.VITE_LOCAL_API_URL.replace(/\/$/, '');

    const PORT = _registry?.SYSTEM_SETTING?.local_agent_port || _registry?.local_agent_port || 4001;

    // If running in browser on a local network, return a direct agent host:port
    // We want API calls to hit the Local Agent process (typically port 4001)
    // rather than the dev server origin which may proxy or reject certain routes.
    if (isBrowser) {
        const { hostname, protocol } = window.location;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.endsWith('.local');
        if (isLocal) {
            return `${protocol}//${hostname}:${PORT}`;
        }
    }

    const registryUrl = _registry?.SYSTEM_SETTING?.local_agent_url || _registry?.local_agent_url;
    if (registryUrl) return registryUrl.replace(/\/$/, '');

    return `http://127.0.0.1:${PORT}`;
};

export const localAgentApi = axios.create({ baseURL: `${getLocalAgentApiBaseUrl()}/api`, timeout: 15000 });

// Normalize URL path to avoid duplicate /api prefixes when callers pass '/api/...' or 'api/...'
export const normalizeApiPath = (u: string) => {
    if (!u) return '/';
    // Ensure a single leading slash and remove any leading 'api' segment
    let s = String(u || '');
    s = s.replace(/^\/+/, '/');
    s = s.replace(/^\/api\/?/, '/');
    // Collapse multiple slashes
    s = s.replace(/\/+/g, '/');
    // Ensure it starts with '/'
    if (!s.startsWith('/')) s = '/' + s;
    return s;
};

// --- INTERCEPTORS ---

[brainApi, localAgentApi].forEach(instance => {
    instance.interceptors.request.use(
        config => {
            if (isBrowser) {
                const token = localStorage.getItem('token');
                if (token) config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        error => Promise.reject(error)
    );
});

// Helper: If an action/workflow request 404s against the Brain route during dev,
// retry against the Local Agent API directly. This avoids Vite dev-server proxy
// exclusions causing client-side 404s for local-only endpoints.
const shouldTryLocalOn404 = (url: string) => {
    if (!url) return false;
    const clean = url.replace(/^\//, '').replace(/^api\//, '');
    return /^action\//.test(clean) || /workflow/.test(clean);
};

const wrapRequest = (fnBrain: any, fnLocal: any) => async (url: string, dataOrCfg?: any, cfg?: any) => {
    try {
        // brain functions use (url, data?, cfg?) signature
        const res = await fnBrain(normalizeApiPath(url), dataOrCfg, cfg);
        return res;
    } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 && shouldTryLocalOn404(url)) {
            // Try Local Agent API first (standard)
            try {
                const normalized = normalizeApiPath(url);
                const res2 = await fnLocal(normalized, dataOrCfg, cfg);
                return res2;
            } catch (e2: any) {
                // If the Local Agent responded 404, try several alternate direct URLs
                // Some local agents expose endpoints with or without the `/api` prefix
                // and sometimes under `/workflow/...` instead of `/action/workflow/...`.
                const normalized = normalizeApiPath(url);
                const localBase = getLocalAgentApiBaseUrl();
                const alt1 = `${localBase}/api${normalized}`; // http://host:4001/api/action/...
                const alt2 = `${localBase}${normalized}`; // http://host:4001/action/...
                const normalizedNoAction = normalized.replace(/^\/action\//, '/');
                const alt3 = `${localBase}/api${normalizedNoAction}`; // http://host:4001/api/workflow/...
                const alt4 = `${localBase}${normalizedNoAction}`; // http://host:4001/workflow/...

                const candidates = [alt1, alt2, alt3, alt4];
                let lastErr: any = e2;
                // Build headers (include token if present)
                const headers = (cfg && cfg.headers) ? { ...(cfg.headers || {}) } : {};
                if (isBrowser) {
                    const token = localStorage.getItem('token');
                    if (token) headers.Authorization = `Bearer ${token}`;
                }

                for (const attemptUrl of candidates) {
                    try {
                        // eslint-disable-next-line no-console
                        console.debug(`[SERVICES] Trying direct local agent URL: ${attemptUrl}`);
                        const resp = await axios.post(attemptUrl, dataOrCfg || {}, { headers, timeout: cfg?.timeout || 15000 });
                        return resp.data;
                    } catch (attemptErr: any) {
                        lastErr = attemptErr;
                        // eslint-disable-next-line no-console
                        console.debug(`[SERVICES] Direct local attempt failed: ${attemptUrl} -> ${attemptErr?.response?.status || attemptErr.message}`);
                        // continue to next candidate
                    }
                }
                // All direct attempts failed, throw the last error
                throw lastErr;
            }
        }
        throw err;
    }
};

export const api = {
    get: wrapRequest((u: string, cfg?: any) => brainApi.get(u, cfg).then(r => r.data), (u: string, cfg?: any) => localAgentApi.get(u, cfg).then(r => r.data)),
    post: wrapRequest((u: string, d?: any, cfg?: any) => brainApi.post(u, d, cfg).then(r => r.data), (u: string, d?: any, cfg?: any) => localAgentApi.post(u, d, cfg).then(r => r.data)),
    put: wrapRequest((u: string, d?: any, cfg?: any) => brainApi.put(u, d, cfg).then(r => r.data), (u: string, d?: any, cfg?: any) => localAgentApi.put(u, d, cfg).then(r => r.data)),
    patch: wrapRequest((u: string, d?: any, cfg?: any) => brainApi.patch(u, d, cfg).then(r => r.data), (u: string, d?: any, cfg?: any) => localAgentApi.patch(u, d, cfg).then(r => r.data)),
    delete: wrapRequest((u: string, cfg?: any) => brainApi.delete(u, cfg).then(r => r.data), (u: string, cfg?: any) => localAgentApi.delete(u, cfg).then(r => r.data)),
    brain: {
        get: (url: string, cfg?: any) => brainApi.get(normalizeApiPath(url), cfg).then(r => r.data),
        post: async (url: string, data?: any, cfg?: any) => {
            try {
                const resp = await brainApi.post(normalizeApiPath(url), data, cfg);
                return resp.data;
            } catch (err: any) {
                const status = err?.response?.status;
                const respData = err?.response?.data;
                const normalized = normalizeApiPath(url);

                // If Brain returned 400 with empty body for registry save, fallback to socket
                const isRegistrySave = /registry\/save$/.test(normalized.replace(/^\//, '')) || /registry\/save$/.test(url);
                const isEmptyBody = !respData || (typeof respData === 'object' && Object.keys(respData).length === 0);

                if (status === 400 && isRegistrySave && isEmptyBody) {
                    try {
                        console.warn('[SERVICES] Brain returned 400 empty body for registry/save — falling back to socketRequest');
                        const sockRes = await socketRequest('registry:save', data);
                        return sockRes;
                    } catch (sockErr: any) {
                        console.warn('[SERVICES] Socket fallback for registry/save failed:', sockErr?.message || sockErr);
                    }
                }
                throw err;
            }
        },
        put: (url: string, data?: any, cfg?: any) => brainApi.put(normalizeApiPath(url), data, cfg).then(r => r.data),
        patch: (url: string, data?: any, cfg?: any) => brainApi.patch(normalizeApiPath(url), data, cfg).then(r => r.data),
        delete: (url: string, cfg?: any) => brainApi.delete(normalizeApiPath(url), cfg).then(r => r.data),
    },
    local: {
        get: (url: string, cfg?: any) => localAgentApi.get(normalizeApiPath(url), cfg).then(r => r.data),
        post: (url: string, data?: any, cfg?: any) => localAgentApi.post(normalizeApiPath(url), data, cfg).then(r => r.data),
        put: (url: string, data?: any, cfg?: any) => localAgentApi.put(normalizeApiPath(url), data, cfg).then(r => r.data),
        patch: (url: string, data?: any, cfg?: any) => localAgentApi.patch(normalizeApiPath(url), data, cfg).then(r => r.data),
        delete: (url: string, cfg?: any) => localAgentApi.delete(normalizeApiPath(url), cfg).then(r => r.data),
    }
};

// --- AI ENGINE ---

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

        // 1. If we have a model ID but no provider, attempt to resolve provider from the model list
        if (!providerName && modelId && this.config.models) {
            const foundModel = this.config.models.find((m: any) => m.id === modelId);
            if (foundModel) {
                providerName = foundModel.provider;
            }
        }

        // 2. Fallback to active_provider (legacy) or pick the first from activeProviders
        if (!providerName) {
            providerName = this.config.active_provider || 
                          (Array.isArray(this.config.activeProviders) ? this.config.activeProviders[0] : null) ||
                          this.config.defaultProvider;
        }

        const providerConfig = this.config.providers?.[providerName];

        if (!providerConfig) {
            this.logger.error(`[AI-ENGINE] Provider "${providerName}" not found. Available providers: ${Object.keys(this.config.providers || {}).join(', ')}`);
            throw new Error(`AI Provider "${providerName}" not found!`);
        }
        try {
            return await this.executeProviderCall(providerName, providerConfig, prompt, history, { ...options, model: modelId });
        } catch (error: any) {
            this.logger.error(`[AI-ENGINE] Chat error: ${error.message}`);
            throw error;
        }
    }
    resolveApiKey(p: any) {
        if (p.apiKey && !p.apiKey.startsWith('{{')) return p.apiKey;
        if (p.apiKeyEnvVar && this.env[p.apiKeyEnvVar]) return this.env[p.apiKeyEnvVar];
        if (p.apiKeyEnvVar && typeof process !== 'undefined' && process.env?.[p.apiKeyEnvVar]) return process.env[p.apiKeyEnvVar];
        return '';
    }
    async executeProviderCall(name: string, p: any, prompt: string, history: any[], options: any) {
        const model = options.model || (p.models && p.models[0]) || p.defaultModel || this.config.model;
        const apiKey = this.resolveApiKey(p);
        let url = (p.baseUrl || "").replace('{{model}}', model || "").replace('{{apiKey}}', apiKey || "").replace('{{accountId}}', p.accountId || this.env.CLOUDFLARE_ACCOUNT_ID || "");
        
        // Auto-detect type if missing
        const type = p.type || (name === 'openai' || name === 'gemini' || url.includes('openai') ? 'openai-v1' : 
                                 name === 'anthropic' ? 'anthropic-v1' : 
                                 name === 'cloudflare' ? 'cloudflare-rpc' : 'openai-v1');

        const configWithKey = { ...p, apiKey };

        switch (type) {
            case 'google-v1beta': return await this.callGoogle(url, prompt, history, options, configWithKey);
            case 'openai-v1': return await this.callOpenAi(url, prompt, history, options, configWithKey);
            case 'anthropic-v1': return await this.callAnthropic(url, prompt, history, options, configWithKey);
            case 'cloudflare-rpc': return await this.callCloudflare(url, prompt, history, options, configWithKey);
            default: return await this.callOpenAi(url, prompt, history, options, configWithKey);
        }
    }
    async callOpenAi(url: string, prompt: string, history: any[], options: any, p: any) {
        const model = options.model || p.defaultModel || (p.models && p.models[0]);
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
        if (options.response_mime_type === 'application/json') {
            body.response_format = { type: 'json_object' };
        }
        const resp = await this.fetch(url + (url.endsWith('/') ? '' : '/') + 'chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${p.apiKey || ""}` 
            },
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
    async callAnthropic(url: string, prompt: string, history: any[], options: any, p: any) {
        const body = { 
            model: options.model || p.model, 
            messages: [{ role: 'user', content: prompt }], 
            system: options.systemPrompt,
            temperature: options.temperature ?? this.config.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? this.config.maxTokens ?? 2048
        };
        const resp = await this.fetch(url, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json', 
                'x-api-key': p.apiKey, 
                'anthropic-version': '2023-06-01' 
            }, 
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

        // 3. Check Workspace custom prompts (from context if provided, or registry if merged)
        const workspacePrompts = context.workspace_prompt || prompts.workspacePrompts || [];
        const wsMatch = workspacePrompts.find((p: any) => p.id === name || p.name === name);
        if (wsMatch) {
            userTemplate = wsMatch.content;
            if (wsMatch.model) model = wsMatch.model;
        }

        // Fallback to legacy structure if nothing found
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

// --- CORE SERVICES ---

export class AiService {
    private engine: BaseAiEngine;
    private config: any;
    constructor(env: any = {}, options: any = {}) {
        this.config = options.ai_config || _registry?.AI_CONFIG;
        this.engine = new BaseAiEngine({ config: this.config, fetch: options.fetch, db: options.db, env: env });
    }
    
    // Discovery Methods
    getAvailableModels() {
        return this.config?.models || [];
    }

    getActiveProviders() {
        return this.config?.activeProviders || [];
    }

    async chat(prompt: string, history: any[] = [], options: any = {}) { return this.engine.chat(prompt, history, options); }
    async getPrompt(db: any, name: string, context: any = {}) {
        const registry = { ..._registry, AI_CONFIG: this.config };
        return PROMPT_MANAGER.getPrompt({ db, registry, name, context });
    }
    async generate(message: string, options: any = {}, db: any = null) {
        const registry = { ..._registry, AI_CONFIG: this.config };
        const promptContext = await PROMPT_MANAGER.getPrompt({ db, registry, name: options.promptName || 'chat', context: { message, ...options } });
        
        // Use preferred model if specified, otherwise the one resolved by prompt manager or options
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

export class CurrencyService {
    private parser: XMLParser;
    constructor() { this.parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" }); }
    async fetchLatestRates() {
        const config = _registry?.CURRENCY || {};
        const bnrUrl = config.BASE_URL || 'https://www.bnr.ro/nbrfxrates.xml';
        const eurFallback = config.EUR_FALLBACK || 4.97;
        try {
            const resp = await fetch(bnrUrl);
            const jsonObj = this.parser.parse(await resp.text());
            const cube = jsonObj.DataSet.Body.Cube;
            const result: any = { date: cube['@_date'], rates: { EUR: eurFallback, USD: config.USD_FALLBACK || 4.55 } };
            const rates = Array.isArray(cube.Rate) ? cube.Rate : [cube.Rate];
            rates.forEach((r: any) => { if (r) result.rates[r['@_currency']] = parseFloat(r['#text']); });
            return result;
        } catch (e) { return { rates: { EUR: eurFallback }, date: new Date().toISOString() }; }
    }
}

