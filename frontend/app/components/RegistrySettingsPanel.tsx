import React, { useState, useEffect } from 'react';
import { useConfig } from '~/hooks/useConfig';
import { useTranslation } from 'react-i18next';
import { 
    api, cn 
} from '~/lib/core';
import { toast } from 'sonner';
import { Search, RefreshCw, Save, FileCode, History, ChevronDown, ChevronRight, Database, Shield, Layout, Zap, Activity, Settings, Box, Palette, Globe, Lock, HardDrive } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { IconPicker } from './ui/IconPicker';
import { 
    Accordion, 
    AccordionContent, 
    AccordionItem, 
    AccordionTrigger 
} from './ui/accordion';

const ICON_MAP: Record<string, any> = {
    nav: Layout,
    ai: Zap,
    theme: Palette,
    auth: Shield,
    integrations: Globe,
    system: Settings,
    database: Database,
    socket: Activity,
    api: Lock,
    constants: Box,
    entities: Box,
    file: Box,
    i18n: Globe,
    worker: Activity,
    local_agent: HardDrive
};

export function RegistrySettingsPanel() {
    const { constants: cachedConstants, refreshConfig } = useConfig();
    const { t } = useTranslation(['common', 'superadmin', 'settings']);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [registryData, setRegistryData] = useState<any>(cachedConstants);

    // Load merged config from database (D1 values override baseline)
    useEffect(() => {
        const loadRegistry = async () => {
            setLoading(true);
            try {
                // 1. Fetch Cloud/D1 Registry
                const cloudRes = await api.brain.get('registry/get');
                const cloudData = cloudRes.success ? cloudRes.data : cloudRes;
                
                // 2. Fetch Local Agent Registry (if reachable)
                let agentData = null;
                try {
                    const agentRes = await api.local.get('registry');
                    if (agentRes && agentRes.success) {
                        agentData = agentRes.data;
                    }
                } catch (e) {
                    console.warn("[REGISTRY-PANEL] Local agent not reachable for registry sync");
                }

                // 3. Prepare Namespaces
                const namespacesObj: any = {};
                
                const processData = (data: any, prefix = '') => {
                    Object.keys(data).forEach(key => {
                        if (key.startsWith('__')) return;
                        // For Agent, we grouping everything under one namespace if prefix is provided
                        if (prefix) {
                            if (!namespacesObj[prefix]) namespacesObj[prefix] = {};
                            namespacesObj[prefix][key] = data[key];
                            return;
                        }

                        if (typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key])) {
                            namespacesObj[key] = data[key];
                        } else {
                            if (!namespacesObj['GENERAL']) namespacesObj['GENERAL'] = {};
                            namespacesObj['GENERAL'][key] = data[key];
                        }
                    });
                };

                processData(cloudData);
                if (agentData) {
                    processData(agentData, 'local_agent');
                }
                
                setRegistryData(namespacesObj);

            } catch (e) {
                console.error("[REGISTRY-PANEL] Failed to load registry:", e);
                setRegistryData(cachedConstants);
            } finally {
                setLoading(false);
            }
        };
        loadRegistry();
    }, []);

    const namespaces = Object.keys(registryData);

    const handleSave = async (namespace: string, key: string, value: any) => {
        const fullId = `${namespace}.${key}`;
        setSaving(fullId);
        try {
            let res;
            if (namespace === 'local_agent') {
                res = await api.local.post('registry/save', { key, value });
            } else {
                res = await api.brain.post('registry/save', {
                    namespace,
                    key,
                    value
                });
            }
            
            if (res.success) {
                toast.success(`Saved ${fullId}`);
                await refreshConfig(true);
            } else {
                toast.error(res.error || "Failed to save");
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(null);
            setEditingKey(null);
        }
    };

    const sortedNamespaces = [...namespaces].sort();

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                        <Database className="text-primary" />
                        {t('settings:registry_title')} {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{t('settings:registry_description')}</p>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input 
                        placeholder="Search settings..." 
                        className="pl-9 h-10 rounded-xl bg-white border-slate-200 text-xs font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Accordion type="multiple" className="space-y-3">
                {sortedNamespaces.map(ns => {
                    const Icon = ICON_MAP[ns] || Box;
                    const items = registryData[ns];
                    const keys = Object.keys(items).filter(k => 
                        !searchTerm || 
                        k.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        ns.toLowerCase().includes(searchTerm.toLowerCase())
                    );

                    if (keys.length === 0 && searchTerm) return null;

                    return (
                        <AccordionItem key={ns} value={ns} className="border-none">
                            <GlassCard className="overflow-hidden">
                                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                            <Icon size={16} />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-sm font-black uppercase italic tracking-wider text-slate-900">{ns}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{keys.length} Keys • Source: Database + Baseline</div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-0 border-t border-slate-100/50">
                                    <div className="divide-y divide-slate-100/50">
                                        {keys.map(key => {
                                            const value = items[key];
                                            const isEditing = editingKey === `${ns}.${key}`;
                                            const isSaving = saving === `${ns}.${key}`;
                                            
                                            return (
                                                <div key={key} className="p-6 space-y-4 hover:bg-slate-50/30 transition-colors">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="space-y-1">
                                                            <code className="text-[11px] font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-tighter">{key}</code>
                                                            {!isEditing && (
                                                                <div className="text-xs font-medium text-slate-500 truncate max-w-md">
                                                                    {typeof value === 'object' ? 'JSON Object' : String(value)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-8 rounded-lg text-[10px] uppercase font-black italic tracking-tighter"
                                                                onClick={() => {
                                                                    if (isEditing) {
                                                                        setEditingKey(null);
                                                                    } else {
                                                                        setEditingKey(`${ns}.${key}`);
                                                                        setEditValue(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
                                                                    }
                                                                }}
                                                            >
                                                                {isEditing ? 'Cancel' : (typeof value === 'object' ? <FileCode className="mr-1 h-3 w-3" /> : 'Edit')}
                                                                {isEditing ? '' : (typeof value === 'object' ? ' JSON' : '')}
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {isEditing && (
                                                        <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50 animate-in fade-in slide-in-from-top-2">
                                                            {typeof value === 'object' ? (
                                                                <textarea 
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    className="w-full h-48 font-mono text-[10px] p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 resize-none outline-none"
                                                                    spellCheck="false"
                                                                />
                                                            ) : key.toLowerCase().includes('icon') ? (
                                                                <IconPicker 
                                                                    value={editValue}
                                                                    onChange={(val) => setEditValue(val)}
                                                                    placeholder="Select icon..."
                                                                />
                                                            ) : (
                                                                <Input 
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    className="h-10 bg-white border-slate-200 rounded-xl text-xs font-medium"
                                                                />
                                                            )}
                                                            <div className="flex justify-end">
                                                                <Button 
                                                                    size="sm" 
                                                                    className="px-6 rounded-xl font-black uppercase italic text-[10px]"
                                                                    disabled={isSaving}
                                                                    onClick={() => {
                                                                        let finalVal = editValue;
                                                                        if (typeof value === 'object') {
                                                                            try {
                                                                                finalVal = JSON.parse(editValue);
                                                                            } catch (e) {
                                                                                return toast.error("Invalid JSON");
                                                                            }
                                                                        }
                                                                        handleSave(ns, key, finalVal);
                                                                    }}
                                                                >
                                                                    {isSaving ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                                                                    Save Changes
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </AccordionContent>
                            </GlassCard>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        </div>
    );
}

