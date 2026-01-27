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
import { Settings as Save, RefreshCw, Sparkles, Cloud, Plus, Trash, Shield, Database, MessageSquare } from 'lucide-react';
import { cn } from '~/lib/utils';
import { toast } from 'sonner';
import { getErrorMessage } from '~/lib/utils';
import { useConfig } from '~/hooks/useConfig';
import { api, renderString } from '~/lib/core';

export function AiSettingsPanel() {
    const { lang = 'ro' } = useParams();
    const { constants, refreshConfig } = useConfig();
    const { t } = useTranslation(['ai_settings', 'common']);

    // Local States
    const [config, setConfig] = useState(constants.AI_CONFIG || {});
    const [activeProviders, setActiveProviders] = useState<string[]>(config.activeProviders || ['gemini']);
    const [models, setModels] = useState<any[]>(config.models || []);
    
    // Global AI Parameters
    const [params, setParams] = useState({
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 2048,
        ragEnabled: config.ragEnabled ?? true,
        autoReplyEnabled: config.autoReplyEnabled ?? false,
        agentPersonality: config.agentPersonality || 'professional'
    });
    
    // Provider specific settings
    const [providers, setProviders] = useState(config.providers || {
        gemini: { apiKey: '' },
        anthropic: { apiKey: '' },
        cloudflare: { accountId: '', apiToken: '' }
    });

    const [aiPrompts, setAiPrompts] = useState(constants.AI_PROMPT || {
        system: [],
        global: [],
        workspaceTemplates: []
    });
    
    const [isSaving, setIsSaving] = useState(false);

    // Sync from registry when constants change
    useEffect(() => {
        if (constants.AI_CONFIG) {
            const cfg = constants.AI_CONFIG;
            setConfig(cfg);
            setActiveProviders(cfg.activeProviders || ['gemini']);
            setModels(cfg.models || []);
            setProviders(cfg.providers || {});
            setParams({
                temperature: cfg.temperature || 0.7,
                maxTokens: cfg.maxTokens || 2048,
                ragEnabled: cfg.ragEnabled ?? true,
                autoReplyEnabled: cfg.autoReplyEnabled ?? false,
                agentPersonality: cfg.agentPersonality || 'professional'
            });
        }
        if (constants.AI_PROMPT) {
            setAiPrompts(constants.AI_PROMPT);
        }
    }, [constants]);

    const handleSaveAiConfig = async () => {
        setIsSaving(true);
        try {
            await Promise.all([
                api.brain.post('registry/save', { namespace: 'AI_CONFIG', key: 'activeProviders', value: activeProviders }),
                api.brain.post('registry/save', { namespace: 'AI_CONFIG', key: 'models', value: models }),
                api.brain.post('registry/save', { namespace: 'AI_CONFIG', key: 'providers', value: providers }),
                api.brain.post('registry/save', { namespace: 'AI_CONFIG', key: 'temperature', value: params.temperature }),
                api.brain.post('registry/save', { namespace: 'AI_CONFIG', key: 'maxTokens', value: params.maxTokens }),
                api.brain.post('registry/save', { namespace: 'AI_CONFIG', key: 'ragEnabled', value: params.ragEnabled }),
                api.brain.post('registry/save', { namespace: 'AI_CONFIG', key: 'agentPersonality', value: params.agentPersonality }),
                api.brain.post('registry/save', { namespace: 'AI_CONFIG', key: 'enabled', value: true })
            ]);
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

    const addModel = () => {
        setModels([...models, { id: 'new-model', name: 'New Model', provider: 'gemini', isDefault: false, capabilities: [] }]);
    };

    const removeModel = (index: number) => {
        setModels(models.filter((_, i) => i !== index));
    };

    const updateModel = (index: number, field: string, value: any) => {
        const newModels = [...models];
        newModels[index] = { ...newModels[index], [field]: value };
        setModels(newModels);
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
                <CardContent className="space-y-8">
                    {/* Active Providers */}
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Active Providers</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {['gemini', 'anthropic', 'openai', 'cloudflare'].map(p => (
                                <div key={p} className={cn(
                                    "p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center gap-2",
                                    activeProviders.includes(p) ? "bg-blue-50 border-blue-200" : "bg-white border-slate-100 opacity-50 gray-grayscale"
                                )} onClick={() => {
                                    if (activeProviders.includes(p)) {
                                        setActiveProviders(activeProviders.filter(x => x !== p));
                                    } else {
                                        setActiveProviders([...activeProviders, p]);
                                    }
                                }}>
                                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                                        {p === 'gemini' && <div className="text-blue-500 font-black">G</div>}
                                        {p === 'anthropic' && <div className="text-orange-500 font-black">A</div>}
                                        {p === 'cloudflare' && <Cloud size={14} className="text-orange-400" />}
                                        {p === 'openai' && <RefreshCw size={14} className="text-green-500" />}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{p}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Global AI Parameters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Temperature ({params.temperature})</Label>
                            <input 
                                type="range" min="0" max="1" step="0.1" 
                                value={params.temperature}
                                onChange={(e) => setParams({...params, temperature: parseFloat(e.target.value)})}
                                className="w-full h-1 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Max Tokens</Label>
                            <Input 
                                type="number" 
                                value={params.maxTokens}
                                onChange={(e) => setParams({...params, maxTokens: parseInt(e.target.value)})}
                                className="h-8 text-[11px] font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Agent Personality</Label>
                            <Select value={params.agentPersonality} onValueChange={(v) => setParams({...params, agentPersonality: v})}>
                                <SelectTrigger className="h-8 text-[11px] font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="professional">Professional</SelectItem>
                                    <SelectItem value="creative">Creative / Friendly</SelectItem>
                                    <SelectItem value="technical">Technical / Concise</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* RAG & Features */}
                    <div className="flex gap-4">
                        <div className={cn(
                            "flex-1 p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between",
                            params.ragEnabled ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 opacity-60"
                        )} onClick={() => setParams({...params, ragEnabled: !params.ragEnabled})}>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white rounded-lg shadow-sm text-indigo-500">
                                    <Database size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">Enable RAG (Memory)</span>
                            </div>
                            <div className={cn("w-2 h-2 rounded-full", params.ragEnabled ? "bg-indigo-500 animate-pulse" : "bg-slate-300")} />
                        </div>

                        <div className={cn(
                            "flex-1 p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between",
                            params.autoReplyEnabled ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-100 opacity-60"
                        )} onClick={() => setParams({...params, autoReplyEnabled: !params.autoReplyEnabled})}>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-white rounded-lg shadow-sm text-emerald-500">
                                    <MessageSquare size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest">Auto-Reply Logic</span>
                            </div>
                            <div className={cn("w-2 h-2 rounded-full", params.autoReplyEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                        </div>
                    </div>

                    {/* Dynamic Model Registry */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Global Model Registry</Label>
                            <Button variant="ghost" size="sm" onClick={addModel} className="h-7 text-[9px] uppercase font-black">
                                <Plus size={14} className="mr-1" /> Add Model
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {models.map((m, idx) => (
                                <div key={idx} className="flex gap-2 p-3 bg-white rounded-xl border border-slate-100 shadow-sm group">
                                    <Input 
                                        value={m.id} 
                                        onChange={(e) => updateModel(idx, 'id', e.target.value)} 
                                        placeholder="model-id"
                                        className="h-8 text-[10px] font-mono border-none bg-slate-50"
                                    />
                                    <Input 
                                        value={m.name} 
                                        onChange={(e) => updateModel(idx, 'name', e.target.value)} 
                                        placeholder="Human Name"
                                        className="h-8 text-[10px] font-bold border-none"
                                    />
                                    <Select value={m.provider} onValueChange={(v) => updateModel(idx, 'provider', v)}>
                                        <SelectTrigger className="h-8 text-[10px] uppercase font-black border-none w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gemini">Gemini</SelectItem>
                                            <SelectItem value="anthropic">Claude</SelectItem>
                                            <SelectItem value="openai">OpenAI</SelectItem>
                                            <SelectItem value="cloudflare">Workerd AI</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="ghost" size="icon" onClick={() => removeModel(idx)} className="h-8 w-8 text-slate-300 hover:text-red-500">
                                        <Trash size={14} />
                                    </Button>
                                </div>
                            ))}
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
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        {(aiPrompts.system || []).map((p: any, idx: number) => (
                            <div key={p.id} className="space-y-2 p-4 bg-white rounded-2xl border border-slate-100">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <Shield size={14} className="text-indigo-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{renderString(p.name, lang)}</span>
                                    </div>
                                    <Badge variant="outline" className="text-[8px] border-indigo-200 text-indigo-500 font-black">LOCKED SYSTEM PROMPT</Badge>
                                </div>
                                <textarea 
                                    className="w-full h-32 p-4 rounded-xl bg-slate-50 border-none text-[11px] font-medium leading-relaxed outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
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
                    
                    <Button 
                        variant="default"
                        className="w-full h-12 rounded-2xl bg-indigo-600 text-white font-black uppercase italic tracking-widest text-[11px] shadow-xl shadow-indigo-100"
                        onClick={handleSaveAiPrompts}
                        disabled={isSaving}
                    >
                        {isSaving ? <RefreshCw className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                        Update Core Logic Templates
                    </Button>
                </CardContent>
            </GlassCard>

            <div className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest pb-8">
                Registry Storage Source: D1 [SYSTEM_SETTING]
            </div>
        </div>
    );
}

