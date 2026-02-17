/**
 * SERVICES LAYER - SSOT
 * Merged from ai-engine, prompt-manager, api-client, socket, core-services
 */

import axios from 'axios';
import { io, type Socket } from "socket.io-client";
import { XMLParser } from 'fast-xml-parser';
import { renderString } from './utils';

const logger = console;

let _registry: any = null;
let DISABLE_SOCKET_BY_REGISTRY = false;

export function initRegistry(registry: any) {
    _registry = registry;
    
    // Enterprise Level 10: Dynamic Connectivity Orchestration (Registry-Dependent)
    const newDisableState = registry?.SYSTEM_SETTING?.use_local_agent === false;
    if (newDisableState !== DISABLE_SOCKET_BY_REGISTRY) {
        DISABLE_SOCKET_BY_REGISTRY = newDisableState;
        if (DISABLE_SOCKET_BY_REGISTRY && socket.connected) {
            console.log('[SOCKET] Local Agent disabled in Registry, disconnecting...');
            socket.disconnect();
            whatsappSocket.disconnect();
        }
    }
    
    // Enterprise Level 10: Real-time Socket Protocol Alignment
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

/**
 * Enterprise Level 10: Isomorphic Environment Access (Vite-Safe)
 * Resolves properties from import.meta.env or process.env without dynamic object access.
 */
const getEnvVar = (key: string): any => {
    // 1. Try Vite/React Router (Static-analysis optimized)
    if (key === 'VITE_SOCKET_URL') return import.meta.env.VITE_SOCKET_URL;
    if (key === 'VITE_LOCAL_API_URL') return import.meta.env.VITE_LOCAL_API_URL;
    if (key === 'NODE_ENV') return import.meta.env.MODE;
    if (key === 'DEV') return import.meta.env.DEV;
    
    // 2. Try Node process fallback (SSR/Worker)
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
    }
    
    return undefined;
};

export const getLocalAgentUrl = () => {
    // 1. Try from Environment Variables
    const envUrl = getEnvVar('VITE_SOCKET_URL') || getEnvVar('VITE_LOCAL_API_URL');
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

    // 3. Enterprise Level 10: Registry-Based Discovery (Brain Core Configuration)
    const registryUrl = _registry?.SYSTEM_SETTING?.local_agent_url || _registry?.local_agent_url;
    if (registryUrl) {
        return registryUrl.replace(/\/$/, '');
    }

    // 4. Fallback to intelligent detection
    const PORT = _registry?.SYSTEM_SETTING?.local_agent_port || _registry?.local_agent_port || 4001;

    if (isBrowser) {
        const { hostname, protocol, origin } = window.location;
        
        // 1. Domain mapping for Local/Dev (localhost, 127.0.0.1, internal IPs)
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.') || hostname.endsWith('.local');
        if (isLocal) {
            // Enterprise Level 10: Transparent Proxy Tunnel (Vite/Wrangler Shim)
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
    return getEnvVar('DEV') ? `http://127.0.0.1:${PORT}` : '';
};

let SOCKET_URL = isBrowser ? getLocalAgentUrl() : '';

const getSocketAuth = () => {
    // Pass namespace based on context, or default to root
    if (isBrowser && typeof localStorage !== 'undefined') {
        const token = localStorage.getItem("token");
        const email = localStorage.getItem("userEmail");
        return token ? { token, email } : { email };
    }
    return {};
};

const mockSocket: any = { on: () => { }, off: () => { }, emit: () => { }, connect: () => { }, disconnect: () => { }, connected: false, once: () => { } };

// Enterprise Level 10: Connectivity Guard - Prevent socket instantiation if explicitly disabled
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
        reconnectionAttempts: 1, // Enterprise Level 10: Throttled reconnection (Resource Optimization)
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
    // Enterprise Level 10: Automatic API Redundancy (Brain Fallback)
    // This allows the app to work even if the Local Agent is not running.
    if (event.startsWith('system:') || event.startsWith('registry:') || event.startsWith('workspace:') || event.startsWith('monitoring:') || event.startsWith('ai:')) {
        const parts = event.split(':');
        const resource = parts[0];
        const op = parts.slice(1).join('/');
        
        const isWrite = event.includes(':update') || event.includes(':save') || event.includes(':set-') || event.includes(':delete') || event.includes(':toggle') || event.includes(':sync');
        const method = isWrite ? 'post' : 'get';
        const url = `${resource}/${op}`;

        // Enterprise Level 10: Auth-State Verification for Redundancy Trigger
        const hasToken = isBrowser && typeof localStorage !== 'undefined' && !!localStorage.getItem('token');

        if (hasToken) {
            return new Promise((resolve) => {
                const apiCall = isWrite ? api.brain.post(url, data) : api.brain.get(url, { params: data });
                
                apiCall.then((res: any) => {
                    if (res && res.success !== false) {
                        resolve(res);
                    } else {
                        // Enterprise Level 10: Dynamic Socket Handover
                        if (_registry?.SYSTEM_SETTING?.use_local_agent) {
                            socket.emit(event, data, (socketRes: any) => resolve(socketRes));
                        } else {
                            resolve(res);
                        }
                    }
                }).catch((err: any) => {
                    // Enterprise Level 10: Dynamic Socket Handover
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
        // Enterprise Level 10 Guard: Prevent unsolicited socket traffic when Local Agent is disabled
        if (_registry && _registry.SYSTEM_SETTING && _registry.SYSTEM_SETTING.use_local_agent === false) {
            return resolve({ success: false, error: 'LOCAL_AGENT_DISABLED' });
        }

        // We removed the warning here to support L10 lazy connection
        const timeout = setTimeout(() => reject(new Error(`Socket timeout: ${event}`)), 10000);
        socket.emit(event, data, (res: any) => {
            clearTimeout(timeout);
            if (res && res.error) reject(new Error(res.error));
            else resolve(res);
        });
    });
}

// --- API CLIENT ---

const isProd = isBrowser && !['localhost', '127.0.0.1'].includes(window.location.hostname) && !window.location.hostname.endsWith('.local');

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
    const vUrl = getEnvVar('VITE_LOCAL_API_URL');
    if (vUrl) return vUrl.replace(/\/$/, '');

    const PORT = _registry?.SYSTEM_SETTING?.local_agent_port || _registry?.local_agent_port || 4001;

    // If running in browser on a local network, return a direct agent host:port
    // We want API calls to hit the Local Agent process (typically port 4001)
    // rather than the dev server origin which may proxy or reject certain routes.
    if (isBrowser) {
        const { hostname, origin } = window.location;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.endsWith('.local');
        if (isLocal) {
            // Enterprise Level 10: Transparent Proxy Tunnel (Vite/Wrangler Shim)
            // This ensures we pass through Vite's proxy (port 8788) which is already mapped to Backend V2
            // This avoids direct port 4001 access issues which often fail in networks or firewalls.
            return `${origin}/api-local`;
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
            if (isBrowser && typeof localStorage !== 'undefined') {
                const token = localStorage.getItem('token');
                if (token) config.headers.Authorization = `Bearer ${token}`;
                
                // Enterprise Level 10: Multi-Language Context Injection (I18N Propagation)
                try {
                    const fullLang = localStorage.getItem('i18nextLng') || 'ro';
                    const lang = fullLang.split('-')[0].toLowerCase();
                    if (lang === 'ro' || lang === 'en') {
                        if (!config.params) config.params = {};
                        config.params.lang = lang;
                    }
                } catch (e) {}
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
        const respData = err?.response?.data;

        if (status === 404 && shouldTryLocalOn404(url)) {
            // Try Local Agent API first (standard)
            try {
                const normalized = normalizeApiPath(url);
                const res2 = await fnLocal(normalized, dataOrCfg, cfg);
                return res2;
            } catch (e2: any) {
                // If the Local Agent responded 404, try several alternate direct URLs
                const normalized = normalizeApiPath(url);
                const localBase = getLocalAgentApiBaseUrl();
                const alt1 = `${localBase}/api${normalized}`; 
                const alt2 = `${localBase}${normalized}`; 
                
                try {
                    const rAlt = await axios.post(alt1, dataOrCfg || {}, { timeout: 5000 });
                    return rAlt.data;
                } catch (eAlt) {}
            }
        }
        
        // Enterprise Level 10 Unified Error Schema: Standardize on detailed response bodies
        if (respData && typeof respData === 'object') {
            return respData;
        }

        throw err;
    }
}



export const api = {
    get: wrapRequest((u: string, cfg?: any) => brainApi.get(u, cfg).then(r => r.data), (u: string, cfg?: any) => localAgentApi.get(u, cfg).then(r => r.data)),
    post: wrapRequest((u: string, d?: any, cfg?: any) => brainApi.post(u, d, cfg).then(r => r.data), (u: string, d?: any, cfg?: any) => localAgentApi.post(u, d, cfg).then(r => r.data)),
    put: wrapRequest((u: string, d?: any, cfg?: any) => brainApi.put(u, d, cfg).then(r => r.data), (u: string, d?: any, cfg?: any) => localAgentApi.put(u, d, cfg).then(r => r.data)),
    patch: wrapRequest((u: string, d?: any, cfg?: any) => brainApi.patch(u, d, cfg).then(r => r.data), (u: string, d?: any, cfg?: any) => localAgentApi.patch(u, d, cfg).then(r => r.data)),
    delete: wrapRequest((u: string, cfg?: any) => brainApi.delete(u, cfg).then(r => r.data), (u: string, cfg?: any) => localAgentApi.delete(u, cfg).then(r => r.data)),
    
    // Enterprise Level 10: Unified Action Protocol
    action: (entity: string, actionId: string, data?: any, cfg?: any) => brainApi.post(normalizeApiPath(`action/${entity}/${actionId}`), data, cfg).then(r => r.data),
    
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
        
        // Enterprise Level 10: Explicit Brain Action Execution
        action: (entity: string, actionId: string, data?: any, cfg?: any) => brainApi.post(normalizeApiPath(`action/${entity}/${actionId}`), data, cfg).then(r => r.data),
        
        quickCreate: async (entityId: string, name: string, additionalData: any = {}, workspaceId?: string) => {
            const ws = workspaceId || 'system';
            const payload = {
                name,
                label: name,
                title: name,
                workspaceId: ws,
                ...additionalData
            };
            const resp = await brainApi.post(normalizeApiPath(`db/collection/${entityId}/${ws}/new`), payload);
            return resp.data;
        }
    },
    local: {
        get: (url: string, cfg?: any) => {
            if (_registry?.SYSTEM_SETTING?.use_local_agent === false) {
                return Promise.resolve({ success: false, error: 'LOCAL_AGENT_DISABLED', message: 'Local agent is disabled in Registry.' });
            }
            return localAgentApi.get(normalizeApiPath(url), cfg).then(r => r.data);
        },
        post: (url: string, data?: any, cfg?: any) => {
            if (_registry?.SYSTEM_SETTING?.use_local_agent === false) {
                return Promise.resolve({ success: false, error: 'LOCAL_AGENT_DISABLED' });
            }
            return localAgentApi.post(normalizeApiPath(url), data, cfg).then(r => r.data);
        },
        put: (url: string, data?: any, cfg?: any) => {
            if (_registry?.SYSTEM_SETTING?.use_local_agent === false) {
                return Promise.resolve({ success: false, error: 'LOCAL_AGENT_DISABLED' });
            }
            return localAgentApi.put(normalizeApiPath(url), data, cfg).then(r => r.data);
        },
        patch: (url: string, data?: any, cfg?: any) => {
            if (_registry?.SYSTEM_SETTING?.use_local_agent === false) {
                return Promise.resolve({ success: false, error: 'LOCAL_AGENT_DISABLED' });
            }
            return localAgentApi.patch(normalizeApiPath(url), data, cfg).then(r => r.data);
        },
        delete: (url: string, cfg?: any) => {
            if (_registry?.SYSTEM_SETTING?.use_local_agent === false) {
                return Promise.resolve({ success: false, error: 'LOCAL_AGENT_DISABLED' });
            }
            return localAgentApi.delete(normalizeApiPath(url), cfg).then(r => r.data);
        },
    }
};

// --- AI ENGINE ---

export class BaseAiEngine {
    config: any; fetch: any; logger: any; db: any; env: any; settings: any;
    constructor(adapter: any = {}) {
        this.config = adapter.config || _registry?.AI_CONFIG || {};
        this.fetch = adapter.fetch || (typeof fetch !== 'undefined' ? fetch.bind(undefined) : null);
        this.logger = adapter.logger || console;
        this.db = adapter.db || null;
        this.env = adapter.env || {};
        this.settings = adapter.systemSetting || _registry?.SYSTEM_SETTING || {};

        // Enterprise Level 10: Dynamic Model Hydration (Registry-First Inventory)
        // We use this.config.providers instead of global _registry to be Worker-safe
        if (this.config.models && this.config.providers && this.settings) {
            Object.keys(this.config.providers).forEach(pId => {
                const key = `discovered_${pId}_models`;
                let dynamic = this.settings[key];
                
                // Enterprise Level 10 Resilience: Recursive JSON extraction from hydrated settings
                if (typeof dynamic === 'string' && (dynamic.startsWith('[') || dynamic.startsWith('{'))) {
                    try { dynamic = JSON.parse(dynamic); } catch(e) {}
                }

                if (Array.isArray(dynamic)) {
                    const existingIds = new Set(this.config.models.map((m: any) => m.id));
                    dynamic.forEach((m: any) => {
                        if (m && m.id && !existingIds.has(m.id)) {
                            // Ensure the model knows its provider if not set in D1
                            if (!m.provider) m.provider = pId;
                            this.config.models.push(m);
                        }
                    });
                }
            });
        }
    }
    async chat(prompt: string, history: any[] = [], options: any = {}) {
        let providerName = options.provider;
        let modelId = options.model;
        let foundModel: any = null;

        // 1. Enterprise Level 10: Deterministic Provider Resolution (Hierarchy: Model Override > Explicit > Active)
        // If we have a model ID, check which provider it belongs to. This overrides the suggested provider
        // to prevent sending a Cloudflare model to Google, for example.
        if (modelId && this.config.models) {
            const models = this.config.models;
            
            if (Array.isArray(models)) {
                foundModel = models.find((m: any) => String(m.id) === String(modelId) || String(m.pk) === String(modelId));
            } else if (typeof models === 'object') {
                foundModel = models[modelId];
            }

            if (foundModel && foundModel.provider) {
                // Enterprise Level 10: Model Provider DNA is Absolute SSOT.
                if (providerName && providerName !== foundModel.provider) {
                    this.logger.warn(`[AI-ENGINE] Overriding requested provider "${providerName}" with "${foundModel.provider}" for model "${modelId}"`);
                }
                providerName = foundModel.provider;
            } else {
                // Enterprise Level 10: Identity-Based Provider Resolution (Safety Fallback)
                const mid = String(modelId);
                if (mid.startsWith('@cf/')) providerName = 'cloudflare';
                else if (mid.includes('azureml') || mid.includes('github')) providerName = 'github';
                else if (mid.includes('gpt-') || mid.includes('o1-') || mid.includes('o3-')) providerName = 'openai';
                else if (mid.includes('claude-')) providerName = 'anthropic';
                else if (mid.includes('gemini-')) providerName = 'gemini';
                else if (mid.includes('deepseek-')) providerName = 'deepseek';
            }
        }

        // 2. Fallback to active_provider (legacy) or pick the first from activeProviders
        if (!providerName) {
            providerName = this.config.active_provider || 
                          (Array.isArray(this.config.activeProviders) ? this.config.activeProviders[0] : null) ||
                          this.config.defaultProvider;
        }

        // Enterprise Level 10: Legacy Alias Reconciliation (Google -> Gemini)
        if (providerName === 'google' && !this.config.providers?.google && this.config.providers?.gemini) {
            providerName = 'gemini';
        }

        const providerConfig = { ...this.config.providers?.[providerName], ...options };

        if (!providerConfig || Object.keys(providerConfig).length === 0) {
            this.logger.error(`[AI-ENGINE] Provider "${providerName}" not found. Available providers: ${Object.keys(this.config.providers || {}).join(', ')}`);
            throw new Error(`AI Provider "${providerName}" not found!`);
        }

        // 3. Enterprise Level 10: Strict Model Resolution (Explicit > Default > Preferred)
        if (!modelId) {
            // Check provider specific default
            modelId = providerConfig.defaultModel;
            
            // Very last fallback from top-level config
            if (!modelId) modelId = this.config.model || this.config.preferredModel;
            
            // Final validation - throw if no model resolved
            if (!modelId) {
                throw new Error(`[AI-ENGINE] No model specified for provider "${providerName}" and no default found in Registry.`);
            }
        }

        // 4. Enterprise Level 10: Leakage Prevention (Final Provider-Model Validation)
        // If the resolved model ID has a specific prefix, ensure the provider matches.
        const mid = String(modelId);
        let correctedProvider = providerName;
        if (mid.startsWith('@cf/')) correctedProvider = 'cloudflare';
        else if (mid.includes('azureml') || mid.includes('github')) correctedProvider = 'github';
        else if (mid.includes('gpt-') || mid.includes('o1-') || mid.includes('o3-')) correctedProvider = 'openai';
        else if (mid.includes('claude-')) correctedProvider = 'anthropic';
        else if (mid.includes('gemini-')) correctedProvider = 'gemini';
        else if (mid.includes('deepseek-')) correctedProvider = 'deepseek';

        if (correctedProvider !== providerName) {
            this.logger.warn(`[AI-ENGINE] Auto-correcting provider from "${providerName}" to "${correctedProvider}" for model "${mid}"`);
            providerName = correctedProvider;
        }

        this.logger.log(`[AI-ENGINE] Resolved provider: ${providerName}, model: ${modelId}`);

        // --- RAG INJECTION (Enterprise Level 10: Unified Context) ---
        let finalPrompt = prompt;
        if (this.config.ragEnabled && this.env.AI && this.env.VECTOR_INDEX && this.config.embeddingModel) {
            try {
                const queryEmb: any = await this.env.AI.run(this.config.embeddingModel, { text: [prompt] });
                if (queryEmb?.data?.[0]) {
                    const matches = await this.env.VECTOR_INDEX.query(queryEmb.data[0], { topK: 3, returnMetadata: true });
                    if (matches?.matches?.length > 0) {
                        const contextBlocks = matches.matches
                            .filter((m: any) => m.score > 0.5) // Lower threshold for better recall in Level 10
                            .map((m: any) => `[SURSA: ${m.metadata?.title || 'Knowledge Base'}]\n${m.metadata?.content || ''}\n(Relevance Score: ${Math.round(m.score * 100)}%)`)
                            .join('\n---\n');
                        
                        if (contextBlocks) {
                            finalPrompt = `SYSTEM INSTRUCTION: Use the following Knowledge Base (RAG) context to answer the user query accurately. 
If the context doesn't contain the answer, rely on your general knowledge but mention the source is missing.

RELEVANT DOCUMENTS:
${contextBlocks}

USER QUESTION:
${prompt}`;
                            this.logger.log(`[AI-ENGINE] RAG Context injected (${matches.matches.length} matches)`);
                        }
                    }
                }
            } catch (ragErr: any) {
                this.logger.warn(`[AI-ENGINE] RAG process bypassed: ${ragErr.message}`);
            }
        }

        const formattedHistory = this.formatHistory(history, providerConfig);

        // Enterprise Level 10: Detect if we should inject File Generation instructions
        if (options.fileGenEnabled || (foundModel?.capabilities?.includes('files'))) {
            const fileInstr = `\n\n[FILE GENERATION ENABLED] If you want to generate a downloadable file for the user, use the following markdown format:
\`\`\`extension filename=yourfile.ext
file content goes here
\`\`\``;
            if (options.systemPrompt) options.systemPrompt += fileInstr;
            else options.systemPrompt = fileInstr;
        }

        try {
            return await this.executeProviderCall(providerName, providerConfig, finalPrompt, formattedHistory, { ...options, model: modelId });
        } catch (error: any) {
            this.logger.error(`[AI-ENGINE] Primary chat error (${providerName}): ${error.message}`);
            
            // Enterprise Level 10: Multi-Provider Fallback logic (Restored by user request)
            const activeProviders = Array.isArray(this.config.activeProviders) ? this.config.activeProviders : [];
            const nextProviders = activeProviders.filter((p: string) => p !== providerName);
            
            if (nextProviders.length > 0) {
                this.logger.warn(`[AI-ENGINE] Attempting fallback to: ${nextProviders.join(', ')}`);
                for (const fallbackName of nextProviders) {
                    try {
                        const fallbackCfg = this.config.providers?.[fallbackName];
                        if (fallbackCfg) {
                            const fallbackHistory = this.formatHistory(history, fallbackCfg);
                            // Enterprise Level 10: During fallback, we let the provider use its own default model
                            return await this.executeProviderCall(fallbackName, fallbackCfg, prompt, fallbackHistory, { 
                                ...options, 
                                model: undefined, 
                                isFallback: true 
                            });
                        }
                    } catch (fallbackErr: any) {
                        this.logger.error(`[AI-ENGINE] Fallback to ${fallbackName} failed: ${fallbackErr.message}`);
                    }
                }
            }
            
            throw error;
        }
    }

    formatHistory(history: any[], pCfg: any) {
        if (!history || history.length === 0) return [];
        
        const type = pCfg?.type || '';

        if (type === 'google-v1beta') {
            const formatted = history.map(h => ({
                role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
                parts: [{ text: h.content || h.parts?.[0]?.text || "" }]
            }));

            // Gemini specific: First message MUST be 'user'. 
            // If it's 'model', we drop it until we find a 'user' message.
            while (formatted.length > 0 && formatted[0].role === 'model') {
                formatted.shift();
            }

            // Gemini specific: Roles MUST alternate user -> model -> user -> model.
            // If we have consecutive identical roles, we merge their parts.
            const alternated: any[] = [];
            formatted.forEach(item => {
                if (alternated.length > 0 && alternated[alternated.length - 1].role === item.role) {
                    alternated[alternated.length - 1].parts[0].text += "\n\n" + item.parts[0].text;
                } else {
                    alternated.push(item);
                }
            });

            return alternated;
        }
        
        return history.map(h => ({
            role: h.role === 'model' ? 'assistant' : h.role,
            content: h.content || h.parts?.[0]?.text || ""
        }));
    }

    resolveApiKey(p: any, providerName: string = '') {
        if (p.apiKey && !p.apiKey.startsWith('{{')) return p.apiKey;
        
        // Enterprise Level 10: Prioritize Registry-defined Environment Variables (No Hardcoding)
        const possibleVars = [
            p.apiKeyEnvVar,
            p.apiTokenEnvVar,
            providerName ? `${providerName.toUpperCase()}_API_KEY` : '',
            providerName ? `${providerName.toUpperCase()}_API_TOKEN` : '',
            providerName ? `VITE_${providerName.toUpperCase()}_API_KEY` : '',
        ].filter(Boolean) as string[];

        for (const v of possibleVars) {
            if (this.env && this.env[v]) return this.env[v];
            if (typeof process !== 'undefined' && (process.env as any)?.[v]) return (process.env as any)[v];
        }

        // Enterprise Level 10: Fallback to global registry settings (D1 overrides)
        const s = this.settings || _registry?.SYSTEM_SETTING;
        if (s) {
            const registryKey = `${providerName}_api_key`;
            const registryToken = `${providerName}_api_token`;
            if (s[registryKey]) return s[registryKey];
            if (s[registryToken]) return s[registryToken];
        }
        
        return '';
    }

    resolveAccountId(p: any, providerName: string = '') {
        if (p.accountId && !p.accountId.startsWith('{{')) return p.accountId;
        
        // Enterprise Level 10: Prioritize Registry-defined Environment Variables
        const v = providerName === 'cloudflare' ? 'CLOUDFLARE_ACCOUNT_ID' : `${providerName.toUpperCase()}_ACCOUNT_ID`;
        if (this.env && this.env[v]) return this.env[v];
        if (typeof process !== 'undefined' && (process.env as any)?.[v]) return (process.env as any)[v];

        // Enterprise Level 10: Fallback to global registry settings
        const s = this.settings || _registry?.SYSTEM_SETTING;
        if (s) {
            const registryKey = `${providerName}_account_id`;
            if (s[registryKey]) return s[registryKey];
        }
        
        return '';
    }

    async executeProviderCall(name: string, p: any, prompt: string, history: any[], options: any) {
        // Enterprise Level 10: Improved Model Resolution logic
        let model = options.model;

        // Enterprise Level 10: Resolve Reference (Map DB ID or Numeric ID back to Technical Name)
        if (this.config.models && model) {
             const record = this.config.models.find((m: any) => 
                 String(m.id) === String(model) || 
                 String(m._id) === String(model) || 
                 String(m.pk) === String(model) ||
                 m.model_id === model
             );
             if (record) {
                 // Prioritize the technical ID/name over the numeric primary key
                 model = record.technical_id || record.id || record.model_id;
             }
        }

        if (!model && name !== 'cloudflare' && !this.env?.AI) {
            // Enterprise Level 10: Try to find any enabled model for this provider as fallback
            const fallbackModel = (this.config.models || []).find((m: any) => m.provider === name && m.enabled !== false);
            if (fallbackModel) model = fallbackModel.id;
            else throw new Error(`Model not specified for provider ${name} and no default available in registry.`);
        }

        const apiKey = this.resolveApiKey(p, name);
        const accountId = this.resolveAccountId(p, name);
        this.logger.log(`[AI-ENGINE] Provider: ${name} | Model: ${model} | Key: ${apiKey ? apiKey.substring(0, 5) + '...' : 'MISSING'} | Account: ${accountId || 'MISSING'}`);
        
        let url = (p.baseUrl || "");
        
        // Enterprise Level 10: Template Injection
        if (url.includes('{{model}}')) url = url.replace(/\{\{model\}\}/g, model || "");
        if (url.includes('{{accountId}}')) url = url.replace(/\{\{accountId\}\}/g, accountId || "");

        // URL Normalization (Enterprise Level 10 Immunity)
        if (url.startsWith('http')) {
            const protocolMatch = url.match(/^(https?):\/\//);
            if (protocolMatch) {
                const protocol = protocolMatch[1];
                let rest = url.substring(protocol.length + 3);
                const queryParts = rest.split('?');
                queryParts[0] = queryParts[0].replace(/\/+/g, '/').replace(/\/$/, '');
                url = protocol + '://' + queryParts.join('?');
            }
        }
        
        const safeUrl = url.includes('key=') ? url.split('key=')[0] + 'key=***' : 
                         url.includes('Authorization') ? url : url;
        
        let type = p.type;
        if (!type && url.includes('/openai')) type = 'openai-v1';
        if (!type && (url.includes('googleapis.com') || name === 'gemini')) type = 'google-v1beta';

        if (!type) {
            throw new Error(`AI Driver type is required for provider "${name}" (URL: ${safeUrl})`);
        }

        this.logger.log(`[AI-ENGINE] calling ${name} (${model}) | Type: ${type} | URL: ${safeUrl}`);

        const configWithKey = { ...p, apiKey, accountId };

        switch (type) {
            case 'google-v1beta': 
            case 'gemini':
                return await this.callGoogle(url, prompt, history, options, configWithKey);
            case 'github-v1': return await this.callGitHub(url, prompt, history, options, configWithKey);
            case 'openai-v1': return await this.callOpenAi(url, prompt, history, options, configWithKey);
            case 'anthropic-v1': return await this.callAnthropic(url, prompt, history, options, configWithKey);
            case 'cloudflare-rpc': return await this.callCloudflare(url, prompt, history, options, configWithKey);
            default: return await this.callOpenAi(url, prompt, history, options, configWithKey);
        }
    }
    async callGitHub(url: string, prompt: string, history: any[], options: any, p: any) {
        // GitHub Models & Copilot Extensions
        const model = options.model || p.defaultModel;
        if (!model) throw new Error("GitHub model is required but missing.");
        
        // Enterprise Level 10: Clean Model ID (Handle technical names, technical_id, or Azure ML URIs)
        // If it's a full URI like azureml://.../Meta-Llama-3.1-70B-Instruct/versions/1, we want the name part.
        let cleanModel = String(model);
        if (cleanModel.includes('/versions/')) {
            const parts = cleanModel.split('/versions/')[0].split('/');
            cleanModel = parts[parts.length - 1];
        } else if (cleanModel.includes('/')) {
            cleanModel = cleanModel.split('/').pop()?.split('?')[0] || cleanModel;
        }
        
        const messages = [
            ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            ...history,
            { role: 'user', content: prompt }
        ];
        const body: any = { 
            model: cleanModel, 
            messages, 
            temperature: options.temperature ?? this.config.temperature,
            max_tokens: options.maxTokens ?? this.config.maxTokens
        };
        
        // Enterprise Level 10: Smart URL Construction (Fill only if missing)
        let finalUrl = url;
        if (!finalUrl.includes('/chat/completions') && !finalUrl.includes('?')) {
            finalUrl = finalUrl.replace(/\/+$/, '') + '/chat/completions';
        }
        
        const resp = await this.fetch(finalUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${p.apiKey || ""}`,
                'User-Agent': 'Studio-App-v2'
            },
            body: JSON.stringify(body)
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => 'No error body');
            throw new Error(`GitHub API Error ${resp.status}: ${errText}`);
        }

        const data = await resp.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return data.choices?.[0]?.message?.content || null;
    }
    async callOpenAi(url: string, prompt: string, history: any[], options: any, p: any) {
        const model = options.model || p.defaultModel;
        if (!model) throw new Error(`Model name is required for driver ${p.type || 'AI'} but missing.`);
        
        // Enterprise Level 10: Vision Support for OpenAI-Compatible Providers
        const userContent: any[] = [];
        if (options.file && (options.file.startsWith('data:image') || options.fileType?.startsWith('image/'))) {
            userContent.push({
                type: 'image_url',
                image_url: { url: options.file }
            });
        }
        userContent.push({ type: 'text', text: prompt });

        const messages = [
            ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            ...history,
            { role: 'user', content: options.file ? userContent : prompt }
        ];
        const body: any = { 
            model, 
            messages, 
            temperature: options.temperature ?? this.config.temperature,
            max_tokens: options.maxTokens ?? this.config.maxTokens
        };
        if (options.response_mime_type === 'application/json') {
            body.response_format = { type: 'json_object' };
        }

        // Enterprise Level 10: Native Tool Support
        if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
            body.tools = options.tools;
            if (options.tool_choice) body.tool_choice = options.tool_choice;
        }

        // Enterprise Level 10: Smart URL Construction (Fill only if missing)
        let finalUrl = url;
        if (!finalUrl.includes('/chat/completions') && !finalUrl.includes('/completions') && !finalUrl.includes('generateContent') && !finalUrl.includes('?')) {
            finalUrl = finalUrl.replace(/\/+$/, '') + '/chat/completions';
        }

        const resp = await this.fetch(finalUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${p.apiKey || ""}` 
            },
            body: JSON.stringify(body)
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => 'No error body');
            let errorMessage = `OpenAI API Error ${resp.status}`;
            
            try {
                const parsed = JSON.parse(errText);
                if (resp.status === 429 && errText.includes('limit: 0')) {
                    errorMessage = JSON.stringify({
                        ro: `AI Quota Error: Modelul '${model}' are limită 0 pe acest cont. Te rugăm să verifici cota sau să alegi alt model în SuperAdmin.`,
                        en: `AI Quota Error: Model '${model}' has limit 0 on this account. Please check quota or choose another model in SuperAdmin.`
                    });
                } else {
                    errorMessage = parsed.error?.message || errText;
                }
            } catch(e) {}
            
            throw new Error(errorMessage);
        }

        const data = await resp.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        
        // Enterprise Level 10: Unified Tool Response
        const message = data.choices?.[0]?.message;
        if (message?.tool_calls) {
            return {
                tool_calls: message.tool_calls,
                content: message.content
            };
        }

        return message?.content || null;
    }
    async callGoogle(url: string, prompt: string, history: any[], options: any, p: any) {
        const model = options.model || p.defaultModel;
        
        if (!model) throw new Error("Google Gemini Model name is required but missing in Registry/Options.");

        // Enterprise Level 10: Clean URL and strip /openai for native driver if user accidentally put it in Registry
        let base = url.split('/openai')[0].split('?')[0].replace(/\/$/, ''); 
        
        // Advanced detection: if it's a native google url but doesn't have a version segment, add one.
        if (base.includes('googleapis.com') && !base.includes('/v1')) {
            base += '/v1beta';
        }

        let finalUrl = base;
        // Enterprise Level 10: Smart URL Construction (Enterprise Resilience)
        // Ensure the URL ends with the correct model and action if they are missing
        const urlWithoutProtocol = finalUrl.includes('://') ? finalUrl.split('://')[1] : finalUrl;
        
        if (!urlWithoutProtocol.includes(':')) {
             const cleanModel = String(model).startsWith('models/') ? String(model).substring(7) : model;
             if (!finalUrl.includes('/models/')) {
                 finalUrl += `/models/${cleanModel}:generateContent`;
             } else {
                 finalUrl = finalUrl.replace(/\/+$/, '') + ':generateContent';
             }
        }
        
        // Final sanity check for double actions in URL (Enterprise Level 10 Immunity)
        if (finalUrl.includes(':generateContent:generateContent')) {
            finalUrl = finalUrl.replace(/:generateContent:generateContent/g, ':generateContent');
        }
        
        // Ensure API key is present in the outgoing URL if it's not already merged
        const apiKey = p.apiKey || p.apiToken;
        if (!finalUrl.includes('key=') && apiKey) {
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + `key=${apiKey}`;
        }

        const contents = [
            ...history.map((m: any) => ({
                role: (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user',
                parts: [{ text: String(m.content || m.text || m.parts?.[0]?.text || '') }]
            })),
            { 
                role: 'user', 
                parts: [
                    ...(options.file ? [{
                        inline_data: {
                            mime_type: options.fileType || (options.file.startsWith('data:image/png') ? 'image/png' : options.file.startsWith('data:image/jpeg') ? 'image/jpeg' : 'application/pdf'),
                            data: options.file.split(',')[1] || options.file
                        }
                    }] : []),
                    { text: prompt }
                ] 
            }
        ];

        const body: any = { 
            contents, 
            generationConfig: { 
                temperature: options.temperature ?? this.config.temperature,
                maxOutputTokens: options.maxTokens ?? this.config.maxTokens
            } 
        };

        const fetchGoogle = async (targetUrl: string): Promise<any> => {
            this.logger.log(`[AI-ENGINE] Gemini Call: ${targetUrl.split('key=')[0]}key=***`);
            
            // Enterprise Level 10: Support Native System Instructions for Gemini (Adapted to URL version)
            const callBody = { ...body };
            if (options.systemPrompt) {
                if (targetUrl.includes('/v1beta') && !options.forceLegacySystem) {
                    callBody.system_instruction = { parts: [{ text: options.systemPrompt }] };
                } else {
                    // Fallback for v1 or models rejecting native system instructions: prepend to first user message
                    const cleanContents = JSON.parse(JSON.stringify(contents)); // Deep clone
                    const firstUser = cleanContents.find((c: any) => c.role === 'user');
                    if (firstUser) {
                        firstUser.parts[0].text = `System Instruction: ${options.systemPrompt}\n\n${firstUser.parts[0].text}`;
                    }
                    callBody.contents = cleanContents;
                    if (callBody.system_instruction) delete callBody.system_instruction;
                }
            }

            const headers: any = { 'Content-Type': 'application/json' };
            if (apiKey) headers['x-goog-api-key'] = apiKey;
            const resp = await this.fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(callBody) });
            
            if (!resp.ok) {
                const errorText = await resp.text();
                let errMsg = `Google API HTTP Error ${resp.status}`;
                try {
                    const parsed = JSON.parse(errorText);
                    if (parsed.error?.message) errMsg = parsed.error.message;
                } catch(e) {}
                
                // Enterprise Level 10: Version & Schema Auto-Recovery
                // 1. If v1beta failed with 404, try v1
                if (resp.status === 404 && targetUrl.includes('/v1beta')) {
                    this.logger.warn(`[AI-ENGINE] v1beta failed for Gemini (404). Retrying with v1...`);
                    return fetchGoogle(targetUrl.replace('/v1beta', '/v1'));
                }
                
                // 2. If rejected due to system_instruction (schema error), retry without it (moved to contents)
                if (resp.status === 400 && errorText.includes('system_instruction') && options.systemPrompt && !options.isSchemaRetry) {
                    this.logger.warn(`[AI-ENGINE] Gemini rejected system_instruction. Retrying with instruction merged into messages...`);
                    return await this.callGoogle(url, prompt, history, { ...options, isSchemaRetry: true, forceLegacySystem: true }, p);
                }
                
                throw new Error(errMsg);
            }
            return resp.json();
        };

        const data = await fetchGoogle(finalUrl);
        
        if (!data.candidates || data.candidates.length === 0) {
            if (data.promptFeedback?.blockReason) throw new Error(`Google Safety Filter Blocked: ${data.promptFeedback.blockReason}`);
            throw new Error(`Google API Error: No candidates returned.`);
        }

        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
    async callAnthropic(url: string, prompt: string, history: any[], options: any, p: any) {
        const messages = [
            ...history,
            { role: 'user', content: prompt }
        ];
        const body = { 
            model: options.model || p.model || p.defaultModel, 
            messages, 
            system: options.systemPrompt,
            temperature: options.temperature ?? this.config.temperature,
            max_tokens: options.maxTokens ?? this.config.maxTokens
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

        if (!resp.ok) {
            const errText = await resp.text().catch(() => 'No error body');
            throw new Error(`Anthropic API Error ${resp.status}: ${errText}`);
        }

        const data = await resp.json(); 
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        return data.content?.[0]?.text || null;
    }
    async callCloudflare(url: string, prompt: string, history: any[], options: any, p: any): Promise<any> {
        const messages = [
            ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            ...history,
            { role: 'user', content: prompt }
        ];

        const model = options.model || p.defaultModel;

        let imagePayload: any = null;
        if (options.file && (options.file.startsWith('data:image') || options.fileType?.startsWith('image/'))) {
            try {
                const parts = options.file.split('base64,');
                imagePayload = parts.length > 1 ? parts[1] : options.file;
            } catch (e) {}
        }
        
        // Enterprise Level 10: Native Cloudflare Workers AI Binding (High Performance - "Direct")
        if (this.env && this.env.AI) {
            if (!model) {
                 throw new Error("Cloudflare Model is required even for direct AI binding. Please select one from the catalog.");
            }
            try {
                this.logger.log(`[AI-ENGINE] Using Direct CF AI Binding: ${model}`);
                const response = await (this.env.AI as any).run(model, { 
                    messages,
                    image: imagePayload ? Array.from(Uint8Array.from(atob(imagePayload), c => c.charCodeAt(0))) : undefined,
                    temperature: options.temperature ?? this.config.temperature,
                    max_tokens: options.maxTokens ?? this.config.maxTokens
                });
                return response.response || response.text || null;
            } catch (e: any) {
                this.logger.error(`[AI-ENGINE] Native Direct Cloudflare AI error: ${e.message}`);
                // Only fall back to API if we have enough info to try
            }
        }

        if (!model) throw new Error("Cloudflare Model ID is missing. Please check your Registry or select a model.");

        // Fallback to fetch API
        const apiToken = p.apiToken || p.apiKey || this.env?.CLOUDFLARE_API_TOKEN || this.env?.CF_API_TOKEN;
        const accountId = p.accountId || this.resolveAccountId(p, 'cloudflare');
        
        if (!apiToken && !this.env?.AI) {
            this.logger.error(`[AI-ENGINE] Cloudflare API Token missing and no direct AI binding available.`);
            throw new Error("Cloudflare configuration missing (API Token or AI Binding)");
        }

        if (!accountId && !this.env?.AI) {
            this.logger.error(`[AI-ENGINE] Cloudflare Account ID missing and direct binding failed.`);
            throw new Error("Cloudflare Account ID missing. Cannot call Cloudflare API.");
        }

        // Enterprise Level 10: Enterprise Template & Self-Healing URL Path
        let finalUrl = url;
        
        // Replace template tags (High priority)
        if (finalUrl.includes('{{accountId}}') && accountId) {
            finalUrl = finalUrl.replace(/\{\{accountId\}\}/g, accountId);
        }
        if (finalUrl.includes('{{model}}') && model) {
            finalUrl = finalUrl.replace(/\{\{model\}\}/g, model);
        }
        
        // Self-Healing Logic for Cloudflare Paths
        if (!finalUrl.includes('/accounts/')) {
             // Case: api.cloudflare.com/client/v4 -> transform to full path
             finalUrl = finalUrl.replace(/\/+$/, '') + `/accounts/${accountId}/ai/run/${model}`;
        } else if (finalUrl.includes('/accounts/{{accountId}}/') || finalUrl.includes('/accounts//')) {
             // Case: accountId was empty in Registry tag - fix it
             finalUrl = finalUrl.replace(/\/accounts\/([^/]*)\//, `/accounts/${accountId}/`);
        }

        // Final safety for /ai/run/
        if (finalUrl.includes('/ai/run/') && !finalUrl.endsWith(model)) {
             if (finalUrl.endsWith('/ai/run') || finalUrl.endsWith('/ai/run/')) {
                 finalUrl = finalUrl.replace(/\/+$/, '') + `/${model}`;
             }
        }

        this.logger.log(`[AI-ENGINE] Using Cloudflare API Fetch: ${finalUrl}`);

        const response = await this.fetch(finalUrl, { 
            method: 'POST', 
            headers: { 
                'Authorization': `Bearer ${apiToken}`, 
                'Content-Type': 'application/json' 
            }, 
            body: JSON.stringify({ 
                messages,
                image: imagePayload,
                temperature: options.temperature ?? this.config.temperature,
                max_tokens: options.maxTokens ?? this.config.maxTokens
            }) 
        });

        if (!response.ok) {
            const errText = await response.text();
            
            // Enterprise Level 10: Auto-Agreement for Llama models (Cloudflare specific)
            if (response.status === 403 && errText.includes('Model Agreement') && errText.includes("'agree'") && !options.isAgreementRetry) {
                this.logger.warn(`[AI-ENGINE] Cloudflare Model Agreement required for ${model}. Attempting auto-agreement...`);
                try {
                    // Send literal 'agree' prompt. We try both 'prompt' and 'messages' for maximum compatibility.
                    // Some CF models expect 'prompt' for special commands, others 'messages'.
                    const agreePayloads = [
                        { prompt: 'agree' },
                        { messages: [{ role: 'user', content: 'agree' }] }
                    ];

                    let agreed = false;
                    for (const payload of agreePayloads) {
                        const agreeResp = await this.fetch(finalUrl, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (agreeResp.ok) {
                            agreed = true;
                            break;
                        }
                    }
                    
                    if (agreed) {
                        this.logger.log(`[AI-ENGINE] Agreement submitted successfully. Retrying original prompt...`);
                        return await this.callCloudflare(url, prompt, history, { ...options, isAgreementRetry: true }, p);
                    } else {
                        this.logger.error(`[AI-ENGINE] Auto-agreement submission failed with all attempts.`);
                        if (errText.includes('European Union')) {
                            throw new Error("Llama 3 models on Cloudflare are restricted for users/accounts in the European Union. Please use a different model or provider.");
                        }
                    }
                } catch (retryErr: any) {
                    this.logger.error(`[AI-ENGINE] Auto-agreement process failed: ${retryErr.message}`);
                }
            }
            
            throw new Error(`Cloudflare API HTTP Error ${response.status}: ${errText}`);
        }

        const data = await response.json(); 
        if (!data.success) throw new Error(`Cloudflare API Error: ${JSON.stringify(data.errors)}`);
        return data.result?.response || data.result?.text || null;
    }
    extractJson(text: string) {
        if (!text || typeof text !== 'string') return null;
        
        // Enterprise Level 10: Ultra-Robust JSON Extraction
        let cleanText = text.trim();
        
        try {
            // 1. Direct try
            return JSON.parse(cleanText);
        } catch (e) {
            // 2. Try to find JSON block in markdown wrappers
            const mdMatch = cleanText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i) || 
                            cleanText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i);
            if (mdMatch) {
                try { return JSON.parse(mdMatch[1]); } catch (e) {}
            }
            
            // 3. Try to find the first { and last } or [ and ]
            const startBrace = cleanText.indexOf('{');
            const endBrace = cleanText.lastIndexOf('}');
            const startBracket = cleanText.indexOf('[');
            const endBracket = cleanText.lastIndexOf(']');
            
            let potential = '';
            if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
                potential = cleanText.substring(startBrace, endBrace + 1);
            } else if (startBracket !== -1 && endBracket !== -1 && endBracket > startBracket) {
                potential = cleanText.substring(startBracket, endBracket + 1);
            } else if (startBrace !== -1) {
                // Enterprise Level 10: Handle truncated JSON (No closing brace)
                potential = cleanText.substring(startBrace);
            } else if (startBracket !== -1) {
                potential = cleanText.substring(startBracket);
            }
            
            if (potential) {
                try {
                    // Try parsing with potential trailing comma removal for common LLM mistakes
                    let repaired = potential
                        .replace(/,\s*([\}\]])/g, '$1'); // Trailing commas
                    
                    return JSON.parse(repaired);
                } catch (e) {
                    // Enterprise Level 10: Last Ditch Effort - Handle common LLM JSON errors
                    try {
                        let betterRepaired = potential
                            .replace(/,\s*([\}\]])/g, '$1') // Trailing commas
                            .replace(/(\r\n|\n|\r)/gm, "\\n"); // Convert literal newlines to escaped \n for Markdown content
                        
                        return JSON.parse(betterRepaired);
                    } catch (ex) {
                        // Enterprise Level 10: Handle truncated JSON by closing tokens
                        if (potential.startsWith('{')) {
                            try {
                                return JSON.parse(potential.trim() + '" }');
                            } catch (ee) {
                                try { return JSON.parse(potential.trim() + ' }'); } catch (eee) {}
                            }
                        }
                    }
                    
                    // One last try: just plain JSON.parse on the potential string
                    try { return JSON.parse(potential); } catch (ex) {}
                }
            }
        }
        
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
                           "";
        }

        if (userTemplate === "{{message}}") {
            userTemplate = prompts[`${name}_user`] || 
                           prompts[name] ||
                           context.prompt || 
                           context.message || 
                           "";
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
        // Enterprise Level 10: Prioritize explicitly passed config, then fallback to global registry
        this.config = options.ai_config || options.registry?.AI_CONFIG || _registry?.AI_CONFIG;
        this.engine = new BaseAiEngine({ 
            config: this.config, 
            fetch: options.fetch, 
            db: options.db, 
            env: env,
            systemSetting: options.registry?.SYSTEM_SETTING || options.systemSetting
        });
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
        
        // Strictly from options, prompt context, or top-level model setting
        const model = options.model || promptContext.model || this.config.model;
        
        return this.chat(promptContext.prompt, options.history || [], { ...options, systemPrompt: promptContext.systemPrompt, model });
    }
    async extractEntities(text: string, schema: any, entityName: string, options: any = {}, db: any = null) {
        const registry = { ..._registry, AI_CONFIG: this.config };
        const promptConfig = await PROMPT_MANAGER.getPrompt({ db, registry, name: 'ENTITY_EXTRACTION', context: { entityName, schema: JSON.stringify(schema), text, lang: options.lang || registry?.DEFAULT_LANG } });
        const resp = await this.chat(promptConfig.prompt, [], { ...options, systemPrompt: promptConfig.systemPrompt, model: promptConfig.model || options.model, response_mime_type: 'application/json' });
        return this.engine.extractJson(resp);
    }

    /**
     * Enterprise Level 10: Global AI Dispatcher (Tool Use)
     * Maps modular actions from registry into AI-compatible tool specifications.
     */
    getModularTools(entities: any, lang: string = 'en') {
        if (!entities) return [];
        const tools: any[] = [];

        // 1. Generic DB Tools (System Level)
        tools.push({
            type: 'function',
            function: {
                name: 'db__query',
                description: 'Căutare generală în baza de date (SELECT). Folosește tabele precum lead, deal, task, contact, worker.',
                parameters: {
                    type: 'object',
                    properties: {
                        table: { type: 'string', description: 'Numele tabelei' },
                        filters: { type: 'object', description: 'Filtre (ex: { status: "active" })' },
                        limit: { type: 'number', default: 10 }
                    },
                    required: ['table']
                }
            }
        });

        tools.push({
            type: 'function',
            function: {
                name: 'db__get',
                description: 'Obține o singură înregistrare după ID.',
                parameters: {
                    type: 'object',
                    properties: {
                        table: { type: 'string' },
                        id: { type: 'string' }
                    },
                    required: ['table', 'id']
                }
            }
        });

        tools.push({
            type: 'function',
            function: {
                name: 'db__sync_schema',
                description: 'Sincronizează schema bazei de date cu definițiile codului. Folosește asta dacă observi erori de tip "no such column" sau "no such table".',
                parameters: { type: 'object', properties: {} }
            }
        });

        // 2. System Level Tools
        tools.push({
            type: 'function',
            function: {
                name: 'system__execute_shell',
                description: 'Execută o comandă shell pe agentul local (Windows). Folosește pentru scripturi, git, npm, sau verificări de fișiere.',
                parameters: {
                    type: 'object',
                    properties: {
                        command: { type: 'string', description: 'Comanda shell' },
                        cwd: { type: 'string', description: 'Working directory' }
                    },
                    required: ['command']
                }
            }
        });

        tools.push({
            type: 'function',
            function: {
                name: 'system__read_logs',
                description: 'Citește ultimele linii din log-uri. Folosește asta pentru a diagnostica erori raportate de utilizator.',
                parameters: {
                    type: 'object',
                    properties: {
                        lines: { type: 'number', description: 'Număr de linii de citit (default 50)' }
                    }
                }
            }
        });

        // 3. Modular Actions (Entity Level)
        Object.entries(entities).forEach(([entityId, entity]: [string, any]) => {
            const modularActions = (entity.actions || []);
            modularActions.forEach((action: any) => {
                // Skip internal-only actions if needed
                if (action.id === 'log' && entityId === 'system_error') return;

                tools.push({
                    type: 'function',
                    function: {
                        name: `${entityId}__${action.id}`,
                        description: `${entityId.toUpperCase()} Action: ${renderString(action.description || action.label, lang)}`,
                        parameters: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', description: 'Record ID (for item-level actions)' },
                                input: { type: 'object', description: 'Action payload (based on action schema)' }
                            },
                        }
                    }
                });
            });
        });

        return tools;
    }

    /**
     * Enterprise Level 10: AI Task Execution Loop
     * Allows the AI to autonomously plan and execute modular actions.
     */
    async runTask(task: string, ctx: any, options: any = {}) {
        const { db, registry, user, env, v3Entities } = ctx;
        const tools = this.getModularTools(v3Entities, options.lang || 'en');
        
        let history = options.history || [];
        let iterations = 0;
        const maxIterations = options.maxIterations || 5;

        this.engine.logger.log(`[AI-TASK] Starting task: "${task}" with ${tools.length} available tools.`);

        while (iterations < maxIterations) {
            iterations++;
            
            const response = await this.chat(task, history, {
                ...options,
                tools: tools.length > 0 ? tools : undefined,
                systemPrompt: options.systemPrompt || `Ești un asistent AI autonom pentru Studio App v3. 
Eut dispui de acces la diferite acțiuni (Tools). Planifică pașii necesari pentru a îndeplini sarcina utilizatorului.
Dacă sarcina este finalizată, răspunde cu un mesaj text final.`
            });

            // 1. Text response means task finished or needs more info
            if (typeof response === 'string') {
                return { success: true, result: response, history, iterations };
            }

            // 2. Tool Calls
            if (response && response.tool_calls) {
                const toolResults = [];
                for (const call of response.tool_calls) {
                    const [entityId, actionId] = call.function.name.split('__');
                    const args = typeof call.function.arguments === 'string' ? JSON.parse(call.function.arguments) : call.function.arguments;

                    this.engine.logger.log(`[AI-TASK] Tool Call: ${entityId}/${actionId}`);

                    try {
                        let result;

                        // Case 1: Generic DB Tools
                        if (entityId === 'db' && actionId === 'query') {
                            result = await db.query(`SELECT * FROM ${args.table} WHERE 1=1 ${Object.keys(args.filters || {}).map(k => `AND ${k} = ?`).join(' ')} LIMIT ?`, [...Object.values(args.filters || {}), args.limit || 10]);
                        } else if (entityId === 'db' && actionId === 'get') {
                            result = await db.get(args.table, args.id);
                        } else if (entityId === 'system' && actionId === 'execute_shell') {
                            // Call the Local Agent API
                            result = await api.local.post('system/execute', { command: args.command, cwd: args.cwd });
                        } else if (entityId === 'db' && actionId === 'sync_schema') {
                            // Enterprise Level 12: Database Maintenance Tools (Local Agent Sync)
                            result = await api.local.post('system/db/sync');
                        } else if (entityId === 'system' && actionId === 'read_logs') {
                            // Enterprise Level 12: Log Analysis Tools
                            result = await api.local.get('system/logs', { params: { lines: args.lines || 100 } });
                        }
                        // Case 2: Modular Entity Actions
                        else if (v3Entities?.[entityId]) {
                            const action = v3Entities[entityId].actions?.find((a: any) => a.id === actionId);
                            if (action) {
                                // Reconstruct context for the modular handler
                                const actionCtx = { 
                                    ...ctx, 
                                    collection: entityId, 
                                    id: args.id, 
                                    body: args.input,
                                    AiService // recurse!
                                };
                                result = await action.handler(actionCtx, args.input || args);
                            }
                        }

                        if (result === undefined) throw new Error(`Action ${entityId}/${actionId} not found or failed.`);

                        toolResults.push({
                            role: 'tool',
                            tool_call_id: call.id,
                            name: call.function.name,
                            content: JSON.stringify(result)
                        });
                    } catch (e: any) {
                        toolResults.push({
                            role: 'tool',
                            tool_call_id: call.id,
                            name: call.function.name,
                            content: JSON.stringify({ error: e.message })
                        });
                    }
                }

                // Add tool calls and results to history for next iteration
                history.push({
                    role: 'assistant',
                    tool_calls: response.tool_calls
                });
                history.push(...toolResults);
            } else {
                break;
            }
        }

        return { success: false, error: 'Max iterations reached', history };
    }

    // --- Enterprise Level 10: Test Connection ---
    async testConnection(providerName: string, db: any = null, options: any = {}) {
        try {
            const registry = { ..._registry, AI_CONFIG: this.config };
            const p = { ...this.config.providers?.[providerName], ...options };
            
            if (!p || Object.keys(p).length === 0) throw new Error(`Provider '${providerName}' not found in Registry.`);

            const apiKey = this.engine.resolveApiKey(p, providerName);
            const accountId = this.engine.resolveAccountId(p, providerName);

            this.engine.logger.log(`[AI-ENGINE] Testing connection for ${providerName} (Discovery Mode)...`);
            this.engine.logger.log(`[AI-ENGINE] Resolved Key: ${apiKey ? apiKey.substring(0, 5) + '...' : 'MISSING'} | Account: ${accountId || 'MISSING'}`);

            // Enterprise Level 10: Discovery Mode (Decoupled from specific model)
            // Tests the API Key/Credentials by attempting to list models.
            try {
                let discoveryUrl = p.baseUrl || "";
                let headers: any = { 'Content-Type': 'application/json' };

                if (p.type === 'google-v1beta' || discoveryUrl.includes('googleapis.com')) {
                    // Google Gemini discovery - Extract base up to version (v1/v1beta)
                    const baseMatch = discoveryUrl.match(/(https:\/\/generativelanguage\.googleapis\.com\/v[^\/]+)/);
                    const base = baseMatch ? baseMatch[1] : discoveryUrl.split('/models/')[0].split('/openai')[0].replace(/\/$/, '');
                    discoveryUrl = base + `/models?key=${apiKey}`;
                    
                    // Enterprise Level 10: Add native Google API Key header as well for maximum compatibility
                    headers['x-goog-api-key'] = apiKey;
                } else if (p.type === 'openai-v1' || p.type === 'github-v1' || discoveryUrl.includes('api.openai.com') || discoveryUrl.includes('azure.com') || discoveryUrl.includes('groq.com') || discoveryUrl.includes('deepseek.com')) {
                    // OpenAI-compatible discovery (OpenAI, GitHub, Groq, DeepSeek, etc.)
                    discoveryUrl = discoveryUrl.split('/chat/')[0].split('/completions')[0].split('?')[0].replace(/\/$/, '') + `/models`;
                    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
                    
                    // GitHub and Azure often require or prefer User-Agent
                    if (p.type === 'github-v1' || discoveryUrl.includes('azure.com')) {
                        headers['User-Agent'] = 'Studio-App-v2';
                    }
                } else if (p.type === 'anthropic-v1' || discoveryUrl.includes('anthropic.com')) {
                    // Anthropic discovery - handle potential /v1 in base
                    const base = discoveryUrl.split('/messages')[0].replace(/\/$/, '');
                    discoveryUrl = base.endsWith('/v1') ? base + '/models' : base + '/v1/models';
                    if (apiKey) {
                        headers['x-api-key'] = apiKey;
                        headers['anthropic-version'] = '2023-06-01';
                    }
                } else if (p.type === 'cloudflare-rpc' || discoveryUrl.includes('api.cloudflare.com')) {
                    // Cloudflare discovery
                    if (accountId) {
                        discoveryUrl = discoveryUrl.split('/accounts/')[0] + `/accounts/${accountId}/ai/models/search?limit=1`;
                        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
                    }
                }

                if (discoveryUrl && !discoveryUrl.includes('{{')) {
                    this.engine.logger.log(`[AI-ENGINE] Discovery Endpoint: ${discoveryUrl.split('key=')[0]}${discoveryUrl.includes('key=') ? 'key=***' : ''}`);
                    const resp = await this.engine.fetch(discoveryUrl, { method: 'GET', headers });
                    if (resp.ok) {
                        this.engine.logger.log(`[AI-ENGINE] Discovery successful for ${providerName}. API Credentials validated.`);
                        return {
                            success: true,
                            details: {
                                durationMs: 0,
                                model: "Discovery Endpoint (Authenticated)",
                                provider: providerName,
                                responseSnippet: "Connection Established! API Key is valid and authorized."
                            }
                        };
                    } else {
                        const err = await resp.text();
                        let parsedErr: any = {};
                        try { parsedErr = JSON.parse(err); } catch(e) {}
                        const msg = parsedErr.error?.message || err;
                        throw new Error(`Discovery Failed (${resp.status}): ${msg}`);
                    }
                }
                throw new Error("Discovery URL could not be resolved from Registry. Check baseUrl.");
            } catch (discErr: any) {
                this.engine.logger.error(`[AI-ENGINE] Discovery Failed for ${providerName}: ${discErr.message}`);
                return { success: false, message: discErr.message };
            }
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }
}

export class CurrencyService {
    private parser: XMLParser;
    constructor() { this.parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" }); }
    async fetchLatestRates() {
        const config = _registry?.CURRENCY || {};
        const bnrUrl = config.BASE_URL || '';
        const eurFallback = config.EUR_FALLBACK || 0;
        try {
            if (!bnrUrl) throw new Error("BNR URL missing in Registry");
            const resp = await fetch(bnrUrl);
            const jsonObj = this.parser.parse(await resp.text());
            const cube = jsonObj.DataSet.Body.Cube;
            const result: any = { date: cube['@_date'], rates: { EUR: eurFallback, USD: config.USD_FALLBACK || 0 } };
            const rates = Array.isArray(cube.Rate) ? cube.Rate : [cube.Rate];
            rates.forEach((r: any) => { if (r) result.rates[r['@_currency']] = parseFloat(r['#text']); });
            return result;
        } catch (e) { return { rates: { EUR: eurFallback }, date: new Date().toISOString() }; }
    }
}

