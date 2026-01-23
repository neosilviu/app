import React, { useState, useMemo } from 'react';
import {  Brain, Sparkles, Play, Code, Layout, Eye, Database, RefreshCw, X, AlertTriangle, Box } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { GlassCard } from '~/components/ui/GlassCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { api } from '~/lib/core';
import { useConfig } from '~/hooks/useConfig';
import { toast } from 'sonner';
import { DynamicEntityDetail } from './entity/DynamicEntityDetail';
import { DynamicEntityList } from './entity/DynamicEntityList';
import { EntityDefinitionsPanel } from './EntityDefinitionsPanel';

export function AiArchitectSandbox() {
    const { entity, refreshConfig } = useConfig();
    const [draftJson, setDraftJson] = useState<string>(
        JSON.stringify({
            label: "Product Prototype",
            labelPlural: "Products",
            icon: "Package",
            color: "blue",
            fields: {
                name: { label: "Product Name", type: "text", primary: true, required: true },
                price: { label: "Price", type: "number", grid: 6 },
                stock: { label: "Stock", type: "number", grid: 6 },
                category: { label: "Category", type: "enum", options: ["Electronics", "Food", "Tools"] },
                description: { label: "Description", type: "textarea" },
                is_active: { label: "Active Status", type: "boolean", grid: 12 }
            },
            menuConfig: {
                showInMainMenu: true,
                icon: "Package",
                priority: 10
            },
            layout: {
                sections: [
                    { title: "General Info", fields: ["name", "category", "description"] },
                    { title: "Inventory", fields: ["price", "stock", "is_active"] }
                ]
            }
        }, null, 2)
    );

    const [activeTab, setActiveTab] = useState('editor');
    const [isSaving, setIsSaving] = useState(false);
    const [mockData, setMockData] = useState<any[]>([]);

    const parsedDraft = useMemo(() => {
        try {
            return JSON.parse(draftJson);
        } catch (e) {
            return null;
        }
    }, [draftJson]);

    const generateMockData = () => {
        if (!parsedDraft || !parsedDraft.fields) return;
        const newMock = Array.from({ length: 5 }).map((_, i) => {
            const row: any = { id: i + 1 };
            Object.keys(parsedDraft.fields).forEach(key => {
                const f = parsedDraft.fields[key];
                const labelStr = typeof f.label === 'object' ? (f.label.ro || f.label.en || key) : (f.label || key);
                
                if (f.type === 'number' || f.type === 'currency') {
                    row[key] = Math.floor(Math.random() * 1000);
                } else if (f.type === 'boolean' || f.type === 'toggle') {
                    row[key] = Math.random() > 0.5;
                } else if (f.type === 'enum' || f.type === 'select') {
                    const opt = f.options?.[0];
                    row[key] = typeof opt === 'object' ? (opt.value || opt.id || opt.label?.en || opt.label?.ro) : (opt || 'Value');
                } else if (f.type === 'date' || f.type === 'datetime') {
                    row[key] = new Date().toISOString();
                } else if (f.type === 'email') {
                    row[key] = `contact${i+1}@example.com`;
                } else if (f.type === 'phone') {
                    row[key] = `072200000${i+1}`;
                } else if (f.type === 'image' || f.type === 'file') {
                    row[key] = 'https://picsum.photos/200';
                } else {
                    row[key] = `${labelStr} ${i + 1}`;
                }
            });
            return row;
        });
        setMockData(newMock);
        toast.success("Mock data generated for preview!");
    };

    const handleDeploy = async () => {
        if (!parsedDraft || !parsedDraft.label) {
            toast.error("Invalid entity definition");
            return;
        }

        const labelStr = typeof parsedDraft.label === 'object' 
            ? (parsedDraft.label.en || parsedDraft.label.ro || Object.values(parsedDraft.label)[0]) 
            : (parsedDraft.label || parsedDraft.name || 'new_entity');
            
        const entityId = String(labelStr).toLowerCase().replace(/\s+/g, '_');
        
        if (confirm(`Deploy entity "${entityId}" to Registry and Database?`)) {
            setIsSaving(true);
            try {
                const res = await api.brain.post(`entity/${entityId}`, {
                    ...parsedDraft,
                    name: entityId // Force name to match
                });
                if (res.success) {
                    toast.success("Blueprint Deployed Successfully!");
                    await refreshConfig();
                } else {
                    toast.error("Deployment failed: " + res.error);
                }
            } catch (err) {
                toast.error("Network error during deployment");
            } finally {
                setIsSaving(false);
            }
        }
    };

    const [aiRequest, setAiRequest] = useState('');
    const [isAiGenerating, setIsAiGenerating] = useState(false);

    const handleGenerateArchitecture = async () => {
        if (!aiRequest) return;
        setIsAiGenerating(true);
        try {
            const res = await api.brain.post('ai', {
                action: 'architect',
                prompt: aiRequest
            });

            if (res.success && res.data) {
                // Prettify the JSON if we get an object
                const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
                setDraftJson(content);
                toast.success("Blueprint generat cu succes!");
            } else {
                toast.error("Eroare AI: " + (res.error || "Format invalid"));
            }
        } catch (e: any) {
            toast.error("Eroare: " + e.message);
        } finally {
            setIsAiGenerating(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 px-2">
                <div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-100 flex items-center justify-center text-white">
                            <Brain size={24} />
                        </div>
                        Blueprint <span className="text-indigo-600">Architect</span>
                    </h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">Enterprise Level 8 Metadata IDE</p>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-xl h-12 px-6 border-slate-200 font-bold hover:bg-slate-50" onClick={generateMockData}>
                        <Play size={16} className="mr-2 text-indigo-600" /> GENERATE MOCK
                    </Button>
                    <Button 
                        disabled={isSaving || !parsedDraft} 
                        onClick={handleDeploy}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black italic uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-xl shadow-indigo-100 dark:shadow-none transition-all hover:scale-105"
                    >
                        {isSaving ? <RefreshCw className="animate-spin" /> : <Database size={16} className="mr-2" />}
                        DEPLOY BLUEPRINT
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="px-2 mb-4">
                    <TabsList className="bg-slate-200/50 dark:bg-slate-900/50 p-1.5 rounded-2xl h-14 w-full justify-start gap-2 backdrop-blur-sm">
                        <TabsTrigger value="editor" className="rounded-xl px-6 font-black italic uppercase tracking-widest text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-indigo-600">
                            <Code size={14} className="mr-2" /> DNA EDITOR
                        </TabsTrigger>
                        <TabsTrigger value="list-preview" className="rounded-xl px-6 font-black italic uppercase tracking-widest text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-indigo-600">
                            <Layout size={14} className="mr-2" /> LIST PREVIEW
                        </TabsTrigger>
                        <TabsTrigger value="detail-preview" className="rounded-xl px-6 font-black italic uppercase tracking-widest text-[10px] data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-indigo-600">
                            <Eye size={14} className="mr-2" /> DETAIL PREVIEW
                        </TabsTrigger>
                        <TabsTrigger value="manual-builder" className="rounded-xl px-6 font-black italic uppercase tracking-widest text-[10px] data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md">
                            <Box size={14} className="mr-2" /> MANUAL BUILDER
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden px-2">
                    <TabsContent value="manual-builder" className="h-full m-0 overflow-y-auto pb-10 custom-scrollbar">
                        <EntityDefinitionsPanel />
                    </TabsContent>

                    <TabsContent value="editor" className="h-full m-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                            <GlassCard className="md:col-span-2 p-0 overflow-hidden border-slate-200 flex flex-col h-full ring-1 ring-slate-100">
                                <div className="bg-slate-900 text-slate-400 px-6 py-3 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        <span className="ml-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Metadata JSON Specification</span>
                                    </div>
                                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-[9px] font-black uppercase tracking-widest">
                                        {parsedDraft ? 'Valid DNA' : 'Invalid DNA'}
                                    </Badge>
                                </div>
                                <textarea 
                                    className="flex-1 p-6 font-mono text-sm bg-slate-950 text-indigo-300 resize-none outline-none selection:bg-indigo-500/30"
                                    value={draftJson}
                                    onChange={(e) => setDraftJson(e.target.value)}
                                    spellCheck={false}
                                />
                            </GlassCard>

                            <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                                <GlassCard className="p-6 border-indigo-100 bg-indigo-50/30 ring-1 ring-indigo-100/50">
                                    <h3 className="font-black italic uppercase tracking-tighter text-lg mb-4 flex items-center gap-2 text-indigo-900">
                                        <Sparkles size={18} className="text-indigo-600" /> AI Generator
                                    </h3>
                                    <p className="text-xs text-indigo-700/70 font-medium mb-4 leading-relaxed">
                                        Describe what kind of entity you need and the AI Architect will generate the Level 8 DNA structure.
                                    </p>
                                    <textarea 
                                        placeholder="Ex: Am nevoie de o entitate pentru deal cu CRM statusuri, campuri de suma si data, si integrare cu Whatsapp..."
                                        value={aiRequest}
                                        onChange={(e) => setAiRequest(e.target.value)}
                                        className="w-full h-32 p-4 rounded-xl bg-white border border-indigo-100 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300"
                                    />
                                    <Button 
                                        onClick={handleGenerateArchitecture}
                                        disabled={isAiGenerating || !aiRequest}
                                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black italic uppercase tracking-widest text-[10px] h-12 shadow-lg shadow-indigo-100"
                                    >
                                        {isAiGenerating ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Sparkles size={16} className="mr-2" />}
                                        GENERATE METADATA
                                    </Button>
                                </GlassCard>

                                <GlassCard className="p-6 border-slate-200 border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/5">
                                    <div className="flex gap-3">
                                        <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                                        <div>
                                            <h4 className="font-black italic uppercase tracking-tighter text-sm mb-1 text-amber-900 dark:text-amber-200">Architect Warning</h4>
                                            <p className="text-xs text-amber-700/70 dark:text-amber-400/70 leading-relaxed font-medium">
                                                Deploying a new blueprint will automatically trigger a database DDL sync. Make sure your field names match existing data if you are updating.
                                            </p>
                                        </div>
                                    </div>
                                </GlassCard>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="list-preview" className="h-full m-0 overflow-y-auto">
                        {parsedDraft ? (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[40px] min-h-full">
                                <DynamicEntityList 
                                    entityId="prototype" 
                                    config={{ ...parsedDraft, mockup: true, data: mockData }} 
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-red-500 font-black italic uppercase">
                                <X size={24} className="mr-2" /> Invalid JSON Definition
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="detail-preview" className="h-full m-0 overflow-y-auto">
                        {parsedDraft ? (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[40px] min-h-full">
                                <DynamicEntityDetail 
                                    entityId="prototype" 
                                    recordId="new" 
                                    config={parsedDraft} 
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-red-500 font-black italic uppercase">
                                <X size={24} className="mr-2" /> Invalid JSON Definition
                            </div>
                        )}
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}


