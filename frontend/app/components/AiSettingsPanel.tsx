import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Badge } from '~/components/ui/badge';
import { GlassCard } from '~/components/ui/GlassCard';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "~/components/ui/accordion";
import { Settings as Save, RefreshCw, Sparkles, Cloud, Plus, Trash, Shield, Database, MessageSquare, Loader2, CheckCircle2, XCircle, Send, Brain, Github, Bot, Search, LayoutGrid, Zap, Cpu, History, HelpCircle } from 'lucide-react';
import { cn } from '~/lib/utils';
import { toast } from 'sonner';
import { getErrorMessage } from '~/lib/utils';
import { useConfig } from '~/hooks/useConfig';
import { api, renderString } from '~/lib/core';
import { AiModelCatalog } from './monitoring/AiModelCatalog';

export function AiSettingsPanel() {
    const { lang = 'ro' } = useParams();
    const { constants, refreshConfig } = useConfig();
    const { t } = useTranslation(['ai_settings', 'common']);

    // Local States
    const [config, setConfig] = useState<any>(constants.AI_CONFIG || {});
    const [activeProviders, setActiveProviders] = useState<string[]>(config.activeProviders || []);
    const [currentProvider, setCurrentProvider] = useState<string>(activeProviders[0] );
    
    // Global AI Parameters
    const [params, setParams] = useState<any>({
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 2048,
        ragEnabled: config.ragEnabled ?? true,
        autoReplyEnabled: config.autoReplyEnabled ?? false,
        agentPersonality: config.agentPersonality || 'professional',
        model: config.model || '',
        helpProvider: config.help_provider || 'cloudflare',
        helpModel: config.help_model || '',
        changelogProvider: config.changelog_provider || 'cloudflare',
        changelogModel: config.changelog_model || '',
        chatProvider: config.chat_provider || '__inherit__',
        chatModel: config.chat_model || '__inherit__'
    });
    
    // Provider specific settings
    const [providers, setProviders] = useState<any>(config.providers || {});
    
    // Level 8: Dynamic Icon Resolution
    const ICON_MAP: Record<string, any> = { Brain, Cloud, RefreshCw, Sparkles, Github, Bot, Search, LayoutGrid, Zap, Cpu };

    const [aiPrompts, setAiPrompts] = useState(constants.AI_PROMPT || {
        system: [],
        global: [],
        workspaceTemplates: []
    });
    
    const [isSaving, setIsSaving] = useState(false);

    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, 'success' | 'error'>>({});
    const [unifiedModels, setUnifiedModels] = useState<any[]>([]);

    const fetchUnifiedCatalog = async () => {
        try {
            console.log("[AI-SETTINGS] Fetching unified catalog...");
            const res = await api.brain.get("ai/catalog");
            const data = res.data || res;
            
            // If data is still the success wrapper, peel it
            const payload = data.merged ? data : (data.data || {});
            const merged = payload.merged || {};
            
            const list: any[] = [];
            Object.keys(merged).forEach(p => {
                // Enterprise Level 8: Filter by Active Providers and Enabled status
                const isProviderActive = (activeProviders || []).includes(p);
                
                merged[p].forEach((m: any) => {
                    // Include if: 
                    // 1. It's enabled in inventory AND provider is active
                    // 2. OR it's the currently selected model (regardless of status, for UI stability)
                    if ((m.enabled && isProviderActive) || m.id === params.model) {
                        list.push(m);
                    }
                });
            });

            // De-duplicate if the selected model was added twice
            const uniqueList = Array.from(new Map(list.map(m => [m.id, m])).values());
            
            setUnifiedModels(uniqueList);
            console.log("[AI-SETTINGS] Unified models refreshed:", uniqueList.length, "Active Providers:", activeProviders);
        } catch (e) {
            console.error("Failed to fetch unified catalog", e);
        }
    };

    useEffect(() => {
        fetchUnifiedCatalog();
    }, [constants, activeProviders, params.model]);

    const testConnection = async (id: string) => {
        setTestingProvider(id);
        const apiKey = providers[id]?.apiKey || providers[id]?.apiToken || '';
        
        try {
            // Level 8: Resilient model selection for connection testing
            const providerConfig = providers[id];
            
            // Try to find an enabled model for THIS specific provider first
            const modelFromUnified = unifiedModels.find(m => m.provider === id)?.id;
            const modelFromProvider = providerConfig?.defaultModel || (providerConfig?.models && providerConfig.models?.[0]);
            
            // Fallback: If no model found for this provider, try to find ANY enabled model 
            // as some providers are OpenAI-compatible and might work with other model IDs in a pinch
            const fallbackModel = unifiedModels.length > 0 ? unifiedModels[0].id : undefined;

            const model = modelFromUnified || modelFromProvider || fallbackModel;
            const accountId = providers[id]?.accountId;

            const res = await api.post('ai/test-connection', { 
                provider: id,
                apiKey,
                accountId,
                model
            });

            if (res.success) {
                setTestResults(prev => ({ ...prev, [id]: 'success' }));
                toast.success(`${id.toUpperCase()} connected successfully!`);
            } else {
                setTestResults(prev => ({ ...prev, [id]: 'error' }));
                toast.error(`Connection failed: ${res.error || 'Check your keys'}`);
            }
        } catch (err: any) {
            setTestResults(prev => ({ ...prev, [id]: 'error' }));
            toast.error(`Error: ${err.message}`);
        } finally {
            setTestingProvider(null);
            setTimeout(() => {
                setTestResults(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
            }, 5000);
        }
    };

    // Sync from registry when constants change
    useEffect(() => {
        if (constants.AI_CONFIG) {
            const cfg = constants.AI_CONFIG;
            setConfig(cfg);
            setActiveProviders(cfg.active_providers || []);
            setProviders(cfg.providers || {});
            setParams({
                temperature: cfg.temperature || 0.7,
                maxTokens: cfg.max_tokens || 2048,
                ragEnabled: cfg.rag_enabled ?? true,
                autoReplyEnabled: cfg.auto_reply_enabled ?? false,
                agentPersonality: cfg.agent_personality || 'professional',
                model: cfg.model || '',
                helpProvider: cfg.help_provider || 'cloudflare',
                helpModel: cfg.help_model || '',
                changelogProvider: cfg.changelog_provider || 'cloudflare',
                changelogModel: cfg.changelog_model || '',
                chatProvider: cfg.chat_provider || '',
                chatModel: cfg.chat_model || ''
            });
        }
        if (constants.AI_PROMPT) {
            setAiPrompts(constants.AI_PROMPT);
        }
    }, [constants]);

    const handleSaveAiConfig = async () => {
        setIsSaving(true);
        try {
            const updates = [
                { namespace: 'ai_config', key: 'active_providers', value: activeProviders },
                { namespace: 'ai_config', key: 'model', value: params.model },
                { namespace: 'ai_config', key: 'temperature', value: params.temperature },
                { namespace: 'ai_config', key: 'max_tokens', value: params.maxTokens },
                { namespace: 'ai_config', key: 'rag_enabled', value: params.ragEnabled },
                { namespace: 'ai_config', key: 'help_provider', value: 'cloudflare' },
                { namespace: 'ai_config', key: 'help_model', value: params.helpModel },
                { namespace: 'ai_config', key: 'changelog_provider', value: 'cloudflare' },
                { namespace: 'ai_config', key: 'changelog_model', value: params.changelogModel },
                { namespace: 'ai_config', key: 'chat_provider', value: params.chatProvider === '__inherit__' ? '' : params.chatProvider },
                { namespace: 'ai_config', key: 'chat_model', value: params.chatModel === '__inherit__' ? '' : params.chatModel },
                { namespace: 'ai_config', key: 'providers', value: providers },
                { namespace: 'ai_config', key: 'enabled', value: true }
            ];

            // Level 8: Batch save to avoid multiple HMR/Cache invalidations
            await Promise.all(updates.map(u => 
                api.brain.post('registry/save', u)
            ));

            toast.success("AI Infrastructure saved!");
            await refreshConfig(true);
        } catch (e: any) {
            toast.error(getErrorMessage(e, 'Failed to update registry'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAiPrompts = async () => {
        setIsSaving(true);
        try {
            const promises = [];
            if (aiPrompts.system) promises.push(api.brain.post('registry/save', { namespace: 'AI_PROMPT', key: 'system', value: aiPrompts.system }));
            if (aiPrompts.global) promises.push(api.brain.post('registry/save', { namespace: 'AI_PROMPT', key: 'global', value: aiPrompts.global }));
            if (aiPrompts.workspaceTemplates) promises.push(api.brain.post('registry/save', { namespace: 'AI_PROMPT', key: 'workspaceTemplates', value: aiPrompts.workspaceTemplates }));
            if (aiPrompts.language_instruction) promises.push(api.brain.post('registry/save', { namespace: 'AI_PROMPT', key: 'language_instruction', value: aiPrompts.language_instruction }));

            if (promises.length > 0) {
                await Promise.all(promises);
            }
            
            toast.success("Prompt DNA updated!");
            await refreshConfig(true);
        } catch (e: any) {
            toast.error(getErrorMessage(e, 'Failed to update prompts'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <GlassCard className="border-2 border-blue-200/30">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <Cloud size={20} />
                            </div>
                            <div>
                                <CardTitle>AI Infrastructure (SuperAdmin)</CardTitle>
                                <CardDescription>Manage global providers and model registry</CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Active Providers */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Active Providers</Label>
                            <button 
                                onClick={() => {
                                    const allP = Object.keys(providers || {});
                                    const isAll = activeProviders.length === allP.length;
                                    setActiveProviders(isAll ? [] : allP);
                                }}
                                className="text-[8px] font-black uppercase text-blue-500 hover:text-blue-700 transition-colors"
                            >
                                {activeProviders.length === Object.keys(providers || {}).length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-8 gap-2">
                            {Object.entries(providers || {}).map(([p, pDef]: [string, any]) => {
                                const Icon = ICON_MAP[pDef.icon] || Sparkles;
                                return (
                                    <div key={p} className={cn(
                                        "p-2 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center gap-1",
                                        (activeProviders || []).includes(p) ? "bg-blue-50 border-blue-200" : "bg-white border-slate-100 opacity-50 gray-grayscale"
                                    )} onClick={() => {
                                        setCurrentProvider(p);
                                        if ((activeProviders || []).includes(p)) {
                                            setActiveProviders(activeProviders.filter(x => x !== p));
                                        } else {
                                            setActiveProviders([...(activeProviders || []), p]);
                                        }
                                    }}>
                                        <div className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center">
                                            <Icon className={cn("h-3 w-3", pDef.iconColor)} size={12} />
                                        </div>
                                        <span className="text-[8px] font-black uppercase tracking-tight text-center truncate w-full">{pDef.typeName || p}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Provider Credentials */}
                    <div className="space-y-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Provider Credentials (API Keys)</Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {activeProviders.map(pId => {
                                const pDef = providers[pId] || {};
                                const hasAccountId = pDef.accountId !== undefined;
                                return (
                                    <div key={pId} className="space-y-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm relative group overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/10 group-hover:bg-blue-500/50 transition-all"></div>
                                        <div className="flex justify-between items-center">
                                            <Label className="text-[8px] font-black uppercase tracking-widest">{pDef.typeName || pId}</Label>
                                            <button 
                                                onClick={() => testConnection(pId)}
                                                disabled={testingProvider === pId}
                                                className={cn(
                                                    "text-[8px] font-black uppercase transition-all px-1.5 py-0.5 rounded flex items-center gap-1",
                                                    testResults[pId] === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                    testResults[pId] === 'error' ? "bg-red-50 text-red-600 border border-red-100" : 
                                                    "bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 border border-slate-100"
                                                )}
                                            >
                                                {testingProvider === pId ? <Loader2 size={10} className="animate-spin" /> : 
                                                 testResults[pId] === 'success' ? <CheckCircle2 size={10} /> :
                                                 testResults[pId] === 'error' ? <XCircle size={10} /> : null}
                                                {testingProvider === pId ? "..." : 
                                                 testResults[pId] === 'success' ? "OK" :
                                                 testResults[pId] === 'error' ? "Err" : "Test"}
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            {hasAccountId && (
                                                <div className="space-y-0.5">
                                                    <Label className="text-[8px] font-bold text-slate-400 uppercase">Account</Label>
                                                    <Input 
                                                        value={pDef.accountId || ''} 
                                                        onChange={(e) => setProviders({...providers, [pId]: {...pDef, accountId: e.target.value}})}
                                                        placeholder="Account ID..."
                                                        className="h-7 text-[10px] bg-slate-50/30 font-medium px-2"
                                                    />
                                                </div>
                                            )}
                                            <div className="space-y-0.5">
                                                <Label className="text-[8px] font-bold text-slate-400 uppercase">{hasAccountId ? 'Token' : 'API Key'}</Label>
                                                <Input 
                                                    type="password" 
                                                    value={pDef.apiKey || pDef.apiToken || ''} 
                                                    onChange={(e) => setProviders({...providers, [pId]: {...pDef, apiKey: e.target.value, apiToken: e.target.value}})}
                                                    placeholder="..."
                                                    className="h-7 text-[10px] bg-slate-50/30 font-medium px-2"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Global AI Parameters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Default Production Model</Label>
                            <Select value={params.model} onValueChange={(v) => setParams({...params, model: v})}>
                                <SelectTrigger className="h-7 text-[10px] font-black italic">
                                    <SelectValue placeholder="Select Model..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {unifiedModels.length > 0 ? unifiedModels.map(m => (
                                        <SelectItem key={m.id} value={m.id} className="text-[9px] font-bold">
                                            {m.name || m.id} <span className="opacity-50 text-[7px]">({m.provider})</span>
                                        </SelectItem>
                                    )) : (
                                        <SelectItem value="none" disabled className="text-[9px] italic text-slate-400">
                                            Enable models in AI Inventory...
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Temperature ({params.temperature})</Label>
                            <input 
                                type="range" min="0" max="1" step="0.1" 
                                value={params.temperature}
                                onChange={(e) => setParams({...params, temperature: parseFloat(e.target.value)})}
                                className="w-full h-1 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Max Tokens</Label>
                            <Input 
                                type="number" 
                                value={params.maxTokens}
                                onChange={(e) => setParams({...params, maxTokens: parseInt(e.target.value)})}
                                className="h-7 text-[10px] font-bold px-2"
                            />
                        </div>
                    </div>

                    {/* RAG & Features */}
                    <div className="flex gap-2">
                        <div className={cn(
                            "flex-1 p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between",
                            params.ragEnabled ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 opacity-60"
                        )} onClick={() => setParams({...params, ragEnabled: !params.ragEnabled})}>
                            <div className="flex items-center gap-1.5">
                                <div className="p-1 bg-white rounded-lg shadow-sm text-indigo-500">
                                    <Database size={12} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-tight">RAG (Memory)</span>
                            </div>
                            <div className={cn("w-1.5 h-1.5 rounded-full", params.ragEnabled ? "bg-indigo-500 animate-pulse" : "bg-slate-300")} />
                        </div>

                        <div className={cn(
                            "flex-1 p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between",
                            params.autoReplyEnabled ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-100 opacity-60"
                        )} onClick={() => setParams({...params, autoReplyEnabled: !params.autoReplyEnabled})}>
                            <div className="flex items-center gap-1.5">
                                <div className="p-1 bg-white rounded-lg shadow-sm text-emerald-500">
                                    <MessageSquare size={12} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-tight">Auto-Reply Logic</span>
                            </div>
                            <div className={cn("w-1.5 h-1.5 rounded-full", params.autoReplyEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                        </div>
                    </div>

                    {/* Specialized Agent Overrides */}
                    <div className="space-y-4 p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/50">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 italic">Specialized Agent Overrides</Label>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Help AI */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 px-0.5">
                                    <HelpCircle size={12} className="text-indigo-500" />
                                    <Label className="text-[9px] font-black uppercase tracking-tight">Help & Documentation AI</Label>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2 px-3 h-7 bg-white rounded-md border border-slate-100">
                                        <Cloud size={10} className="text-blue-500" />
                                        <span className="text-[9px] font-black uppercase text-slate-500">Cloudflare Native</span>
                                    </div>
                                    <Select value={params.helpModel} onValueChange={(v) => setParams({...params, helpModel: v, helpProvider: 'cloudflare'})}>
                                        <SelectTrigger className="h-7 text-[9px] font-bold bg-white">
                                            <SelectValue placeholder="Select Help Model..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {unifiedModels.filter(m => m.provider === 'cloudflare').map(m => (
                                                <SelectItem key={m.id} value={m.id} className="text-[9px] font-bold">{m.name || m.id}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Changelog AI */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 px-0.5">
                                    <History size={12} className="text-amber-500" />
                                    <Label className="text-[9px] font-black uppercase tracking-tight">Changelog AI (Git History)</Label>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2 px-3 h-7 bg-white rounded-md border border-slate-100">
                                        <Cloud size={10} className="text-blue-500" />
                                        <span className="text-[9px] font-black uppercase text-slate-500">Cloudflare Native</span>
                                    </div>
                                    <Select value={params.changelogModel} onValueChange={(v) => setParams({...params, changelogModel: v, changelogProvider: 'cloudflare'})}>
                                        <SelectTrigger className="h-7 text-[9px] font-bold bg-white">
                                            <SelectValue placeholder="Select Changelog Model..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {unifiedModels.filter(m => m.provider === 'cloudflare').map(m => (
                                                <SelectItem key={m.id} value={m.id} className="text-[9px] font-bold">{m.name || m.id}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Chat AI */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 px-0.5">
                                    <MessageSquare size={12} className="text-emerald-500" />
                                    <Label className="text-[9px] font-black uppercase tracking-tight">Chat & Interaction AI</Label>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Select value={params.chatProvider} onValueChange={(v) => setParams({...params, chatProvider: v})}>
                                        <SelectTrigger className="h-7 text-[9px] font-bold bg-white">
                                            <SelectValue placeholder="Inherit Global..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__inherit__" className="text-[9px] font-bold italic opacity-50">Inherit Global</SelectItem>
                                            {activeProviders.map(p => (
                                                <SelectItem key={p} value={p} className="text-[9px] font-medium uppercase">{providers[p]?.typeName || p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={params.chatModel} onValueChange={(v) => setParams({...params, chatModel: v})}>
                                        <SelectTrigger className="h-7 text-[9px] font-bold bg-white">
                                            <SelectValue placeholder="Inherit Global..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__inherit__" className="text-[9px] font-bold italic opacity-50">Inherit Global</SelectItem>
                                            {unifiedModels.filter(m => params.chatProvider === '__inherit__' || m.provider === params.chatProvider).map(m => (
                                                <SelectItem key={m.id} value={m.id} className="text-[9px] font-bold">{m.name || m.id}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Model Discovery & Registry */}
                    <div className="space-y-6">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Advanced Model Management</Label>
                        
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4">
                            <AiModelCatalog selectedProvider={activeProviders} />
                        </div>
                    </div>

                    <Button 
                        className="w-full h-12 rounded-2xl bg-slate-900 text-white font-black uppercase italic tracking-widest text-[11px] shadow-xl shadow-slate-200"
                        onClick={handleSaveAiConfig}
                        disabled={isSaving}
                    >
                        {isSaving ? <RefreshCw className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                        Save Global Infrastructure
                    </Button>
                </CardContent>
            </GlassCard>

            <GlassCard className="border-2 border-indigo-200/30">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <CardTitle>System Prompt DNA (SuperAdmin)</CardTitle>
                            <CardDescription>Core behaviors that cannot be deleted</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-3 space-y-6">
                    {/* System Core Section */}
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic px-1">System Core DNA (Level 8)</Label>
                        <div className="grid grid-cols-1 gap-3">
                            {(aiPrompts.system || []).map((p: any, idx: number) => (
                                <div key={p.id} className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/20"></div>
                                    <div className="flex justify-between items-center px-1">
                                        <div className="flex items-center gap-1.5">
                                            <Shield size={12} className="text-indigo-500" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">{renderString(p.name || p.id, lang)}</span>
                                        </div>
                                        <div className="text-[7px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 uppercase">ReadOnly Logic</div>
                                    </div>
                                    <textarea 
                                        className="w-full h-24 p-2.5 rounded-lg bg-slate-50 border-none text-[10px] font-medium leading-relaxed outline-none focus:ring-1 focus:ring-indigo-100 transition-all custom-scrollbar"
                                        value={p.content}
                                        onChange={(e) => {
                                            const newPrompts = { ...aiPrompts };
                                            newPrompts.system[idx].content = e.target.value;
                                            setAiPrompts(newPrompts);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Workspace Templates Section */}
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 italic px-1">Workspace Personality Templates</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(aiPrompts.workspaceTemplates || []).map((p: any, idx: number) => (
                                <div key={p.id} className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">{renderString(p.name || p.id, lang)}</span>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-300" onClick={() => {
                                            const newTemplates = (aiPrompts.workspaceTemplates || []).filter((_: any, i: number) => i !== idx);
                                            setAiPrompts({ ...aiPrompts, workspaceTemplates: newTemplates });
                                        }}><Trash size={10} /></Button>
                                    </div>
                                    <textarea 
                                        className="w-full h-16 p-2 rounded-lg bg-slate-50 border-none text-[9px] font-medium outline-none focus:ring-1 focus:ring-indigo-100 transition-all"
                                        value={p.content}
                                        onChange={(e) => {
                                            const newPrompts = { ...aiPrompts };
                                            newPrompts.workspaceTemplates[idx].content = e.target.value;
                                            setAiPrompts(newPrompts);
                                        }}
                                        placeholder="Templates for new workspaces..."
                                    />
                                </div>
                            ))}
                            <Button 
                                variant="outline" 
                                className="h-24 border-dashed border-2 rounded-xl flex flex-col gap-1 text-slate-400 hover:text-indigo-600 hover:border-indigo-200"
                                onClick={() => {
                                    const id = `ws_template_${Date.now()}`;
                                    setAiPrompts({
                                        ...aiPrompts,
                                        workspaceTemplates: [...(aiPrompts.workspaceTemplates || []), { id, name: { ro: 'Nou Template', en: 'New Template' }, content: '' }]
                                    });
                                }}
                            >
                                <Plus size={20} />
                                <span className="text-[9px] font-black uppercase">Add Template</span>
                            </Button>
                        </div>
                    </div>
                    
                    <Button 
                        variant="default"
                        className="w-full h-12 rounded-2xl bg-indigo-600 text-white font-black uppercase italic tracking-widest text-[11px] shadow-xl shadow-indigo-100"
                        onClick={handleSaveAiPrompts}
                        disabled={isSaving}
                    >
                        {isSaving ? <RefreshCw className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                        Update Global AI DNA
                    </Button>
                </CardContent>
            </GlassCard>

            <div className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest pb-8">
                Registry Storage Source: D1 [SYSTEM_SETTING]
            </div>
        </div>
    );
}

