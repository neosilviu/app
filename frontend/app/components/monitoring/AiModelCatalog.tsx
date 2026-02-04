import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Search, RefreshCcw, Cpu, Sparkles, BookOpen, Layers, ShieldCheck, Wand2, Zap, CheckCircle2 } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/lib/services";
import { useConfig } from "~/hooks/useConfig";
import { toast } from "sonner";

export const AiModelCatalog = ({ selectedProvider }: { selectedProvider?: string | string[] }) => {
    const { constants, refreshConfig } = useConfig();
    const providers = constants.AI_CONFIG?.providers || {};
    
    const [catalog, setCatalog] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [syncing, setSyncing] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [latencies, setLatencies] = useState<Record<string, number>>({});
    const [testing, setTesting] = useState<string | null>(null);

    // State for local edits
    const [enabledModels, setEnabledModels] = useState<Record<string, boolean>>({});
    const [internalNames, setInternalNames] = useState<Record<string, string>>({});

    const autoGenerateAll = () => {
        const newNames = { ...internalNames };
        allModels.forEach(m => {
            if (!newNames[m.id]) {
                newNames[m.id] = generateFriendlyName(m);
            }
        });
        setInternalNames(newNames);
        toast.info("Magic names generated for empty slots");
    };

    const generateFriendlyName = (m: any) => {
        let name = m.name || m.id;
        const id: string = m.id || "";
        
        // Level 8: Generic model name resolution
        // Special case for GitHub Azure ML URIs (azureml://.../models/Name/versions/1)
        if (id.startsWith('azureml://') && id.includes('/models/')) {
            const match = id.match(/\/models\/([^/]+)/);
            if (match) name = match[1];
        } else if (id.includes('/') && !id.startsWith('@cf/')) {
            // Standard slash-separated IDs (except Cloudflare which uses them as paths)
            const parts = id.split('/');
            // If the last part is a version number (integer), take the second to last part
            const last = parts.pop();
            if (last && /^\d+$/.test(last) && parts.length > 0) {
                const candidate = parts.pop();
                if (candidate === 'versions' && parts.length > 0) {
                    name = parts.pop() || candidate;
                } else {
                    name = candidate || last;
                }
            } else {
                name = last || id;
            }
        }

        // Level 8: Catch-all for numeric/useless names (like '1' or 'versions')
        if ((/^\d+$/.test(name) || name.toLowerCase() === 'versions') && id.length > name.length) {
            const parts = id.split(/[/_-]/).filter(p => !/^\d+$/.test(p) && p.toLowerCase() !== 'versions');
            if (parts.length > 0) name = parts[parts.length - 1];
        }

        // Generic cleanup and title casing
        return name
            .replace(/-/g, ' ')
            .replace(/_/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add spaces between camelCase
            .replace(/\b[a-z]/g, (l: string) => l.toUpperCase()) // Capitalize words
            .replace(/Instruct/i, '') // Remove redundant "Instruct"
            .trim();
    };

    const runSpeedTest = async (modelId: string, provider: string) => {
        setTesting(modelId);
        const start = Date.now();
        try {
            const res = await api.post('ai/test-connection', { 
                model: modelId, 
                provider 
            });
            if (res.success) {
                const latency = res.latency || (Date.now() - start);
                setLatencies(prev => ({ ...prev, [modelId]: latency }));
                toast.success(`${modelId} Speed: ${latency}ms`);
            } else {
                toast.error(`Speed test failed: ${res.error || 'Server error'}`);
            }
        } catch (e: any) {
            toast.error(`Test failed: ${e.message}`);
        } finally {
            setTesting(null);
        }
    };

    const allModels = React.useMemo(() => {
        if (!catalog || !catalog.merged) return [];
        
        // Level 8: Unified Model Aggregation with Contextual Filtering
        let combined: any[] = [];
        
        if (selectedProvider && selectedProvider !== 'all') {
            // Support both single string and array/multiple selection
            const selection = Array.isArray(selectedProvider) ? selectedProvider : [selectedProvider];
            
            combined = selection.flatMap(p => {
                const providerModels = catalog.merged[p] || [];
                return providerModels.map((m: any) => ({
                    ...m,
                    provider: p,
                    type: (m.source === 'd1' || m.source === 'dynamic') ? 'dynamic' : 'built-in'
                }));
            });
        } else {
            // No filter or "all": Show everything from all providers
            combined = Object.entries(catalog.merged).flatMap(([p, models]: [string, any]) => 
                (models || []).map((m: any) => ({
                    ...m,
                    provider: p,
                    type: (m.source === 'd1' || m.source === 'dynamic') ? 'dynamic' : 'built-in'
                }))
            );
        }

        // Sort by enabled status first, then alphabetically
        combined.sort((a, b) => {
            const aEnabled = enabledModels[a.id] ? 1 : 0;
            const bEnabled = enabledModels[b.id] ? 1 : 0;
            if (aEnabled !== bEnabled) return bEnabled - aEnabled;
            return (a.name || a.id).localeCompare(b.name || b.id);
        });
        
        if (!search) return combined;
        
        return combined.filter(m => 
            (m.name || m.id)?.toLowerCase().includes(search.toLowerCase()) || 
            (m.id || "")?.toLowerCase().includes(search.toLowerCase()) ||
            (m.provider || "")?.toLowerCase().includes(search.toLowerCase())
        );
    }, [catalog, search, enabledModels, selectedProvider]);

    const allSelected = allModels.length > 0 && allModels.every(m => enabledModels[m.id]);

    const toggleAll = () => {
        const nextValue = !allSelected;
        const nextEnabled = { ...enabledModels };
        allModels.forEach(m => {
            nextEnabled[m.id] = nextValue;
        });
        setEnabledModels(nextEnabled);
        toast.info(nextValue ? `Enabled ${allModels.length} models` : `Disabled ${allModels.length} models`);
    };

    const fetchCatalog = async () => {
        setLoading(true);
        try {
            const res = await api.brain.get("ai/catalog");
            const data = res.data || res;
            setCatalog(data);

            // Populate states from overrides
            const overrides = data.overrides || {};
            const initialEnabled: Record<string, boolean> = {};
            const initialNames: Record<string, string> = {};

            // Unified models from merged key
            const mergedProviders = Object.keys(data.merged || {});
            mergedProviders.forEach(p => {
                (data.merged?.[p] || []).forEach((m: any) => {
                    const modelId = m.id;
                    const ov = overrides[modelId] || {};
                    // Level 8: Discovered models are enabled by default once detected
                    // This ensures "detection" feels immediate to the user.
                    initialEnabled[modelId] = ov.enabled !== undefined ? ov.enabled : true;
                    initialNames[modelId] = ov.internalName || generateFriendlyName(m);
                });
            });

            setEnabledModels(initialEnabled);
            setInternalNames(initialNames);
        } catch (e) {
            console.error("Failed to fetch AI catalog:", e);
        } finally {
            setLoading(false);
        }
    };

    const syncActive = async () => {
        setLoading(true);
        try {
            // Level 8 Logic: Filter providers to sync based on selectedProvider prop OR all active providers
            const providersToSync = selectedProvider 
                ? (Array.isArray(selectedProvider) ? selectedProvider : [selectedProvider])
                : Object.keys(catalog?.merged || {});

            if (providersToSync.length === 0) {
                toast.error("No target provider to sync");
                return;
            }

            toast.info(`Inventory Update: Syncing ${providersToSync.length} provider(s)...`);

            const results = await Promise.allSettled(providersToSync.map(p => 
                api.brain.post("ai/sync-models", { provider: p })
            ));
            
            let totalDiscovered = 0;
            let successCount = 0;
            let errorMsg = "";

            results.forEach((r: any, idx: number) => {
                if (r.status === 'fulfilled') {
                    const res = r.value?.data || r.value;
                    if (res?.count) {
                        totalDiscovered += res.count;
                        successCount++;
                    }
                } else {
                    const p = providersToSync[idx];
                    console.warn(`[CATALOG] Sync failed for provider: ${p}`, r.reason);
                    errorMsg = r.reason?.response?.data?.error || r.reason?.message || "Sync failed for some providers";
                }
            });

            if (successCount > 0) {
                toast.success(`Sync completed. Discovered ${totalDiscovered} validated models.`);
            } else if (errorMsg) {
                toast.error(`Sync failed: ${errorMsg}`);
            }
            
            await fetchCatalog();
        } catch (e: any) {
            toast.error("Discover-sync encountered issues");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCatalog(); }, []);

    const saveChanges = async () => {
        setSaving(true);
        try {
            const updates = Object.keys(enabledModels).map(id => {
                const modelData = allModels.find(m => m.id === id);
                return {
                    id,
                    enabled: enabledModels[id],
                    internalName: internalNames[id] || undefined,
                    provider: modelData?.provider,
                    capabilities: modelData?.capabilities
                };
            }); 

            await api.brain.post("ai/update-catalog", { models: updates });
            toast.success("AI Inventory updated successfully");
            if (refreshConfig) refreshConfig(true);
            fetchCatalog();
        } catch (e: any) {
            toast.error(`Failed to save: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const syncProvider = async (provider: string) => {
        setSyncing(provider);
        try {
            const res = await api.brain.post("ai/sync-models", { provider });
            const count = res?.data?.count || res?.count || 0;
            toast.success(`Synced ${count} models from ${provider}`);
            fetchCatalog();
        } catch (e: any) {
            toast.error(`Sync failed: ${e.message}`);
        } finally {
            setSyncing(null);
        }
    };

    if (loading && !catalog) {
        return <div className="p-8 text-center text-slate-400 font-black italic animate-pulse">LOADING_MODEL_DNA...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-md">
                            <Layers size={18} />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase italic tracking-tighter">AI Inventory</p>
                            <p className="text-[9px] uppercase font-bold text-slate-400">
                                {allModels.length} models detected
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input 
                                placeholder="Search models..." 
                                className="pl-9 h-9 w-48 rounded-xl border-slate-200 bg-white text-xs"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={syncActive} 
                            disabled={loading}
                            className="h-9 w-9 rounded-xl border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                            title={selectedProvider ? `Refresh ${Array.isArray(selectedProvider) ? selectedProvider.join(', ') : selectedProvider} models` : "Sync all active providers"}
                        >
                            <RefreshCcw size={14} className={cn(loading && "animate-spin")} />
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={autoGenerateAll}
                            className="h-9 px-3 rounded-xl border-slate-200 bg-white text-[9px] font-black uppercase italic tracking-widest gap-2 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                        >
                            <Wand2 size={12} />
                            Magic Names
                        </Button>
                        <Button 
                            onClick={saveChanges} 
                            disabled={saving}
                            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase italic tracking-widest gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                        >
                            <ShieldCheck size={14} />
                            {saving ? "SAVING..." : "Save Changes"}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                <div className="max-h-[400px] overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                            <tr>
                                <th className="w-10 px-3 py-2 text-[8px] font-black uppercase italic text-slate-400 border-b border-slate-100">
                                    <div className="flex items-center gap-1">
                                        <input 
                                            type="checkbox" 
                                            className="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-500 cursor-pointer"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            title="Select/Deselect All Visible"
                                        />
                                        <span>Use</span>
                                    </div>
                                </th>
                                <th className="px-4 py-2 text-[8px] font-black uppercase italic text-slate-400 border-b border-slate-100">Model Name</th>
                                <th className="w-24 px-3 py-2 text-[8px] font-black uppercase italic text-slate-400 border-b border-slate-100 text-center">Latency</th>
                                <th className="w-[300px] px-3 py-2 text-[8px] font-black uppercase italic text-slate-400 border-b border-slate-100">Alias</th>
                                <th className="px-3 py-2 text-[8px] font-black uppercase italic text-slate-400 border-b border-slate-100">Provider</th>
                                <th className="px-3 py-2 text-[8px] font-black uppercase italic text-slate-400 border-b border-slate-100">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[10px]">
                            {allModels.map((m: any, idx: number) => (
                                <tr key={m.id + idx} className={cn(
                                    "hover:bg-indigo-50/10 transition-colors group",
                                    !enabledModels[m.id] && "opacity-60 bg-slate-50/50"
                                )}>
                                    <td className="px-3 py-2">
                                        <input 
                                            type="checkbox" 
                                            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-500"
                                            checked={!!enabledModels[m.id]}
                                            onChange={(e) => setEnabledModels(prev => ({ ...prev, [m.id]: e.target.checked }))}
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black italic text-slate-700">{m.name || m.id}</span>
                                                <div 
                                                    className="h-3.5 w-3.5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] text-slate-400 font-bold cursor-help"
                                                    title={`Technical ID: ${m.id}\nContext Window: ${m.contextWindow ? (m.contextWindow / 1024).toFixed(0) + 'k' : 'Unknown'} tokens`}
                                                >
                                                    ?
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {(m.capabilities || []).map((c: string) => (
                                                    <Badge 
                                                        key={c} 
                                                        variant="outline" 
                                                        className={cn(
                                                            "text-[6px] leading-tight px-1 py-0 border-slate-200 uppercase font-black tracking-tighter",
                                                            c === 'vision' ? "bg-purple-50 text-purple-600 border-purple-100" :
                                                            c === 'chat' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                                            c === 'long-context' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                            c === 'agentic' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                            c === 'fast' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                            "text-slate-400 font-bold"
                                                        )}
                                                    >
                                                        {c}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-center text-[10px]">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {testing === m.id ? (
                                                <div className="flex items-center gap-0.5">
                                                    <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"></div>
                                                    <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.1s]"></div>
                                                </div>
                                            ) : latencies[m.id] ? (
                                                <span className={cn(
                                                    "font-black italic",
                                                    latencies[m.id] < 500 ? "text-emerald-500" :
                                                    latencies[m.id] < 1500 ? "text-amber-500" : "text-rose-500"
                                                )}>
                                                    {latencies[m.id]}ms
                                                </span>
                                            ) : null}
                                            
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100"
                                                onClick={() => runSpeedTest(m.id, m.provider)}
                                                disabled={testing === m.id}
                                            >
                                                <Zap size={10} className={cn(testing === m.id && "animate-spin text-indigo-500")} />
                                            </Button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <Input 
                                            className="h-7 text-[9px] font-bold bg-white/50 border-slate-200 rounded-md px-2"
                                            placeholder="..."
                                            value={internalNames[m.id] || ""}
                                            onChange={(e) => setInternalNames(prev => ({ ...prev, [m.id]: e.target.value }))}
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <Badge className={cn(
                                            "uppercase text-[7px] font-black italic px-1.5 py-0 border-none",
                                            providers[m.provider]?.color || "bg-slate-200 text-slate-600"
                                        )}>
                                            {providers[m.provider]?.typeName || providers[m.provider]?.name || m.provider}
                                        </Badge>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1 opacity-50">
                                            {m.type === 'built-in' ? (
                                                <ShieldCheck size={9} className="text-emerald-500" />
                                            ) : (
                                                <RefreshCcw size={9} className="text-blue-500" />
                                            )}
                                            <span className="text-[7px] font-black uppercase text-slate-500">{m.type}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

