import React from 'react';
import { Card, CardTitle, CardDescription } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Sparkles, Bot, Cpu, Plus, Trash, ShieldCheck, MessageSquareQuote, CheckCircle2, XCircle, Loader2, Send, Database, LayoutGrid, Bug, RefreshCw, Activity, Terminal, Brain, Github, Search, Zap, Cloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BufferedInput, BufferedTextarea } from '~/components/ui/BufferedInput';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion';
import { useConfig } from '~/hooks/useConfig';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { AIInsights } from '~/components/monitoring/AIInsights';

import { useParams } from 'react-router';
import { renderString } from '~/lib/core';
import { cn, formatForRender } from '~/lib/utils';
import { api } from '~/lib/services';

interface AITabProps {
    settings: any; // Workspace Settings
    setSettings: (s: any) => void;
    systemSettings: any; // System Settings (SuperAdmin)
    setSystemSettings: (s: any) => void;
    updateSystemSetting: (key: string, value: any, namespace?: string) => void;
    // Monitoring Props
    aiStats?: any;
    cloudflareStats?: any;
    isAIOperating?: boolean;
    aiTestOutput?: string | null;
    handleSyncRAG?: () => void;
    handleTestAIQuality?: () => void;
}

export const AITab: React.FC<AITabProps> = ({ 
    settings, 
    setSettings, 
    systemSettings, 
    setSystemSettings,
    updateSystemSetting,
    aiStats,
    cloudflareStats,
    isAIOperating = false,
    aiTestOutput = null,
    handleSyncRAG = () => {},
    handleTestAIQuality = () => {}
}) => {
    const { t } = useTranslation(['settings', 'common', 'monitoring']);
    const { constants } = useConfig();
    const { lang } = useParams();

    const ICON_MAP: Record<string, any> = { Brain, Cpu, Github, Bot, Sparkles, Zap, Cloud, RefreshCw, Search, LayoutGrid };

    const [testingProvider, setTestingProvider] = React.useState<string | null>(null);
    const [testResults, setTestResults] = React.useState<Record<string, { status: 'success' | 'error', message: string }>>({});
    const [diagLog, setDiagLog] = React.useState<string[]>([]);
    const [isReindexing, setIsReindexing] = React.useState(false);
    const [isAuditing, setIsAuditing] = React.useState(false);

    React.useEffect(() => {
        setDiagLog([t('ai_dashboard:synapse_ready')]);
    }, [t]);

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString();
        setDiagLog(prev => [...prev.slice(-10), `[${time}] ${msg}`]);
    };

    const runQualityTest = async () => {
        setTestingProvider('quality');
        addLog(t('ai_dashboard.starting_quality_test'));
        try {
            const res = await api.post('ai/test-quality', {});
            if (res.success) {
                addLog(t('ai_dashboard.quality_ok', { latency: res.latency, logic: res.diagnostic?.logic || 'OK' }));
            } else {
                addLog(t('ai_dashboard:quality_error', { error: res.error }));
            }
        } catch (err: any) {
            addLog(t('ai_dashboard:fatal_error', { error: err.message }));
        } finally {
            setTestingProvider(null);
        }
    };

    const runSyncRAG = async () => {
        addLog(t('ai_dashboard:syncing_rag'));
        try {
            const res = await api.post('ai/sync-rag', {});
            if (res.success) {
                addLog(t('ai_dashboard.sync_success', { count: res.count || 0 }));
            } else {
                addLog(`✗ SYNC ERROR: ${res.error}`);
            }
        } catch (err: any) {
            addLog(`✗ SYNC FATAL: ${err.message}`);
        }
    };

    const runReindex = async () => {
        setIsReindexing(true);
        addLog(t('ai_dashboard:reindexing_kb'));
        try {
            const res = await api.post('ai/reindex-knowledge', {});
            addLog(t('ai_dashboard:reindex_success', { message: res.message }));
        } catch (err: any) {
            addLog(t('ai_dashboard:reindex_failed'));
        } finally {
            setIsReindexing(false);
        }
    };

    const runAudit = async () => {
        setIsAuditing(true);
        addLog(t('ai_dashboard:auditing_registry'));
        try {
            const res = await api.post('ai/audit-registry', {});
            addLog(t('ai_dashboard:audit_success', { 
                status: res.status, 
                count: res.issues?.length || 0 
            }));
            addLog(t('ai_dashboard:audit_report', { report: res.report }));
        } catch (err: any) {
            addLog(t('ai_dashboard:audit_failed'));
        } finally {
            setIsAuditing(false);
        }
    };

    const testConnection = async (id: string, provider: any) => {
        setTestingProvider(id);
        // Priority: Workspace Settings -> System settings
        const apiKey = settings?.ai?.[`${id}_api_key`] || systemSettings?.ai?.[`${id}_api_key`] || '';
        
        try {
            const res = await api.post('ai/test-connection', { 
                provider: id,
                apiKey
            });

            if (res.success) {
                setTestResults(prev => ({ ...prev, [id]: { status: 'success', message: 'Connected' } }));
            } else {
                setTestResults(prev => ({ ...prev, [id]: { status: 'error', message: res.error || 'Failed' } }));
            }
        } catch (err: any) {
            setTestResults(prev => ({ ...prev, [id]: { status: 'error', message: err.message || 'Error' } }));
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

    // Registry Source (SuperAdmin Definitions)
    const globalConfig = constants.AI_CONFIG ?? {};
    
    // Convert current configuration models to array for UI mapping
    // Filtered by ENABLED models and active providers
    const globalModels = React.useMemo(() => {
        const models = Array.isArray(globalConfig.models) ? globalConfig.models : [];
        const activeProviders = globalConfig.active_providers || [];
        
        return models
            .filter((m: any) => activeProviders.includes(m.provider) && m.enabled !== false)
            .map((m: any) => ({
                id: m.id,
                name: m.name || m.id,
                provider: m.provider || 'generic'
            }));
    }, [globalConfig.models, globalConfig.active_providers]);
    
    // Workspace Specific AI Settings
    const wsAi = settings?.ai ?? {
        preferredModel: globalConfig?.model,
        temperature: globalConfig?.temperature,
        maxTokens: globalConfig?.max_tokens,
        customPrompts: []
    };

    const updateWsAi = (key: string, value: any) => {
        setSettings({
            ...settings,
            ai: { ...(settings?.ai ?? {}), [key]: value }
        });
    };

    const addPrompt = () => {
        const newPrompts = [...(wsAi?.customPrompts ?? []), { id: `ws_${Date.now()}`, name: renderString(t('common:new_prompt'), lang), content: '' }];
        updateWsAi('customPrompts', newPrompts);
    };

    const removePrompt = (id: string) => {
        const newPrompts = (wsAi?.customPrompts ?? []).filter((p: any) => p.id !== id);
        updateWsAi('customPrompts', newPrompts);
    };

    const updatePrompt = (id: string, field: string, value: any) => {
        const newPrompts = (wsAi?.customPrompts ?? []).map((p: any) => 
            p.id === id ? { ...p, [field]: value } : p
        );
        updateWsAi('customPrompts', newPrompts);
    };

    return (
        <div className="space-y-6">
            {/* HIGH-DENSITY STATS - Enterprise Level 10 Header (Synapse Identity) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 rounded-[2.5rem] bg-indigo-500 text-white border-none shadow-xl shadow-indigo-100 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase italic opacity-70 tracking-widest">Synapse Core</p>
                        <p className="text-xl font-black italic tracking-tighter uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                            {globalModels.find((m: any) => m.id === wsAi.preferredModel)?.name || ''}
                        </p>
                        <p className="text-[8px] font-bold uppercase opacity-60 italic">Motor Principal Activ</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
                        <Sparkles className="h-6 w-6" />
                    </div>
                </Card>

                <Card className="p-4 rounded-[2.5rem] bg-orange-100 border-none shadow-xl shadow-orange-50 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase italic text-orange-500 tracking-widest">Compute Grid</p>
                        <p className="text-xl font-black italic text-orange-950 tracking-tighter">
                            {globalConfig.activeProviders?.length || 0} ACTIVE
                        </p>
                        <p className="text-[8px] font-bold uppercase text-orange-500/60 italic">Infrastructură Cloud Grid</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center">
                        <Cpu className="h-6 w-6" />
                    </div>
                </Card>

                <Card className="p-4 rounded-[2.5rem] bg-emerald-100 border-none shadow-xl shadow-emerald-50 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase italic text-emerald-600 tracking-widest">Neural Index</p>
                        <p className="text-xl font-black italic text-emerald-950 tracking-tighter">
                            {aiStats?.vectorCount || 0}
                        </p>
                        <p className="text-[8px] font-bold uppercase text-emerald-600/60 italic">Embeddings în Baza de Cunoștințe</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center">
                        <Database className="h-6 w-6" />
                    </div>
                </Card>

                <Card className="p-4 rounded-[2.5rem] bg-slate-800 border-none shadow-xl shadow-slate-200 flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase italic text-slate-400 tracking-widest">Active Synapses</p>
                        <p className="text-xl font-black italic text-white tracking-tighter">
                            {aiStats?.activeAgents || 11}
                        </p>
                        <p className="text-[8px] font-bold uppercase text-slate-500 italic">Sesiuni și Agenți AI Activi</p>
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-slate-700 text-indigo-400 flex items-center justify-center border border-slate-600">
                        <LayoutGrid className="h-6 w-6" />
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT: Diagnostic & Logs (40%) */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="border-none shadow-xl shadow-slate-100 rounded-[2.5rem] p-6 bg-slate-900 text-slate-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-lg">
                                <Bug size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase italic tracking-widest text-white">Instrumente Diagnostic AI</h3>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">AI_CORE_X7_SYNAPSE ENGINE</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Button 
                                variant="outline" 
                                className="w-full h-11 rounded-2xl border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-indigo-400 font-black uppercase text-[10px] italic tracking-widest justify-start gap-3"
                                onClick={runSyncRAG}
                                disabled={isAIOperating}
                            >
                                <Sparkles size={14} />
                                Sincronizează Cunoștințele (RAG)
                            </Button>
                            
                            <Button 
                                variant="outline" 
                                className="w-full h-11 rounded-2xl border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-emerald-400 font-black uppercase text-[10px] italic tracking-widest justify-start gap-3"
                                onClick={runReindex}
                                disabled={isReindexing}
                            >
                                <RefreshCw size={14} className={isReindexing ? "animate-spin" : ""} />
                                Reindex Knowledge
                            </Button>

                            <Button 
                                variant="outline" 
                                className="w-full h-11 rounded-2xl border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-amber-400 font-black uppercase text-[10px] italic tracking-widest justify-start gap-3"
                                onClick={runQualityTest}
                                disabled={testingProvider === 'quality'}
                            >
                                <ShieldCheck size={14} />
                                Test Calitate Model
                            </Button>

                            <Button 
                                variant="outline" 
                                className="w-full h-11 rounded-2xl border-slate-800 bg-slate-800/50 hover:bg-slate-800 text-rose-400 font-black uppercase text-[10px] italic tracking-widest justify-start gap-3"
                                onClick={runAudit}
                                disabled={isAuditing}
                            >
                                <Activity size={14} />
                                Run Audit Path
                            </Button>
                        </div>

                        {/* Terminal Logic */}
                        <div className="mt-8 pt-6 border-t border-slate-800">
                            <div className="text-xs text-indigo-400 mb-2 font-mono flex items-center gap-2">
                                <Terminal size={14} />
                                {t("ai_dashboard.terminal_title")}
                            </div>
                            <div className="bg-black/50 rounded-3xl p-4 font-mono text-[9px] min-h-[120px] space-y-1">
                                {diagLog.map((log, i) => (
                                    <div key={i} className={cn(
                                        "leading-relaxed",
                                        log.includes('✗') ? "text-red-400" : 
                                        log.includes('✓') ? "text-emerald-400" :
                                        log.includes('>') ? "text-indigo-400" : "text-slate-500"
                                    )}>
                                        {log}
                                    </div>
                                ))}
                                <div className="animate-pulse text-indigo-500">_</div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* RIGHT: Active Config (60%) */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 rounded-[2rem] bg-indigo-500/5 border border-indigo-100/50 flex flex-col gap-1">
                            <p className="text-[9px] font-black uppercase italic text-indigo-500/60 tracking-widest">Active Model</p>
                            <p className="text-xs font-black italic text-slate-700 truncate">{globalModels.find((m: any) => m.id === wsAi.preferredModel)?.name || ''}</p>
                        </div>
                        <div className="p-4 rounded-[2rem] bg-emerald-500/5 border border-emerald-100/50 flex flex-col gap-1">
                            <p className="text-[9px] font-black uppercase italic text-emerald-500/60 tracking-widest">Inventory</p>
                            <p className="text-xs font-black italic text-slate-700">{globalModels.length} Models Ready</p>
                        </div>
                        <div className="p-4 rounded-[2rem] bg-orange-500/5 border border-orange-100/50 flex flex-col gap-1">
                            <p className="text-[9px] font-black uppercase italic text-orange-500/60 tracking-widest">Temperature</p>
                            <p className="text-xs font-black italic text-slate-700">{wsAi.temperature || 0.7} Precision</p>
                        </div>
                        <div className="p-4 rounded-[2rem] bg-slate-500/5 border border-slate-100/50 flex flex-col gap-1">
                            <p className="text-[9px] font-black uppercase italic text-slate-500/60 tracking-widest">Token Limit</p>
                            <p className="text-xs font-black italic text-slate-700">{wsAi.maxTokens || 2048} Tokens</p>
                        </div>
                    </div>

                    <Card className="border-none shadow-xl shadow-slate-100 rounded-[2.5rem] p-6 bg-white/50 backdrop-blur-sm space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-100">
                                <Cpu size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase italic tracking-widest">Core Intelligence</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Manage default model and behavioral parameters</p>
                            </div>
                        </div>
                        {/* Core settings form remains similarly but styled slightly more compact */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic ml-2">Preferred AI Engine</Label>
                                <Select value={wsAi.preferredModel} onValueChange={(v) => updateWsAi('preferredModel', v)}>
                                    <SelectTrigger className="h-10 rounded-2xl bg-white border-slate-100 font-bold text-xs">
                                        <SelectValue placeholder="Select a model..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                                        {globalModels.map((m: any) => (
                                            <SelectItem key={m.id} value={m.id} className="rounded-xl">
                                                <span className="font-bold text-xs italic">{m.name}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic ml-2">Temperature</Label>
                                    <BufferedInput type="number" step="0.1" value={wsAi.temperature} onChange={(v) => updateWsAi('temperature', parseFloat(v))} className="h-10 rounded-2xl bg-white border-slate-100 text-xs font-black" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic ml-2">Max Tokens</Label>
                                    <BufferedInput type="number" value={wsAi.maxTokens} onChange={(v) => updateWsAi('maxTokens', parseInt(v))} className="h-10 rounded-2xl bg-white border-slate-100 text-xs font-black" />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Infrastructure Card */}
                    <Card className="border-none shadow-xl shadow-slate-100 rounded-[2.5rem] p-6 bg-white/50 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-100">
                                <Bot size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase italic tracking-widest">Provider Infrastructure</h3>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {Object.entries(globalConfig.providers || {})
                                .filter(([id]) => (globalConfig.activeProviders || []).includes(id))
                                .map(([id, p]: [string, any]) => (
                                <div key={id} className="p-3 rounded-2xl border border-slate-100 flex items-center justify-between bg-white transition-all hover:shadow-md">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center">
                                            {(() => {
                                                const Icon = ICON_MAP[p.icon] || Bot;
                                                return <Icon className={cn("h-4 w-4", p.iconColor || "text-slate-400")} />;
                                            })()}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black italic text-slate-700 leading-none">{p.typeName || p.name || id}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{p.typeName || p.name || p.type || 'ACTIVE'}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-emerald-100 text-emerald-500 bg-emerald-50">ONLINE</Badge>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Collapsible Custom Prompts & DNA */}
            <div className="space-y-4">
                <Card className="border-none shadow-xl shadow-slate-100 rounded-[2.5rem] bg-white/50 backdrop-blur-sm overflow-hidden">
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="ws_prompts" className="border-none">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-indigo-500 text-white">
                                        <MessageSquareQuote size={18} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-black uppercase italic tracking-widest">Workspace Persona & Custom Prompts</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Contextual overrides for this environment</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 pt-0 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(wsAi?.customPrompts ?? []).map((prompt: any) => (
                                        <div key={prompt.id} className="p-4 rounded-[2rem] bg-white border border-slate-100 shadow-sm space-y-2 relative group mt-2">
                                            <div className="flex items-center justify-between">
                                                <BufferedInput 
                                                    value={prompt.name}
                                                    onChange={(v) => updatePrompt(prompt.id, 'name', v)}
                                                    className="h-7 w-2/3 rounded-lg border-none bg-slate-50 font-black italic text-[10px] tracking-tight"
                                                />
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-300 hover:text-red-500" onClick={() => removePrompt(prompt.id)}>
                                                    <Trash size={12} />
                                                </Button>
                                            </div>
                                            <BufferedTextarea 
                                                value={prompt.content}
                                                onChange={(v) => updatePrompt(prompt.id, 'content', v)}
                                                placeholder="Instruction..."
                                                className="min-h-[60px] rounded-xl border-none bg-slate-50/50 text-[10px] leading-snug resize-none"
                                            />
                                        </div>
                                    ))}
                                    <button 
                                        onClick={addPrompt}
                                        className="mt-2 p-4 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-300 hover:text-indigo-500 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-1 group min-h-[120px]"
                                    >
                                        <Plus className="group-hover:scale-125 transition-transform" />
                                        <span className="text-[8px] font-black uppercase tracking-widest">Add Persona</span>
                                    </button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </Card>
            </div>

            {/* AI Troubleshooting Output (Collapsible) */}
            {aiTestOutput && (
                <Card className="border-none shadow-xl shadow-red-100 rounded-[2.5rem] bg-slate-900 overflow-hidden">
                    <div className="p-3 flex items-center justify-between bg-slate-800/50">
                        <span className="text-[9px] font-black uppercase italic text-slate-400 tracking-widest">AI Debug Context</span>
                    </div>
                    <pre className="p-6 text-[10px] font-mono text-emerald-400 overflow-auto max-h-[180px] whitespace-pre-wrap">
                        {aiTestOutput}
                    </pre>
                </Card>
            )}
        </div>
    );
};

