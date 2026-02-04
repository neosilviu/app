import React, { useState, useEffect, useRef } from 'react';
import { useConfig } from '~/hooks/useConfig';
import { useTranslation } from 'react-i18next';
import { api, cn, socket, renderString, normalizeEntity, getThemeClasses } from '~/lib/core';
import { toast } from 'sonner';
import { Search, Plus, Save, Trash2, X, Box, Columns, Code, RefreshCw, HelpCircle, Menu, LayoutGrid, Eye, EyeOff, LayoutDashboard, Zap, Shield, Link, Sparkles, CircleDollarSign, Info, ArrowUp, ArrowDown, Copy, Activity } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { IconPicker } from './ui/IconPicker';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,  DialogTitle, } from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";

export function EntityDefinitionsPanel() {
    const { entity: configEntities, refreshConfig, constants } = useConfig();
    const { t, i18n } = useTranslation(['common', 'superadmin']);
    const lang = i18n.language || 'ro';
    
    const [entities, setEntities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingEntity, setEditingEntity] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'system' | 'custom'>('all');

    // Blueprint state
    const [blueprintDialog, setBlueprintDialog] = useState(false);

    // Dry Run state
    const [dryRunDialog, setDryRunDialog] = useState<{ open: boolean, results: Record<string, string[]> | null }>({ open: false, results: null });
    const [dryRunning, setDryRunning] = useState(false);

    // Garbage Collector state
    const [garbageDialog, setGarbageDialog] = useState<{ open: boolean, orphans: any[] }>({ open: false, orphans: [] });
    const [cleaning, setCleaning] = useState(false);

    // Self-Healing (Level 9) state
    const [healing, setHealing] = useState(false);
    const [healingDialog, setHealingDialog] = useState<{ open: boolean, report: any[] | null }>({ open: false, report: null });

    // Delete confirmation state
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, entity: any | null }>({ open: false, entity: null });
    const [confirmName, setConfirmName] = useState('');
    const [dropDatabase, setDropDatabase] = useState(false);
    const [forceDelete, setForceDelete] = useState(false);

    const editorScrollRef = useRef<HTMLDivElement>(null);

    // Scroll to top when entity selection changes
    useEffect(() => {
        if (editingEntity && editorScrollRef.current) {
            editorScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [editingEntity?.id, editingEntity?.name]);

    const fetchEntities = async () => {
        setLoading(true);
        try {
            // Get entities from Brain API (Now uses the unified normalizer)
            const res = await api.brain.get('entity');
            
            if (res.success && Array.isArray(res.data)) {
                // Enterprise Level 8: Normalize everything through the central lens
                const normalized = res.data.map((e: any) => normalizeEntity(e));
                setEntities(normalized);
            } else if (configEntities) {
                // Fallback to Registry if API fails
                const list = Object.entries(configEntities).map(([name, def]: [string, any]) => 
                    normalizeEntity({ ...def, name })
                );
                setEntities(list);
            }
        } catch (e: any) {
            console.error("Failed to fetch entities:", e);
            toast.error("Failed to fetch entities");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEntities(); }, [configEntities]);

    const handleSave = async () => {
        if (!editingEntity.name) return toast.error("Înregistrarea are nevoie de un Nume de Sistem (Identifier)");
        
        setSaving(true);
        console.log("[ENTITY-BUILDER] Saving entity:", editingEntity.name, editingEntity);

        try {
            // Ensure we send an explicit `entity` array so the Brain handler
            // always receives `body.entity` even if body parsing is fragile.
            const res = await api.brain.post('entity/save', { entity: [editingEntity] });
            console.log("[ENTITY-BUILDER] Save result:", res);

            if (res.success || res.status === 'synced' || (Array.isArray(res) && res.length > 0)) {
                toast.success(`Entitatea ${editingEntity.name} a fost salvată cu succes!`);
                setEditingEntity(null);
                await fetchEntities();
                
                // Force a deep refresh of the system config
                console.log("[ENTITY-BUILDER] Refreshing system config...");
                await refreshConfig(true);

                // Broadcast change via Socket (Real-time sync for other tabs/users)
                socket.emit('config:updated', { source: 'entity-builder', entity: editingEntity.name });
            } else {
                const errorMsg = res.error || res.message || "Eroare necunoscută la salvare";
                toast.error(`Eșec: ${errorMsg}`);
                console.error("[ENTITY-BUILDER] Save failed:", res);
            }
        } catch (e: any) {
            console.error("[ENTITY-BUILDER] Critical save error:", e);
            toast.error(`Eroare critică: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDryRun = async () => {
        if (!editingEntity.name) return toast.error("Înregistrarea are nevoie de un Nume de Sistem (Identifier)");
        
        setDryRunning(true);
        try {
            const res = await api.brain.post('entity/save', { 
                entity: [editingEntity],
                dryRun: true 
            });

            if (res.success && res.data?.dryRun) {
                setDryRunDialog({ open: true, results: res.data.dryRun });
            } else {
                toast.error(res.error || "Eroare la simulare");
            }
        } catch (e: any) {
            console.error("[ENTITY-BUILDER] Dry run error:", e);
            toast.error(`Eroare critică: ${e.message}`);
        } finally {
            setDryRunning(false);
        }
    };

    const fetchOrphans = async () => {
        setCleaning(true);
        try {
            const res = await api.brain.get('entity/garbage-collect');
            if (res.success && res.data?.orphans) {
                setGarbageDialog({ open: true, orphans: res.data.orphans });
            } else {
                toast.error("Nu am putut analiza tabelele orfane");
            }
        } catch (e: any) {
            toast.error(`Eroare: ${e.message}`);
        } finally {
            setCleaning(false);
        }
    };

    const runSelfHealing = async () => {
        setHealing(true);
        try {
            const res = await api.brain.post('system/self-healing', {});
            if (res.success) {
                // The data is already formatted in handleSelfHealing
                setHealingDialog({ open: true, report: res.data?.report || [] });
                toast.success("AI Analysis Complete");
            } else {
                toast.error(res.error || "Analysis failed");
            }
        } catch (e: any) {
            toast.error("Network error during AI analysis");
        } finally {
            setHealing(false);
        }
    };

    const deleteOrphanTable = async (tableName: string) => {
        if (!confirm(`Ești sigur că vrei să ștergi tabelul "${tableName}"? Datele vor fi pierdute definitiv.`)) return;
        
        try {
            // Re-using delete endpoint but purely for DB drop
            // We need a way to just drop a table. Let's see if 'delete' can do it without a definition ID.
            // Actually, I should probably add a dedicated drop-table action or use delete with specific params.
            // For now, I'll update brain.server.ts to support 'action: drop-orphan'.
            const res = await api.brain.post('entity/delete', { 
                tableName, 
                dropDatabase: true,
                force: true 
            });
            
            if (res.success) {
                toast.success(`Tabelul ${tableName} a fost șters.`);
                setGarbageDialog(prev => ({ ...prev, orphans: prev.orphans.filter(o => o.name !== tableName) }));
            } else {
                toast.error(res.error || "Ștergere eșuată");
            }
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleDelete = (entity: any) => {
        // Check if any other entity depends on this one
        const dependents = entities.filter(e => 
            e.name !== entity.name && 
            Array.isArray(e.dependencies) && 
            e.dependencies.includes(entity.name)
        );

        if (dependents.length > 0) {
            const dependentNames = dependents.map(d => renderString(d.label || d.name, lang)).join(', ');
            return toast.error(
                `Cannot delete ${renderString(entity.label, lang)}: The following entities depend on it: ${dependentNames}`,
                { duration: 5000 }
            );
        }

        setDeleteDialog({ open: true, entity });
        setConfirmName('');
        setDropDatabase(false);
        setForceDelete(false);
    };

    const executeDelete = async () => {
        const entity = deleteDialog.entity;
        if (!entity) return;

        try {
            const res = await api.brain.post('entity/delete', { 
                id: entity.id, 
                name: entity.name,
                dropDatabase,
                force: forceDelete 
            });
            if (res.success) {
                toast.success(`Entity ${entity.name} deleted${dropDatabase ? ' and database table dropped' : ''}`);
                setDeleteDialog({ open: false, entity: null });
                
                // Optimistic UI: Remove from local state immediately
                setEntities(prev => prev.filter(e => e.name !== entity.name));
                if (editingEntity?.name === entity.name) setEditingEntity(null);

                await fetchEntities();
                await refreshConfig(true);
                
                // Broadcast change
                socket.emit('config:updated', { source: 'entity-builder', action: 'delete', entity: entity.name });
            } else {
                toast.error(res.error || "Delete failed");
            }
        } catch (e: any) {
            const serverMsg = e?.response?.data?.error || e?.message;
            toast.error(serverMsg || "Delete failed");
        }
    };

    const moveField = (idx: number, direction: number) => {
        if (!editingEntity || editingEntity.isSystem) return;
        const fields = [...(editingEntity.fields || [])];
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= fields.length) return;
        
        [fields[idx], fields[newIdx]] = [fields[newIdx], fields[idx]];
        setEditingEntity({ ...editingEntity, fields });
    };

    const duplicateField = (idx: number) => {
        if (!editingEntity || editingEntity.isSystem) return;
        const fields = [...(editingEntity.fields || [])];
        const source = fields[idx];
        
        // Deep clone the field (simple version for this schema)
        const clone = JSON.parse(JSON.stringify(source));
        
        // Generate new name and label to avoid collisions
        const randomId = Math.random().toString(36).substring(2, 5);
        clone.name = `${source.name}_copy_${randomId}`;
        
        // Handle multi-lang label if present
        if (typeof source.label === 'object') {
            clone.label = {};
            Object.keys(source.label).forEach(lang => {
                clone.label[lang] = `${source.label[lang]} (Copy)`;
            });
        } else {
            clone.label = `${source.label || source.name} (Copy)`;
        }

        // Insert after the source field
        fields.splice(idx + 1, 0, clone);
        setEditingEntity({ ...editingEntity, fields });
        toast.success(`Field duplicated: ${clone.name}`);
    };

    const startNew = (blueprint?: any) => {
        const base = blueprint || {
            name: '',
            label: '',
            description: '',
            icon: 'Box',
            tableName: '',
            fields: [],
            uiConfig: {
                list: { columns: [] },
                form: { sections: [] }
            },
            dashboardConfig: { enabled: false, widgetType: 'stats' },
            permission: { role: {} },
            features: { auditable: true, creatable: true, editable: true, deletable: true }
        };

        setEditingEntity(normalizeEntity(base));
        setBlueprintDialog(false);
    };

    const filteredEntities = entities.filter(entity => {
        const matchesSearch = (entity.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (renderString(entity.label, lang) || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (renderString(entity.description, lang) || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!matchesSearch) return false;
        
        if (activeTab === 'system') return !!entity.isSystem;
        if (activeTab === 'custom') return !entity.isSystem;
        return true;
    });

    return (
        <div className="h-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-6 py-4 border-b border-slate-200/50 bg-white/50 backdrop-blur-sm">
                <div className="space-y-1">
                    <h3 className="text-lg font-black italic uppercase tracking-tighter flex items-center gap-2">
                        <Box className="text-primary" />
                        Entity Builder
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{entities.length} {entities.length === 1 ? 'entity' : 'entity'} available</p>
                </div>
                <Button 
                    onClick={() => setBlueprintDialog(true)}
                    className="rounded-xl font-black uppercase italic text-xs px-6"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    New Entity
                </Button>
                <Button 
                    variant="ghost"
                    onClick={fetchOrphans}
                    className="rounded-xl font-black uppercase italic text-[10px] px-4 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                    disabled={cleaning}
                >
                    {cleaning ? <RefreshCw className="mr-2 h-3 w-3 animate-spin" /> : <Trash2 className="mr-2 h-3 w-3" />}
                    DB Cleanup
                </Button>
                <Button 
                    variant="ghost"
                    onClick={runSelfHealing}
                    className="rounded-xl font-black uppercase italic text-[10px] px-4 text-slate-400 hover:text-primary hover:bg-primary/5 border border-slate-100/50"
                    disabled={healing}
                >
                    {healing ? <Zap className="mr-2 h-3 w-3 animate-spin text-primary" /> : <Sparkles className="mr-2 h-3 w-3 text-primary" />}
                    Level 9 AI
                </Button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex gap-4 p-4">
                {/* Left Sidebar - Entity List */}
                <div className="w-72 flex flex-col border-r border-slate-200/50 pr-4 gap-3">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search entities..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 rounded-xl border-slate-200 font-medium focus:ring-primary/20"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Tabs for Filtering */}
                    <div className="flex p-1 bg-slate-100/50 rounded-xl">
                        {(['all', 'system', 'custom'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    "flex-1 py-1.5 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all",
                                    activeTab === tab 
                                        ? "bg-white text-primary shadow-sm" 
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {tab === 'all' ? (lang === 'ro' ? 'Toate' : 'All') : 
                                 tab === 'system' ? (lang === 'ro' ? 'Sistem' : 'System') : 
                                 (lang === 'ro' ? 'Custom' : 'Custom')}
                            </button>
                        ))}
                    </div>

                    {/* Entity List */}
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {loading ? (
                            <div className="space-y-2">
                                {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />)}
                            </div>
                        ) : filteredEntities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Box className="h-8 w-8 text-slate-200 mb-3" />
                                <p className="text-xs font-bold text-slate-500">
                                    {searchQuery ? 'No entities found' : 'No entities yet'}
                                </p>
                            </div>
                        ) : (
                            filteredEntities.map(entity => {
                                const theme = getThemeClasses(entity.colorTheme || 'indigo');
                                return (
                                <div
                                    key={entity.id || entity.name}
                                    className={cn(
                                        "w-full p-2 text-left rounded-xl border transition-all group relative",
                                        editingEntity?.id === entity.id 
                                            ? `border-indigo-500 bg-indigo-50 shadow-sm` 
                                            : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                                    )}
                                >
                                    <div 
                                        className="flex items-center gap-2 cursor-pointer"
                                        onClick={() => setEditingEntity(normalizeEntity(entity))}
                                    >
                                        <div className={cn(
                                            "p-1.5 rounded-lg text-white shadow-sm shrink-0",
                                            theme.bg
                                        )}>
                                            <Box size={12} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-black text-[11px] text-slate-900 truncate uppercase tracking-tighter">{renderString(entity.label, lang)}</p>
                                                {entity.isSystem && (
                                                    <Badge variant="outline" className="px-1 py-0 h-3 text-[6px] font-black uppercase tracking-tighter bg-slate-50 text-slate-400 border-slate-200">
                                                        SYSTEM
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest truncate opacity-70">{renderString(entity.name, lang)}</p>
                                        </div>
                                    </div>
                                    {!entity.isSystem && (
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                handleDelete(entity); 
                                            }}
                                            className="absolute -right-1 -top-1 p-1 opacity-0 group-hover:opacity-100 transition-all rounded-full bg-white border border-slate-100 text-slate-400 hover:text-red-500 shadow-sm z-10"
                                            title="Delete Entity"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    )}
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Content - Edit Form */}
                <div ref={editorScrollRef} className="flex-1 overflow-y-auto">
                    {editingEntity ? (
                        <GlassCard className="p-8 space-y-8">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                        <Box size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-black uppercase italic tracking-tight">
                                            {editingEntity.id ? `Edit: ${editingEntity.name}` : 'Create New Entity'}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                            Configuration
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {editingEntity.isSystem && (
                                        <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-2">
                                            <Shield size={10} className="text-indigo-500" />
                                            <span className="text-[9px] font-black text-indigo-700 uppercase tracking-tighter">System Protected</span>
                                        </div>
                                    )}
                                    {editingEntity.id && !editingEntity.isSystem && (
                                        <Button 
                                            variant="ghost"
                                            className="rounded-xl font-black uppercase italic text-xs px-4 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                            onClick={() => handleDelete(editingEntity)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </Button>
                                    )}
                                    <Button 
                                        variant="outline"
                                        className="rounded-xl font-black uppercase italic text-xs px-4 border-primary/20 text-primary hover:bg-primary/5"
                                        disabled={dryRunning || saving}
                                        onClick={handleDryRun}
                                    >
                                        {dryRunning ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Eye size={16} className="mr-2" />}
                                        Inspect SQL
                                    </Button>
                                    <Button 
                                        className="rounded-xl font-black uppercase italic text-xs px-6" 
                                        disabled={saving || dryRunning}
                                        onClick={handleSave}
                                    >
                                        {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save & Sync
                                    </Button>
                                </div>
                            </div>

                            <Tabs defaultValue="basic" className="w-full">
                                <TabsList className="grid w-full grid-cols-8 bg-slate-100/50 p-2 rounded-2xl">
                                    <TabsTrigger value="basic" className="text-[9px] font-bold uppercase">Basic</TabsTrigger>
                                    <TabsTrigger value="fields" className="text-[9px] font-bold uppercase">Fields</TabsTrigger>
                                    <TabsTrigger value="display" className="text-[9px] font-bold uppercase"><Eye size={11} /></TabsTrigger>
                                    <TabsTrigger value="menu" className="text-[9px] font-bold uppercase"><Menu size={11} /></TabsTrigger>
                                    <TabsTrigger value="dashboard" className="text-[9px] font-bold uppercase"><LayoutDashboard size={11} /></TabsTrigger>
                                    <TabsTrigger value="permission" className="text-[9px] font-bold uppercase"><Shield size={11} /></TabsTrigger>
                                    <TabsTrigger value="features" className="text-[9px] font-bold uppercase"><Zap size={11} /></TabsTrigger>
                                    <TabsTrigger value="flow" className="text-[9px] font-bold uppercase"><Activity size={11} /></TabsTrigger>
                                </TabsList>

                        {/* BASIC TAB */}
                        <TabsContent value="basic" className="space-y-6 mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Basic Info */}
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">System Name (Identifier)</Label>
                                        <Input 
                                            placeholder="e.g. products" 
                                            value={editingEntity.name}
                                            onChange={(e) => setEditingEntity({ ...editingEntity, name: e.target.value })}
                                            disabled={!!editingEntity.id || editingEntity.isSystem}
                                            className="h-12 rounded-2xl border-slate-200 font-bold focus:ring-primary/20"
                                        />
                                        <p className="text-[8px] text-slate-400 italic">Unique identifier used in database and URLs</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Display Label</Label>
                                        <Input 
                                            placeholder="e.g. Inventory Products" 
                                            value={renderString(editingEntity.label, lang)}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const currentLabel = editingEntity.label;
                                                const currentPlural = editingEntity.labelPlural;
                                                
                                                let newLabel: any;
                                                let newPlural: any = currentPlural;

                                                if (typeof currentLabel === 'object' && currentLabel !== null) {
                                                    newLabel = { ...currentLabel, [lang]: val };
                                                } else {
                                                    newLabel = { ro: lang === 'ro' ? val : currentLabel, en: lang === 'en' ? val : currentLabel };
                                                }

                                                // Level 8 Optimization: Auto-Pluralize if plural is missing or seems auto-generated
                                                const currentPluralStr = renderString(currentPlural, lang);
                                                if (!currentPlural || currentPluralStr === '' || currentPluralStr === renderString(currentLabel, lang)) {
                                                    const autoPlural = val + (lang === 'ro' ? 'e' : 's');
                                                    if (typeof currentPlural === 'object' && currentPlural !== null) {
                                                        newPlural = { ...currentPlural, [lang]: autoPlural };
                                                    } else {
                                                        newPlural = { ro: lang === 'ro' ? autoPlural : (currentPlural || ''), en: lang === 'en' ? autoPlural : (currentPlural || '') };
                                                    }
                                                }

                                                setEditingEntity({ ...editingEntity, label: newLabel, labelPlural: newPlural });
                                            }}
                                            className="h-12 rounded-2xl border-slate-200 font-medium focus:ring-primary/20"
                                        />
                                        <p className="text-[8px] text-slate-400 italic">Human-readable label shown in UI</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Plural Label</Label>
                                        <Input 
                                            placeholder="e.g. Products" 
                                            value={renderString(editingEntity.labelPlural, lang)}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const current = editingEntity.labelPlural;
                                                if (typeof current === 'object' && current !== null) {
                                                    setEditingEntity({ ...editingEntity, labelPlural: { ...current, [lang]: val } });
                                                } else {
                                                    setEditingEntity({ ...editingEntity, labelPlural: { ro: lang === 'ro' ? val : current, en: lang === 'en' ? val : current } });
                                                }
                                            }}
                                            className="h-10 rounded-xl border-slate-200 font-medium focus:ring-primary/20"
                                        />
                                        <p className="text-[8px] text-slate-400 italic">Used for navigation menus and headers</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Database Table Name</Label>
                                        <Input 
                                            placeholder="Optional: will default to identifier" 
                                            value={editingEntity.tableName}
                                            onChange={(e) => setEditingEntity({ ...editingEntity, tableName: e.target.value })}
                                            disabled={editingEntity.isSystem}
                                            className="h-10 rounded-xl border-slate-200 font-mono text-xs focus:ring-primary/20"
                                        />
                                        <p className="text-[8px] text-slate-400 italic">Database table name (auto-generated if empty)</p>
                                    </div>
                                </div>

                                {/* Description & Icon */}
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Description</Label>
                                        <textarea 
                                            placeholder="Describe what this entity represents..." 
                                            value={renderString(editingEntity.description, lang)}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const current = editingEntity.description;
                                                if (typeof current === 'object' && current !== null) {
                                                    setEditingEntity({ ...editingEntity, description: { ...current, [lang]: val } });
                                                } else {
                                                    setEditingEntity({ ...editingEntity, description: { ro: lang === 'ro' ? val : current, en: lang === 'en' ? val : current } });
                                                }
                                            }}
                                            className="w-full h-32 rounded-2xl border border-slate-200 p-4 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Visual Identity (Icon)</Label>
                                        <IconPicker 
                                            value={editingEntity.icon}
                                            onChange={(val) => {
                                                setEditingEntity({ ...editingEntity, icon: val });
                                                // Enterprise Level 8: Propagate icon to Menu if not explicitly overridden
                                                if (!editingEntity.menuConfig?.icon) {
                                                    // This ensures immediate visual feedback in sidebar previews if any
                                                }
                                            }}
                                            placeholder="Choose an icon..."
                                        />
                                        <p className="text-[8px] text-slate-400 italic">Icon principal afișat în liste, breadcrumbs și tabele.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Color Theme</Label>
                                        <select 
                                            value={editingEntity.colorTheme || 'blue'}
                                            onChange={(e) => setEditingEntity({ ...editingEntity, colorTheme: e.target.value })}
                                            className="h-10 rounded-xl border border-slate-200 text-xs font-bold bg-white px-3 focus:ring-2 focus:ring-primary/20 w-full"
                                        >
                                            <option value="blue">Blue</option>
                                            <option value="green">Green</option>
                                            <option value="purple">Purple</option>
                                            <option value="red">Red</option>
                                            <option value="amber">Amber</option>
                                            <option value="slate">Slate</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Eye size={12} className="text-primary" />
                                            <Label className="text-[10px] font-black uppercase italic tracking-widest text-primary">Identity Field (Label)</Label>
                                        </div>
                                        <select 
                                            value={editingEntity.displayField || ''}
                                            onChange={(e) => setEditingEntity({ ...editingEntity, displayField: e.target.value })}
                                            className="h-10 rounded-xl border border-primary/20 text-xs font-bold bg-white px-3 focus:ring-2 focus:ring-primary/20 w-full"
                                        >
                                            <option value="">-- Select Display Field --</option>
                                            {editingEntity.fields?.map((f: any) => (
                                                <option key={f.name} value={f.name}>{renderString(f.label || f.name, lang)}</option>
                                            ))}
                                        </select>
                                        <p className="text-[8px] text-slate-400 mt-2">Which field represents this record in dropdowns and links?</p>
                                    </div>

                                    {/* Dependency Management */}
                                    <div className="space-y-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Link size={12} className="text-amber-600" />
                                            <Label className="text-[10px] font-black uppercase italic tracking-widest text-amber-700">Entity Dependencies (Requirements)</Label>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {(editingEntity.dependencies || []).map((dep: string) => (
                                                    <Badge key={dep} variant="outline" className="bg-white border-amber-200 text-amber-700 gap-1 text-[9px] py-0 px-2">
                                                        {renderString(entities.find(e => e.name === dep)?.label || dep, lang)}
                                                        <X 
                                                            size={10} 
                                                            className="cursor-pointer hover:text-red-500" 
                                                            onClick={() => {
                                                                const dependencies = (editingEntity.dependencies || []).filter((r: string) => r !== dep);
                                                                setEditingEntity({ ...editingEntity, dependencies });
                                                            }}
                                                        />
                                                    </Badge>
                                                ))}
                                                {(!editingEntity.dependencies || editingEntity.dependencies.length === 0) && (
                                                    <span className="text-[9px] text-amber-500/50 italic">No dependencies defined</span>
                                                )}
                                            </div>
                                            <select 
                                                className="h-8 rounded-lg border border-amber-200 text-[10px] font-bold bg-white px-2 w-full focus:ring-amber-500/20"
                                                onChange={(e) => {
                                                    if (!e.target.value) return;
                                                    const dependencies = [...(editingEntity.dependencies || [])];
                                                    if (!dependencies.includes(e.target.value)) {
                                                        dependencies.push(e.target.value);
                                                    }
                                                    setEditingEntity({ ...editingEntity, dependencies });
                                                    e.target.value = '';
                                                }}
                                            >
                                                <option value="">+ Add Dependency...</option>
                                                {entities
                                                    .filter(e => e.name !== editingEntity.name && !(editingEntity.dependencies || []).includes(e.name))
                                                    .map(e => (
                                                        <option key={e.name} value={e.name}>{renderString(e.label || e.name, lang)}</option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                        <p className="text-[8px] text-amber-600/70 leading-tight">
                                            Prevent deletion of parent entities and ensure correct installation order in Marketplace.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* FIELDS TAB */}
                        <TabsContent value="fields" className="space-y-4 mt-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <div className="space-y-0.5">
                                        <h5 className="text-[10px] font-black uppercase italic tracking-widest text-slate-900 flex items-center gap-1.5">
                                            <Columns className="h-3 w-3 text-primary" />
                                            Structural Architecture
                                        </h5>
                                        <p className="text-[8px] text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis italic">Define the schema, validation and visibility logic for this entity</p>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        disabled={editingEntity.isSystem}
                                        className={cn(
                                            "h-7 rounded-xl font-black uppercase italic text-[9px] border-primary/20 text-primary transition-all shadow-sm flex-shrink-0 px-3",
                                            editingEntity.isSystem ? "opacity-50 cursor-not-allowed" : "hover:bg-primary hover:text-white"
                                        )}
                                        onClick={() => {
                                            const fields = [...(editingEntity.fields || [])];
                                            fields.push({ 
                                                name: '', 
                                                label: '', 
                                                type: 'text', 
                                                required: false, 
                                                unique: false,
                                                visibility: { type: 'always' },
                                                validation: {},
                                                width: '1/2' 
                                            });
                                            setEditingEntity({ ...editingEntity, fields });
                                        }}
                                    >
                                        <Plus className="mr-1 h-3 w-3" /> Add Logic Field
                                    </Button>
                                </div>

                                <div className="space-y-2">
                                    <Accordion type="single" collapsible className="space-y-2">
                                        {Array.isArray(editingEntity.fields) && editingEntity.fields.map((field: any, idx: number) => (
                                            <AccordionItem key={`field-row-${idx}`} value={`field-${idx}`} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                                                <div className="relative group/item">
                                                    <AccordionTrigger className="hover:no-underline w-full p-0">
                                                        {/* Header Area */}
                                                        <div className="bg-slate-50/30 border-b border-slate-50 p-2 flex items-center justify-between gap-3 w-full">
                                                            <div className="flex-1 flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-300 font-mono text-[9px] font-black">
                                                                    {idx + 1}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[11px] font-black uppercase italic text-slate-700 tracking-tighter">{renderString(field.label || field.name || 'New Field', lang)}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <Badge variant="outline" className="text-[7px] font-bold uppercase py-0 px-1 bg-indigo-50/50 text-indigo-500 border-indigo-100/50">{field.type || 'text'}</Badge>
                                                                        {field.required && <Badge variant="outline" className="text-[7px] font-black uppercase py-0 px-1 bg-red-50/50 text-red-500 border-red-100/50">REQ</Badge>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Spacer for actions overlay */}
                                                            <div className="w-24" />
                                                        </div>
                                                    </AccordionTrigger>

                                                    {/* Actions Overlay (Outside of Trigger button to avoid nested buttons) */}
                                                    <div className="absolute right-8 top-2 flex items-center gap-0.5 z-20">
                                                        <div className="flex items-center gap-0.5 mr-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                disabled={editingEntity.isSystem}
                                                                className="h-7 w-7 text-slate-200 rounded-lg hover:text-indigo-600 disabled:opacity-20"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    duplicateField(idx);
                                                                }}
                                                            >
                                                                <Copy size={11} />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                disabled={editingEntity.isSystem || idx === 0}
                                                                className="h-7 w-7 text-slate-200 rounded-lg hover:text-indigo-600 disabled:opacity-20"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    moveField(idx, -1);
                                                                }}
                                                            >
                                                                <ArrowUp size={12} />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                disabled={editingEntity.isSystem || idx === editingEntity.fields.length - 1}
                                                                className="h-8 w-8 text-slate-300 rounded-lg hover:text-indigo-600 disabled:opacity-20 translate-y-[2px]"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    moveField(idx, 1);
                                                                }}
                                                            >
                                                                <ArrowDown size={12} />
                                                            </Button>
                                                        </div>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            disabled={editingEntity.isSystem}
                                                            className={cn(
                                                                "h-8 w-8 text-slate-300 rounded-lg",
                                                                editingEntity.isSystem ? "cursor-not-allowed opacity-30" : "hover:text-red-500 cursor-pointer"
                                                            )}
                                                            onClick={(e) => {
                                                                if (editingEntity.isSystem) return;
                                                                e.stopPropagation();
                                                                const fieldName = editingEntity.fields[idx].name;
                                                                const fields = editingEntity.fields.filter((_: any, i: number) => i !== idx);

                                                                // Enterprise Level 8: Cascade delete from all references
                                                                const uiConfig = { ...editingEntity.uiConfig };
                                                                
                                                                // 1. Remove from List Columns
                                                                if (uiConfig.list?.columns) {
                                                                    uiConfig.list.columns = uiConfig.list.columns.filter((c: string) => c !== fieldName);
                                                                }

                                                                // 2. Remove from Form Sections
                                                                if (uiConfig.form?.sections) {
                                                                    uiConfig.form.sections = uiConfig.form.sections.map((s: any) => ({
                                                                        ...s,
                                                                        fields: s.fields?.filter((f: string) => f !== fieldName)
                                                                    }));
                                                                }

                                                                // 3. Update Display Field (fallback to 'id' if removed)
                                                                let displayField = editingEntity.displayField;
                                                                if (displayField === fieldName) displayField = 'id';

                                                                // 4. Reset visibility logic for fields that depended on the deleted field
                                                                fields.forEach((f: any, fIdx: number) => {
                                                                    if (f.visibility?.dependsOn === fieldName) {
                                                                        fields[fIdx].visibility = { type: 'always' };
                                                                    }
                                                                });

                                                                setEditingEntity({ ...editingEntity, fields, uiConfig, displayField });
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <AccordionContent>
                                                    <div className="p-6 space-y-8 bg-white">
                                                        {/* Primary Identification */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/30 p-4 rounded-2xl border border-slate-100">
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-black uppercase text-slate-400">Logic ID (DB Name)</Label>
                                                                <Input 
                                                                    placeholder="field_name" 
                                                                    value={field.name}
                                                                    onChange={(e) => {
                                                                        const fields = [...editingEntity.fields];
                                                                        const oldName = fields[idx].name;
                                                                        const newName = e.target.value.toLowerCase().replace(/\s+/g, '_');
                                                                        fields[idx].name = newName;

                                                                        // Enterprise Level 8: Cascade rename to all references
                                                                        const uiConfig = { ...editingEntity.uiConfig };
                                                                        
                                                                        // 1. Update List Columns
                                                                        if (uiConfig.list?.columns) {
                                                                            uiConfig.list.columns = uiConfig.list.columns.map((c: string) => c === oldName ? newName : c);
                                                                        }

                                                                        // 2. Update Form Sections
                                                                        if (uiConfig.form?.sections) {
                                                                            uiConfig.form.sections = uiConfig.form.sections.map((s: any) => ({
                                                                                ...s,
                                                                                fields: s.fields?.map((f: string) => f === oldName ? newName : f)
                                                                            }));
                                                                        }

                                                                        // 3. Update Display Field
                                                                        let displayField = editingEntity.displayField;
                                                                        if (displayField === oldName) displayField = newName;

                                                                        // 4. Update visibility transitions
                                                                        fields.forEach((f, fIdx) => {
                                                                            if (f.visibility?.dependsOn === oldName) {
                                                                                fields[fIdx].visibility = { ...f.visibility, dependsOn: newName };
                                                                            }
                                                                        });

                                                                        setEditingEntity({ ...editingEntity, fields, uiConfig, displayField });
                                                                    }}
                                                                    disabled={editingEntity.isSystem}
                                                                    className="h-8 rounded-lg text-xs font-mono uppercase bg-white"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-black uppercase text-slate-400">UI Label</Label>
                                                                <Input 
                                                                    placeholder="Field Label" 
                                                                    value={renderString(field.label, lang)}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const fields = [...editingEntity.fields];
                                                                        const current = fields[idx].label;

                                                                        if (typeof current === 'object' && current !== null) {
                                                                            fields[idx].label = { ...current, [lang]: val };
                                                                        } else {
                                                                            fields[idx].label = { ro: lang === 'ro' ? val : current, en: lang === 'en' ? val : current };
                                                                        }
                                                                        
                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                    }}
                                                                    className="h-8 rounded-lg text-xs font-bold bg-white"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Configuration Grid */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                            {/* COLUMN 1: TYPE SPECIFIC & DATA */}
                                                            <div className="space-y-4">
                                                                <h6 className="text-[9px] font-black uppercase text-indigo-500 border-b border-indigo-50 pb-1">Data & Storage</h6>
                                                                
                                                                <div className="space-y-2">
                                                                    <Label className="text-[9px] font-bold">Field Type</Label>
                                                                    <select 
                                                                        value={field.type || 'text'}
                                                                        onChange={(e) => {
                                                                            const fields = [...editingEntity.fields];
                                                                            fields[idx].type = e.target.value;
                                                                            setEditingEntity({ ...editingEntity, fields });
                                                                        }}
                                                                        className="w-full h-8 rounded-lg border border-slate-200 text-[10px] font-black uppercase bg-white px-3"
                                                                    >
                                                                        <optgroup label="Basic">
                                                                            <option value="text">Short Text</option>
                                                                            <option value="textarea">Long Text</option>
                                                                            <option value="number">Number</option>
                                                                            <option value="boolean">Toggle</option>
                                                                            <option value="enum">Selection (Dropdown/Buttons)</option>
                                                                        </optgroup>
                                                                        <optgroup label="Advanced">
                                                                            <option value="ai">AI Content (LLM)</option>
                                                                            <option value="formula">Calculated (Script)</option>
                                                                            <option value="relation">Relation (Single)</option>
                                                                            <option value="relation-many">Relation (Multiple/tag)</option>
                                                                            <option value="file">File Attachment</option>
                                                                            <option value="image">Photo / Gallery</option>
                                                                            <option value="richtext">Rich Text</option>
                                                                            <option value="tag">tag / Multi-Select</option>
                                                                        </optgroup>
                                                                        <optgroup label="Formatting">
                                                                            <option value="date">Date Only</option>
                                                                            <option value="datetime">Date & Time</option>
                                                                            <option value="currency">Currency</option>
                                                                            <option value="email">Email</option>
                                                                            <option value="phone">Phone</option>
                                                                            <option value="url">Link (URL)</option>
                                                                            <option value="color">Color</option>
                                                                            <option value="icon">Icon Selector</option>
                                                                        </optgroup>
                                                                        <optgroup label="Widgets">
                                                                            <option value="rating">Rating (Stars)</option>
                                                                            <option value="progress">Progress Bar</option>
                                                                            <option value="password">Password (Masked)</option>
                                                                        </optgroup>
                                                                    </select>
                                                                </div>

                                                                {field.type === 'ai' && (
                                                                    <div className="space-y-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Zap size={12} className="text-indigo-500" />
                                                                                    <Label className="text-[9px] font-bold text-indigo-700">AI Prompt Template</Label>
                                                                                </div>
                                                                                <Button 
                                                                                    size="icon" 
                                                                                    variant="ghost" 
                                                                                    className="h-5 w-5 hover:bg-indigo-100 text-indigo-600"
                                                                                    title="View Examples"
                                                                                    onClick={() => {
                                                                                        const examples = [
                                                                                            "Summarize the details for {{name}} in 2 sentences.",
                                                                                            "Based on {{description}}, categorize as 'Sales' or 'Support'.",
                                                                                            "Draft a professional reply to the email: {{content}}.",
                                                                                            "Extract the main price from: {{text_blob}}."
                                                                                        ];
                                                                                        const chosen = window.prompt("Common Prompt Examples:\n" + examples.join("\n") + "\n\nCopy one below or type its number:");
                                                                                        if (chosen) {
                                                                                            const fields = [...editingEntity.fields];
                                                                                            fields[idx].ai = { ...fields[idx].ai, prompt: chosen };
                                                                                            setEditingEntity({ ...editingEntity, fields });
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <HelpCircle size={10} />
                                                                                </Button>
                                                                            </div>
                                                                            <textarea 
                                                                                placeholder="Summarize {{name}} biography..." 
                                                                                value={field.ai?.prompt || ''}
                                                                                onChange={(e) => {
                                                                                    const fields = [...editingEntity.fields];
                                                                                    fields[idx].ai = { ...fields[idx].ai, prompt: e.target.value };
                                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                                }}
                                                                                className="w-full h-20 rounded-lg border border-indigo-100 p-2 text-[10px] font-mono bg-white outline-none focus:ring-1 focus:ring-indigo-300"
                                                                            />
                                                                            <p className="text-[7px] text-indigo-400 italic">Use {"{{field_name}}"} for variables.</p>
                                                                        </div>
                                                                        
                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <div className="space-y-1">
                                                                                <Label className="text-[8px] font-bold text-indigo-700">Model</Label>
                                                                                <select 
                                                                                    value={field.ai?.model || 'smart'}
                                                                                    onChange={(e) => {
                                                                                        const fields = [...editingEntity.fields];
                                                                                        fields[idx].ai = { ...fields[idx].ai, model: e.target.value };
                                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                                    }}
                                                                                    className="w-full h-7 rounded-md border border-indigo-100 text-[9px] px-2 bg-white"
                                                                                >
                                                                                    <option value="smart">Smart (Default)</option>
                                                                                    {(constants.AI_CONFIG?.models || []).map((m: any) => (
                                                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <Label className="text-[8px] font-bold text-indigo-700">Personality</Label>
                                                                                <select 
                                                                                    value={field.ai?.personality || 'professional'}
                                                                                    onChange={(e) => {
                                                                                        const fields = [...editingEntity.fields];
                                                                                        fields[idx].ai = { ...fields[idx].ai, personality: e.target.value };
                                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                                    }}
                                                                                    className="w-full h-7 rounded-md border border-indigo-100 text-[9px] px-2 bg-white"
                                                                                >
                                                                                    <option value="professional">Professional</option>
                                                                                    <option value="creative">Creative</option>
                                                                                    <option value="technical">Technical</option>
                                                                                    <option value="minimalist">Minimalist</option>
                                                                                </select>
                                                                            </div>
                                                                        </div>

                                                                        <div className="space-y-1">
                                                                            <div className="flex justify-between items-center">
                                                                                <Label className="text-[8px] font-bold text-indigo-700">Temperature ({field.ai?.temperature ?? 0.7})</Label>
                                                                            </div>
                                                                            <input 
                                                                                type="range" min="0" max="1" step="0.1" 
                                                                                value={field.ai?.temperature ?? 0.7}
                                                                                onChange={(e) => {
                                                                                    const fields = [...editingEntity.fields];
                                                                                    fields[idx].ai = { ...fields[idx].ai, temperature: parseFloat(e.target.value) };
                                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                                }}
                                                                                className="w-full h-1 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {field.type === 'formula' && (
                                                                    <div className="space-y-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Code size={12} className="text-emerald-500" />
                                                                                    <Label className="text-[9px] font-bold text-emerald-700">Calculated Expression (JS)</Label>
                                                                                </div>
                                                                                <div className="flex items-center gap-1">
                                                                                    <Button 
                                                                                        size="icon" 
                                                                                        variant="ghost" 
                                                                                        className="h-5 w-5 hover:bg-emerald-100 text-emerald-600"
                                                                                        title="AI Helper"
                                                                                        onClick={async () => {
                                                                                            const prompt = window.prompt("What should this formula calculate? (e.g. 'total sum with 19% VAT')");
                                                                                            if (!prompt) return;
                                                                                            
                                                                                            try {
                                                                                                toast.loading("AI is thinking...", { id: 'ai-formula' });
                                                                                                const availableFields = editingEntity.fields.map((f: any) => f.name).join(', ');
                                                                                                const res = await api.brain.post('ai/generate', {
                                                                                                    prompt: `Create a JavaScript expression for a field. 
                                                                                                            Available 'data' fields: ${availableFields}. 
                                                                                                            Goal: ${prompt}. 
                                                                                                            Return ONLY the code, no markdown. 
                                                                                                            Example: data.price * 1.19`,
                                                                                                    model: 'smart'
                                                                                                });
                                                                                                if (res.content) {
                                                                                                    const fields = [...editingEntity.fields];
                                                                                                    fields[idx].formula = { ...fields[idx].formula, expression: res.content.trim().replace(/^`+|`+$/g, '') };
                                                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                                                    toast.success("Formula generated!", { id: 'ai-formula' });
                                                                                                }
                                                                                            } catch (e) {
                                                                                                toast.error("AI failed", { id: 'ai-formula' });
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <Sparkles size={10} />
                                                                                    </Button>
                                                                                    <Button 
                                                                                        size="icon" 
                                                                                        variant="ghost" 
                                                                                        className="h-5 w-5 hover:bg-emerald-100 text-emerald-600"
                                                                                        title="View Examples"
                                                                                        onClick={() => {
                                                                                            const examples = [
                                                                                                "data.price * data.quantity",
                                                                                                "data.firstName + ' ' + data.lastName",
                                                                                                "data.status === 'completed' ? 'Done' : 'Pending'",
                                                                                                "(data.subtotal || 0) * 1.19",
                                                                                                "new Date(data.createdAt).toLocaleDateString()"
                                                                                            ];
                                                                                            const chosen = window.prompt("Common Examples:\n" + examples.join("\n") + "\n\nCopy one into the box below or type its number:");
                                                                                            if (chosen && examples.includes(chosen)) {
                                                                                                const fields = [...editingEntity.fields];
                                                                                                fields[idx].formula = { ...fields[idx].formula, expression: chosen };
                                                                                                setEditingEntity({ ...editingEntity, fields });
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <HelpCircle size={10} />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                            <textarea 
                                                                                placeholder="data.price * data.quantity" 
                                                                                value={field.formula?.expression || ''}
                                                                                onChange={(e) => {
                                                                                    const fields = [...editingEntity.fields];
                                                                                    fields[idx].formula = { ...fields[idx].formula, expression: e.target.value };
                                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                                }}
                                                                                className="w-full h-20 rounded-lg border border-emerald-100 p-2 text-[10px] font-mono bg-white outline-none focus:ring-1 focus:ring-emerald-300"
                                                                            />
                                                                            <p className="text-[7px] text-emerald-400 italic">Access fields via "data.fieldname".</p>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {field.type === 'currency' && (
                                                                    <div className="space-y-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <CircleDollarSign size={12} className="text-amber-600" />
                                                                            <Label className="text-[9px] font-bold text-amber-700">Currency Formatting</Label>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <div className="space-y-1">
                                                                                <Label className="text-[8px] text-amber-600 font-medium">Currency Symbol/Code</Label>
                                                                                <select 
                                                                                    value={field.currency?.code || 'RON'}
                                                                                    onChange={(e) => {
                                                                                        const fields = [...editingEntity.fields];
                                                                                        fields[idx].currency = { ...(fields[idx].currency || {}), code: e.target.value };
                                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                                    }}
                                                                                    className="w-full h-7 rounded-lg border border-amber-200 text-[10px] px-2 bg-white"
                                                                                >
                                                                                    <option value="RON">RON (L) - Romania</option>
                                                                                    <option value="EUR">EUR (€) - Euro</option>
                                                                                    <option value="USD">USD ($) - US Dollar</option>
                                                                                    <option value="GBP">GBP (£) - UK Pound</option>
                                                                                </select>
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <Label className="text-[8px] text-amber-600 font-medium">Decimals</Label>
                                                                                <select 
                                                                                    value={field.currency?.decimals ?? 2}
                                                                                    onChange={(e) => {
                                                                                        const fields = [...editingEntity.fields];
                                                                                        fields[idx].currency = { ...(fields[idx].currency || {}), decimals: parseInt(e.target.value) };
                                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                                    }}
                                                                                    className="w-full h-7 rounded-lg border border-amber-200 text-[10px] px-2 bg-white"
                                                                                >
                                                                                    <option value="0">0 (12)</option>
                                                                                    <option value="2">2 (12.00)</option>
                                                                                    <option value="3">3 (12.000)</option>
                                                                                </select>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {(field.type === 'enum' || field.type === 'tag' || field.type === 'selection') && (
                                                        <div className="space-y-3">
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center justify-between">
                                                                    <Label className="text-[9px] font-bold">{field.type === 'tag' ? 'Tag Options' : 'Enum Options'}</Label>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-5 w-5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md"
                                                                        onClick={() => {
                                                                            const fields = [...editingEntity.fields];
                                                                            if (!fields[idx].options) fields[idx].options = [];
                                                                            const id = Math.random().toString(36).substring(2, 7);
                                                                            fields[idx].options = [...fields[idx].options, { 
                                                                                label: 'New Option', 
                                                                                value: `option_${id}`,
                                                                                color: '#6366f1'
                                                                            }];
                                                                            setEditingEntity({ ...editingEntity, fields });
                                                                        }}
                                                                    >
                                                                        <Plus size={10} />
                                                                    </Button>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100 min-h-[40px]">
                                                                    {(field.options || []).map((opt: any, optIdx: number) => {
                                                                        const isObj = opt && typeof opt === 'object';
                                                                        const val = isObj ? opt.value : opt;
                                                                        const label = isObj ? opt.label : opt;
                                                                        
                                                                        return (
                                                                            <div key={`option-row-${optIdx}`} className="flex items-center gap-2 bg-white border border-slate-200 pl-1.5 pr-2 py-1 rounded-lg shadow-sm group/opt transition-all hover:border-indigo-200">
                                                                                <input 
                                                                                    type="color"
                                                                                    value={isObj ? (opt.color || '#6366f1') : '#6366f1'}
                                                                                    onChange={(e) => {
                                                                                        const fields = [...editingEntity.fields];
                                                                                        const color = e.target.value;
                                                                                        if (isObj) fields[idx].options[optIdx] = { ...opt, color };
                                                                                        else fields[idx].options[optIdx] = { label: opt, value: opt, color };
                                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                                    }}
                                                                                    className="w-3 h-3 rounded-full border-none p-0 cursor-pointer overflow-hidden"
                                                                                />
                                                                                <div className="flex flex-col gap-0.5 min-w-[60px]">
                                                                                    <input 
                                                                                        value={label} 
                                                                                        placeholder="Label"
                                                                                        className="text-[10px] font-bold bg-transparent border-none outline-none w-full p-0 focus:ring-0"
                                                                                        onChange={(e) => {
                                                                                            const fields = [...editingEntity.fields];
                                                                                            const newVal = e.target.value;
                                                                                            if (isObj) fields[idx].options[optIdx] = { ...opt, label: newVal };
                                                                                            else fields[idx].options[optIdx] = { label: newVal, value: opt, color: '#6366f1' };
                                                                                            setEditingEntity({ ...editingEntity, fields });
                                                                                        }}
                                                                                    />
                                                                                    {isObj && (
                                                                                        <input 
                                                                                            value={val} 
                                                                                            placeholder="Value"
                                                                                            className="text-[8px] text-slate-400 bg-transparent border-none outline-none w-full p-0 focus:ring-0 -mt-1"
                                                                                            onChange={(e) => {
                                                                                                const fields = [...editingEntity.fields];
                                                                                                fields[idx].options[optIdx] = { ...opt, value: e.target.value };
                                                                                                setEditingEntity({ ...editingEntity, fields });
                                                                                            }}
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                                <button 
                                                                                    onClick={() => {
                                                                                        const fields = [...editingEntity.fields];
                                                                                        fields[idx].options = fields[idx].options.filter((_: any, i: number) => i !== optIdx);
                                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                                    }}
                                                                                    className="text-slate-300 hover:text-red-500 transition-colors ml-1"
                                                                                >
                                                                                    <X size={10} />
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {(!field.options || field.options.length === 0) && (
                                                                        <p className="text-[8px] text-slate-400 italic flex items-center h-5">Click + to add options</p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                                    <div className="space-y-1">
                                                                <Label className="text-[9px] font-bold">Display Style</Label>
                                                                <div className="flex gap-2">
                                                                    <select 
                                                                        value={field.ui?.variant || 'select'}
                                                                        onChange={(e) => {
                                                                            const fields = [...editingEntity.fields];
                                                                            fields[idx].ui = { ...(fields[idx].ui || {}), variant: e.target.value };
                                                                            setEditingEntity({ ...editingEntity, fields });
                                                                        }}
                                                                        className="flex-1 h-8 rounded-lg border border-slate-200 text-[10px] px-2"
                                                                    >
                                                                        <option value="select">Dropdown Menu</option>
                                                                        <option value="buttons">Segmented Buttons</option>
                                                                    </select>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className={cn(
                                                                            "h-8 text-[8px] font-bold uppercase",
                                                                            field.multiple ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "text-slate-400"
                                                                        )}
                                                                        onClick={() => {
                                                                            const fields = [...editingEntity.fields];
                                                                            fields[idx].multiple = !fields[idx].multiple;
                                                                            setEditingEntity({ ...editingEntity, fields });
                                                                        }}
                                                                    >
                                                                        {field.multiple ? "Multi" : "Single"}
                                                                    </Button>
                                                                </div>

                                                                {field.ui?.variant === 'buttons' && (
                                                                    <div className="flex gap-4 pt-1">
                                                                        <div className="space-y-1">
                                                                            <Label className="text-[8px] font-black uppercase text-slate-400">Track Color</Label>
                                                                            <div className="flex items-center gap-2">
                                                                                <input 
                                                                                    type="color"
                                                                                    value={field.ui?.backgroundColor || '#f1f5f9'}
                                                                                    onChange={(e) => {
                                                                                        const fields = [...editingEntity.fields];
                                                                                        fields[idx].ui = { ...(fields[idx].ui || {}), backgroundColor: e.target.value };
                                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                                    }}
                                                                                    className="w-5 h-5 rounded-md border-none p-0 cursor-pointer overflow-hidden shadow-sm"
                                                                                />
                                                                                <span className="text-[8px] font-mono text-slate-400 uppercase">{field.ui?.backgroundColor || '#f1f5f9'}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <Label className="text-[8px] font-black uppercase text-slate-400">Active Color</Label>
                                                                            <div className="flex items-center gap-2">
                                                                                <input 
                                                                                    type="color"
                                                                                    value={field.ui?.activeColor || '#6366f1'}
                                                                                    onChange={(e) => {
                                                                                        const fields = [...editingEntity.fields];
                                                                                        fields[idx].ui = { ...(fields[idx].ui || {}), activeColor: e.target.value };
                                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                                    }}
                                                                                    className="w-5 h-5 rounded-md border-none p-0 cursor-pointer overflow-hidden shadow-sm"
                                                                                />
                                                                                <span className="text-[8px] font-mono text-slate-400 uppercase">{field.ui?.activeColor || '#6366f1'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-bold">Default Option</Label>
                                                                <select 
                                                                    value={field.default || ''}
                                                                    onChange={(e) => {
                                                                        const fields = [...editingEntity.fields];
                                                                        fields[idx].default = e.target.value;
                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                    }}
                                                                    className="w-full h-8 rounded-lg border border-slate-200 text-[10px] px-2"
                                                                >
                                                                    <option value="">-- No Default --</option>
                                                                    {(field.options || []).map((o: any, oIdx: number) => {
                                                                        const val = typeof o === 'object' ? o.value : o;
                                                                        const label = typeof o === 'object' ? o.label : o;
                                                                        return <option key={`${val}-${oIdx}`} value={val}>{renderString(label, lang)}</option>;
                                                                    })}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {['relation', 'relation-many'].includes(field.type) && (
                                                        <div className="space-y-3">
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-bold">Target Entity</Label>
                                                                <select 
                                                                    value={field.relation?.target || ''}
                                                                    onChange={(e) => {
                                                                        const fields = [...editingEntity.fields];
                                                                        const targetName = e.target.value;
                                                                        fields[idx].relation = { ...fields[idx].relation, target: targetName };
                                                                        
                                                                        // Auto-add to dependencies if not present
                                                                        const dependencies = [...(editingEntity.dependencies || [])];
                                                                        if (targetName && targetName !== editingEntity.name && !dependencies.includes(targetName)) {
                                                                            dependencies.push(targetName);
                                                                        }
                                                                        
                                                                        setEditingEntity({ ...editingEntity, fields, dependencies });
                                                                    }}
                                                                    className="w-full h-8 rounded-lg border border-slate-200 text-[10px] px-2"
                                                                >
                                                                    <option value="">Select...</option>
                                                                    {entities.map((e: any) => <option key={e.name} value={e.name}>{renderString(e.label || e.name, lang)}</option>)}
                                                                </select>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-bold">Display Field</Label>
                                                                <select 
                                                                    value={field.relation?.displayField || ''}
                                                                    onChange={(e) => {
                                                                        const fields = [...editingEntity.fields];
                                                                        fields[idx].relation = { ...fields[idx].relation, displayField: e.target.value };
                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                    }}
                                                                    className="w-full h-8 rounded-lg border border-slate-200 text-[10px] px-2"
                                                                >
                                                                    <option value="">Identity Field</option>
                                                                    {(() => {
                                                                        const targetEntity = entities.find((e: any) => e.name === field.relation?.target);
                                                                        if (!targetEntity) return null;
                                                                        
                                                                        const targetFields = targetEntity.fields;

                                                                        return targetFields.map((f: any) => (
                                                                            <option key={f.name} value={f.name}>{renderString(f.label || f.name, lang)}</option>
                                                                        ));
                                                                    })()}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(field.type === 'file' || field.type === 'image') && (
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-bold">Storage Provider</Label>
                                                            <select 
                                                                value={field.storage || 'local-inbox'}
                                                                onChange={(e) => {
                                                                    const fields = [...editingEntity.fields];
                                                                    fields[idx].storage = e.target.value;
                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                }}
                                                                className="w-full h-8 rounded-lg border border-slate-200 text-[10px] px-2"
                                                            >
                                                                <option value="local-inbox">Local Agent</option>
                                                                <option value="r2">Cloudflare R2</option>
                                                            </select>
                                                        </div>
                                                    )}

                                                    <div className="space-y-2">
                                                        <Label className="text-[9px] font-bold">Field Attributes</Label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                                                                <Checkbox checked={!!field.required} onCheckedChange={v => {
                                                                    const fields = [...editingEntity.fields];
                                                                    fields[idx].required = !!v;
                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                }} /> Required
                                                            </label>
                                                            <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                                                                <Checkbox checked={!!field.unique} onCheckedChange={v => {
                                                                    const fields = [...editingEntity.fields];
                                                                    fields[idx].unique = !!v;
                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                }} /> Unique
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* COLUMN 2: VISIBILITY LOGIC */}
                                                <div className="space-y-4">
                                                    <h6 className="text-[9px] font-black uppercase text-amber-500 border-b border-amber-50 pb-1">Visibility Logic</h6>
                                                    
                                                    <div className="space-y-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-bold">Visibility Mode</Label>
                                                            <select 
                                                                value={field.visibility?.type || 'always'}
                                                                onChange={(e) => {
                                                                    const fields = [...editingEntity.fields];
                                                                    fields[idx].visibility = { ...fields[idx].visibility, type: e.target.value };
                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                }}
                                                                className="w-full h-8 rounded-lg border border-slate-200 text-[10px] px-2"
                                                            >
                                                                <option value="always">Always Show</option>
                                                                <option value="conditional">Conditional (Logic)</option>
                                                                <option value="hidden">Hidden</option>
                                                                <option value="readonly">Read-Only</option>
                                                            </select>
                                                        </div>

                                                        {field.visibility?.type === 'conditional' && (
                                                            <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2">
                                                                <div className="space-y-1">
                                                                    <Label className="text-[8px] font-black uppercase text-amber-600">Depends On Field</Label>
                                                                    <select 
                                                                        value={field.visibility?.dependsOn || ''}
                                                                        onChange={(e) => {
                                                                            const fields = [...editingEntity.fields];
                                                                            fields[idx].visibility = { ...fields[idx].visibility, dependsOn: e.target.value };
                                                                            setEditingEntity({ ...editingEntity, fields });
                                                                        }}
                                                                        className="w-full h-7 rounded-md border border-amber-200 text-[9px] px-2"
                                                                    >
                                                                        <option value="">Select Field...</option>
                                                                        {editingEntity.fields.filter((f: any) => f.name !== field.name).map((f: any) => (
                                                                            <option key={f.name} value={f.name}>{renderString(f.label || f.name, lang)}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div className="space-y-1">
                                                                        <Label className="text-[8px] font-black uppercase text-amber-600">Operator</Label>
                                                                        <select 
                                                                            value={field.visibility?.operator || '=='}
                                                                            onChange={(e) => {
                                                                                const fields = [...editingEntity.fields];
                                                                                fields[idx].visibility = { ...fields[idx].visibility, operator: e.target.value };
                                                                                setEditingEntity({ ...editingEntity, fields });
                                                                            }}
                                                                            className="w-full h-7 rounded-md border border-amber-200 text-[9px] px-2"
                                                                        >
                                                                            <option value="==">Equals</option>
                                                                            <option value="!=">Not Equals</option>
                                                                            <option value="in">Includes</option>
                                                                            <option value="set">Is Filled</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-[8px] font-black uppercase text-amber-600">Value</Label>
                                                                        {(() => {
                                                                            const depField = editingEntity.fields.find((f: any) => f.name === field.visibility?.dependsOn);
                                                                            if (depField?.type === 'enum' && Array.isArray(depField.options) && depField.options.length > 0) {
                                                                                const currentValues = Array.isArray(field.visibility?.value) 
                                                                                    ? field.visibility.value 
                                                                                    : (field.visibility?.value ? [field.visibility.value] : []);

                                                                                return (
                                                                                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1.5 border border-amber-100 rounded-lg bg-white/50">
                                                                                        {depField.options.map((opt: string) => {
                                                                                            const isSelected = currentValues.includes(opt);
                                                                                            return (
                                                                                                <button
                                                                                                    key={opt}
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        const fields = [...editingEntity.fields];
                                                                                                        let updated;
                                                                                                        if (isSelected) {
                                                                                                            updated = currentValues.filter((v: string) => v !== opt);
                                                                                                        } else {
                                                                                                            updated = [...currentValues, opt];
                                                                                                        }
                                                                                                        
                                                                                                        // Store as array if multiple, or string if single for simplicity
                                                                                                        // Actually better to always keep array if it's enum for consistency in Evaluator
                                                                                                        fields[idx].visibility = { ...fields[idx].visibility, value: updated };
                                                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                                                    }}
                                                                                                    className={cn(
                                                                                                        "text-[9px] px-2 py-0.5 rounded-md border transition-all",
                                                                                                        isSelected 
                                                                                                            ? "bg-amber-500 text-white border-amber-600 font-black shadow-sm" 
                                                                                                            : "bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600"
                                                                                                    )}
                                                                                                >
                                                                                                    {opt}
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                        {depField.options.length === 0 && <span className="text-[8px] text-slate-400 italic">No options defined</span>}
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return (
                                                                                <Input 
                                                                                    placeholder="value" 
                                                                                    value={field.visibility?.value || ''}
                                                                                    onChange={(e) => {
                                                                                        const fields = [...editingEntity.fields];
                                                                                        fields[idx].visibility = { ...fields[idx].visibility, value: e.target.value };
                                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                                    }}
                                                                                    className="h-7 rounded-md text-[9px]"
                                                                                />
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                                <p className="text-[7px] text-amber-500 italic mt-1 font-medium">Example: Show if "stare" == "final"</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* COLUMN 3: VALIDATION & FORM */}
                                                <div className="space-y-4">
                                                    <h6 className="text-[9px] font-black uppercase text-blue-500 border-b border-blue-50 pb-1">Validation & Layout</h6>
                                                    
                                                    <div className="space-y-3">
                                                        {['date', 'datetime', 'time'].includes(field.type) && (
                                                            <div className="flex items-center justify-between p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                                                                <Label className="text-[9px] font-bold text-blue-700 italic">Default to "Now"</Label>
                                                                <Switch 
                                                                    checked={field.generated === 'now' || field.default === 'now'}
                                                                    onCheckedChange={(val) => {
                                                                        const fields = [...editingEntity.fields];
                                                                        if (val) {
                                                                            fields[idx].generated = 'now';
                                                                            fields[idx].default = 'now';
                                                                        } else {
                                                                            fields[idx].generated = undefined;
                                                                            fields[idx].default = undefined;
                                                                        }
                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                    }}
                                                                />
                                                            </div>
                                                        )}

                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-[9px] font-bold">Default Value</Label>
                                                                <HelpCircle size={10} className="text-slate-300" />
                                                            </div>
                                                            <Input 
                                                                placeholder="Fallback value..." 
                                                                value={field.default || ''}
                                                                onChange={(e) => {
                                                                    const fields = [...editingEntity.fields];
                                                                    fields[idx].default = e.target.value;
                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                }}
                                                                className="h-8 rounded-lg text-xs"
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-bold">Placeholder</Label>
                                                                <Input 
                                                                    placeholder="e.g. Enter name..." 
                                                                    value={renderString(field.ui?.placeholder, lang)}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const fields = [...editingEntity.fields];
                                                                        if (!fields[idx].ui) fields[idx].ui = {};
                                                                        const current = fields[idx].ui.placeholder;

                                                                        if (typeof current === 'object' && current !== null) {
                                                                            fields[idx].ui.placeholder = { ...current, [lang]: val };
                                                                        } else {
                                                                            fields[idx].ui.placeholder = { ro: lang === 'ro' ? val : current, en: lang === 'en' ? val : current };
                                                                        }

                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                    }}
                                                                    className="h-8 rounded-lg text-xs"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-bold">Help Text (Tooltip)</Label>
                                                                <Input 
                                                                    placeholder="More info..." 
                                                                    value={renderString(field.ui?.helpText, lang)}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const fields = [...editingEntity.fields];
                                                                        if (!fields[idx].ui) fields[idx].ui = {};
                                                                        const current = fields[idx].ui.helpText;

                                                                        if (typeof current === 'object' && current !== null) {
                                                                            fields[idx].ui.helpText = { ...current, [lang]: val };
                                                                        } else {
                                                                            fields[idx].ui.helpText = { ro: lang === 'ro' ? val : current, en: lang === 'en' ? val : current };
                                                                        }

                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                    }}
                                                                    className="h-8 rounded-lg text-xs"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="text-[9px] font-bold uppercase text-slate-400">Strict Validations</Label>
                                                                <div className="group relative">
                                                                    <HelpCircle size={10} className="text-slate-300 cursor-help" />
                                                                    <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-[8px] rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
                                                                        <p className="font-bold border-b border-slate-700 pb-1 mb-1">Validation Hints:</p>
                                                                        <ul className="space-y-1 list-disc pl-3">
                                                                            <li><b>Email:</b> ^\S+@\S+\.\S+$</li>
                                                                            <li><b>Phone:</b> ^\+?[0-9\s-]&#123;7,15&#125;$</li>
                                                                            <li><b>Min/Max:</b> Numbers or String length</li>
                                                                        </ul>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Input 
                                                                placeholder="Regex Pattern (e.g. ^[0-9]+$)" 
                                                                value={field.validation?.pattern || ''}
                                                                onChange={(e) => {
                                                                    const fields = [...editingEntity.fields];
                                                                    fields[idx].validation = { ...fields[idx].validation, pattern: e.target.value };
                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                }}
                                                                className="h-8 rounded-lg text-xs font-mono"
                                                            />
                                                        </div>
                                                        
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-bold">Min Value / Len</Label>
                                                                <Input 
                                                                    type="number"
                                                                    value={field.validation?.min || ''}
                                                                    onChange={(e) => {
                                                                        const fields = [...editingEntity.fields];
                                                                        fields[idx].validation = { ...fields[idx].validation, min: Number(e.target.value) };
                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                    }}
                                                                    className="h-8 rounded-lg text-xs"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-bold">Max Value / Len</Label>
                                                                <Input 
                                                                    type="number"
                                                                    value={field.validation?.max || ''}
                                                                    onChange={(e) => {
                                                                        const fields = [...editingEntity.fields];
                                                                        fields[idx].validation = { ...fields[idx].validation, max: Number(e.target.value) };
                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                    }}
                                                                    className="h-8 rounded-lg text-xs"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-bold">Pictogramă Câmp (Lucide)</Label>
                                                            <IconPicker 
                                                                value={field.ui?.icon || field.icon}
                                                                onChange={(val) => {
                                                                    const fields = [...editingEntity.fields];
                                                                    fields[idx].ui = { ...(fields[idx].ui || {}), icon: val };
                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-bold">Form Column Width</Label>
                                                            <select 
                                                                value={field.width || '1/2'}
                                                                onChange={(e) => {
                                                                    const fields = [...editingEntity.fields];
                                                                    fields[idx].width = e.target.value;
                                                                    setEditingEntity({ ...editingEntity, fields });
                                                                }}
                                                                className="w-full h-8 rounded-lg border border-slate-200 text-[10px] px-2"
                                                            >
                                                                <option value="1/1">100% (Full Row)</option>
                                                                <option value="1/2">50% (Half Row)</option>
                                                                <option value="1/3">33% (Third)</option>
                                                                <option value="1/4">25% (Quarter)</option>
                                                            </select>
                                                        </div>

                                                        {/* FIELD QUICK ACTIONS (Enterprise Level 8) */}
                                                        <div className="space-y-1.5 pt-2 border-t border-slate-50">
                                                            <Label className="text-[9px] font-black uppercase text-slate-400">Field Quick Actions</Label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {[
                                                                    { id: 'phone', label: 'Call', icon: 'Phone', type: 'phone-call', variant: 'success' },
                                                                    { id: 'email', label: 'Mail', icon: 'Mail', type: 'url-link', variant: 'primary' },
                                                                    { id: 'whatsapp', label: 'WA', icon: 'MessageCircle', type: 'url-link', variant: 'success' },
                                                                    { id: 'link', label: 'Link', icon: 'ExternalLink', type: 'url-link', variant: 'primary' }
                                                                ].map(action => {
                                                                    const isActive = field.ui?.actions?.some((a: any) => a.id === action.id);
                                                                    return (
                                                                        <button 
                                                                            key={action.id}
                                                                            type="button"
                                                                            className={cn(
                                                                                "px-2 py-1 rounded-md text-[8px] font-bold uppercase transition-all border",
                                                                                isActive 
                                                                                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm" 
                                                                                    : "bg-white border-slate-200 text-slate-400 grayscale opacity-50 hover:opacity-100 hover:grayscale-0 hover:border-slate-300"
                                                                            )}
                                                                            onClick={() => {
                                                                                const fields = [...editingEntity.fields];
                                                                                if (!fields[idx].ui) fields[idx].ui = {};
                                                                                if (!fields[idx].ui.actions) fields[idx].ui.actions = [];
                                                                                
                                                                                if (isActive) {
                                                                                    fields[idx].ui.actions = fields[idx].ui.actions.filter((a: any) => a.id !== action.id);
                                                                                } else {
                                                                                    const actLabel = action.id === 'phone' ? 'Suna' : action.id === 'email' ? 'Email' : action.label;
                                                                                    fields[idx].ui.actions.push({
                                                                                        id: action.id,
                                                                                        label: actLabel,
                                                                                        icon: action.icon,
                                                                                        type: action.type,
                                                                                        variant: action.variant
                                                                                    });
                                                                                }
                                                                                setEditingEntity({ ...editingEntity, fields });
                                                                            }}
                                                                        >
                                                                            {renderString(action.label, lang)}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                                
                    {(!editingEntity.fields || !Array.isArray(editingEntity.fields) || editingEntity.fields.length === 0) && (
                                    <div className="py-20 border-2 border-dashed border-slate-200 rounded-3xl text-center flex flex-col items-center justify-center gap-4 bg-slate-50/30">
                                        <Columns size={40} className="text-slate-200" />
                                        <p className="text-xs font-black uppercase italic text-slate-400">Empty Architecture. Add a field to start building logic.</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* DISPLAY TAB */}
                        <TabsContent value="display" className="space-y-6 mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-5">
                                    <div>
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 mb-3">List View Settings</Label>
                                        <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600 flex items-center gap-2">
                                                    <EyeOff size={12} />
                                                    Default List Columns
                                                </label>
                                                <div className="space-y-1">
                                                    {Array.isArray(editingEntity.fields) && editingEntity.fields.map((field: any) => {
                                                        const currentCols = editingEntity.uiConfig?.list?.columns || [];
                                                        // Enterprise Level 8: Improved checkbox logic. 
                                                        // If columns list is empty, we assume default baseline visibility (non-hidden)
                                                        const isChecked = currentCols.includes(field.name) || (currentCols.length === 0 && !field.hidden && !field.hideInTable);
                                                        
                                                        return (
                                                            <label key={field.name} className="flex items-center gap-2 text-[9px] cursor-pointer hover:bg-white p-1 rounded">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isChecked}
                                                                    onChange={(e) => {
                                                                        let updatedCols = [...currentCols];
                                                                        if (updatedCols.length === 0) {
                                                                            // Initialize with default visible fields if currently empty
                                                                            updatedCols = editingEntity.fields
                                                                                .filter((f: any) => !f.hidden && !f.hideInTable)
                                                                                .map((f: any) => f.name);
                                                                        }

                                                                        if (e.target.checked) {
                                                                            if (!updatedCols.includes(field.name)) updatedCols.push(field.name);
                                                                        } else {
                                                                            updatedCols = updatedCols.filter((n: string) => n !== field.name);
                                                                            // If user unchecks the last items, we keep an empty array to indicate "override used"
                                                                            // instead of falling back to "all visible"
                                                                            if (updatedCols.length === 0) updatedCols = ['__NONE__'];
                                                                        }
                                                                        
                                                                        const config = { 
                                                                            ...editingEntity.uiConfig, 
                                                                            list: { ...editingEntity.uiConfig?.list, columns: updatedCols } 
                                                                        };
                                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                                    }}
                                                                    className="w-3 h-3 rounded"
                                                                />
                                                                <span className={cn("font-bold", isChecked ? "text-slate-600" : "text-slate-300")}>
                                                                    {renderString(field.label || field.name, lang)}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">Items Per Page</label>
                                                <Input 
                                                    type="number" 
                                                    placeholder="50" 
                                                    value={editingEntity.uiConfig?.list?.pageSize || 50}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.uiConfig, list: { ...editingEntity.uiConfig?.list, pageSize: Number(e.target.value) } };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                    className="h-9 rounded-lg text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <div>
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 mb-3">Form Layout Settings</Label>
                                        <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600 flex items-center gap-2">
                                                    <LayoutGrid size={12} />
                                                    Form Column Layout
                                                </label>
                                                <select 
                                                    value={editingEntity.uiConfig?.form?.columns || '2'}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, columns: e.target.value } };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                    className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold bg-white px-3"
                                                >
                                                    <option value="1">1 Column</option>
                                                    <option value="2">2 Columns</option>
                                                    <option value="3">3 Columns</option>
                                                    <option value="4">4 Columns</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600 flex items-center gap-2">
                                                    <LayoutGrid size={12} className="text-indigo-500" />
                                                    Modal Column Layout
                                                </label>
                                                <select 
                                                    value={editingEntity.uiConfig?.form?.modalColumns || editingEntity.uiConfig?.form?.columns || '1'}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, modalColumns: e.target.value } };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                    className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold bg-white px-3"
                                                >
                                                    <option value="1">1 Column (Default)</option>
                                                    <option value="2">2 Columns</option>
                                                    <option value="3">3 Columns</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">Show Timestamps</label>
                                                <Switch 
                                                    checked={editingEntity.uiConfig?.form?.showTimestamps !== false}
                                                    onCheckedChange={(checked) => {
                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, showTimestamps: checked } };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">Show Inbound Relations</label>
                                                <Switch 
                                                    checked={editingEntity.uiConfig?.form?.showChildren !== false}
                                                    onCheckedChange={(checked) => {
                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, showChildren: checked } };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">Show Actions</label>
                                                <Switch 
                                                    checked={editingEntity.uiConfig?.list?.showActions === true}
                                                    onCheckedChange={(checked) => {
                                                        const config = { 
                                                            ...editingEntity.uiConfig, 
                                                            form: { ...editingEntity.uiConfig?.form, showActions: checked },
                                                            list: { ...editingEntity.uiConfig?.list, showActions: checked }
                                                        };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 mb-3">Form Fields Visibility</Label>
                                        <div className="space-y-2 p-4 bg-slate-50 rounded-2xl max-h-64 overflow-y-auto">
                                            <p className="text-[8px] text-slate-500 italic mb-3">Hide fields that should not appear in forms:</p>
                                            {Array.isArray(editingEntity.fields) && editingEntity.fields.map((field: any) => {
                                                const hiddenFields = editingEntity.uiConfig?.form?.hiddenFields || [];
                                                const isHidden = hiddenFields.includes(field.name);
                                                return (
                                                    <label key={field.name} className="flex items-center gap-2 text-[9px] cursor-pointer hover:bg-white p-2 rounded transition-colors">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={!isHidden}
                                                            onChange={(e) => {
                                                                const hiddenFields = editingEntity.uiConfig?.form?.hiddenFields || [];
                                                                let updated;
                                                                if (e.target.checked) {
                                                                    updated = hiddenFields.filter((f: string) => f !== field.name);
                                                                } else {
                                                                    updated = [...hiddenFields, field.name];
                                                                }
                                                                const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, hiddenFields: updated } };
                                                                setEditingEntity({ ...editingEntity, uiConfig: config });
                                                            }}
                                                            className="w-3 h-3 rounded"
                                                        />
                                                        <span className={`font-bold ${isHidden ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                                                            {renderString(field.label || field.name, lang)}
                                                        </span>
                                                        {isHidden && <span className="text-[7px] text-slate-400 ml-auto">HIDDEN</span>}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Inbound Relations Visibility */}
                                    {editingEntity.uiConfig?.form?.showChildren !== false && (
                                        <div>
                                            <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 mb-3">Inbound Relations Visibility</Label>
                                            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl max-h-64 overflow-y-auto border border-slate-100 italic">
                                                <p className="text-[7px] text-slate-500 mb-2">Entități care fac referire la {renderString(editingEntity.label || editingEntity.name, lang)}:</p>
                                                {(() => {
                                                    const inbound = entities.filter(e => {
                                                        return e.fields.some((f: any) => f.relationEntity === editingEntity.name || f.relation?.target === editingEntity.name);
                                                    });

                                                    if (inbound.length === 0) return <p className="text-[7px] text-slate-400 italic">Nicio entitate corelată găsită.</p>;

                                                    return inbound.map((child) => {
                                                        const hiddenChildren = editingEntity.uiConfig?.form?.hiddenChildren || [];
                                                        const isHidden = hiddenChildren.includes(child.name);
                                                        return (
                                                            <label key={child.name} className="flex items-center gap-2 text-[9px] cursor-pointer hover:bg-white p-2 rounded-lg transition-all group">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={!isHidden}
                                                                    onChange={(e) => {
                                                                        const hiddenChildren = editingEntity.uiConfig?.form?.hiddenChildren || [];
                                                                        let updated;
                                                                        if (e.target.checked) {
                                                                            updated = hiddenChildren.filter((c: string) => c !== child.name);
                                                                        } else {
                                                                            updated = [...hiddenChildren, child.name];
                                                                        }
                                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, hiddenChildren: updated } };
                                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                                    }}
                                                                    className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                <span className={cn(
                                                                    "font-bold transition-colors",
                                                                    isHidden ? "text-slate-300 line-through" : "text-slate-600 group-hover:text-indigo-600"
                                                                )}>
                                                                    {renderString(child.label || child.name, lang)}
                                                                </span>
                                                                {isHidden ? (
                                                                    <Badge variant="outline" className="text-[6px] h-3 px-1 ml-auto border-slate-200 text-slate-300 uppercase">Ascuns</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[6px] h-3 px-1 ml-auto border-indigo-100 text-indigo-400 uppercase">Vizibil</Badge>
                                                                )}
                                                            </label>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* MENU TAB */}
                        <TabsContent value="menu" className="space-y-6 mt-6">
                            <div className="space-y-5">
                                <div>
                                    <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                        <Menu size={14} />
                                        Navigation Menu Settings
                                    </Label>
                                    <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <label className="text-[9px] font-black uppercase text-slate-600">Vizibil în Meniu</label>
                                                <p className="text-[7px] text-slate-400">Apare în bara laterală de navigare</p>
                                            </div>
                                            <Switch 
                                                checked={editingEntity.menuConfig?.showInMainMenu !== false}
                                                onCheckedChange={(checked) => {
                                                    const config = { ...editingEntity.menuConfig, showInMainMenu: checked };
                                                    setEditingEntity({ ...editingEntity, menuConfig: config });
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-slate-200/50">
                                            <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Menu Label Override</Label>
                                            <Input 
                                                placeholder={renderString(editingEntity.labelPlural || editingEntity.label, lang)}
                                                value={renderString(editingEntity.menuConfig?.label, lang)}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const current = editingEntity.menuConfig?.label;
                                                    let newLabel: any;
                                                    if (typeof current === 'object' && current !== null) {
                                                        newLabel = { ...current, [lang]: val };
                                                    } else {
                                                        newLabel = { ro: lang === 'ro' ? val : (current || ''), en: lang === 'en' ? val : (current || '') };
                                                    }
                                                    setEditingEntity({ 
                                                        ...editingEntity, 
                                                        menuConfig: { ...editingEntity.menuConfig, label: newLabel } 
                                                    });
                                                }}
                                                className="h-9 rounded-xl border-slate-200 text-xs font-medium"
                                            />
                                            <p className="text-[7px] text-slate-400 italic">If empty, defaults to Plural Label</p>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <label className="text-[9px] font-black uppercase text-slate-600">Vizibil în meniul "Adaugă Nou"</label>
                                                <p className="text-[7px] text-slate-400">Apare în butonul global de "+" / "Quick Add"</p>
                                            </div>
                                            <Switch 
                                                checked={!!editingEntity.menuConfig?.showInNewMenu}
                                                onCheckedChange={(checked) => {
                                                    const currentConfig = editingEntity.menuConfig || {};
                                                    const config = { ...currentConfig, showInNewMenu: checked };
                                                    setEditingEntity({ ...editingEntity, menuConfig: config });
                                                }}
                                            />
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-600">Categorie Navigație</label>
                                                <select 
                                                    value={editingEntity.menuConfig?.category || 'data_systems'}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.menuConfig, category: e.target.value };
                                                        setEditingEntity({ ...editingEntity, menuConfig: config });
                                                    }}
                                                    className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold bg-white px-3"
                                                >
                                                    <option value="main_menu">Meniu Principal</option>
                                                    <option value="data_systems">Module / Sisteme Date</option>
                                                    <option value="administration">Administrare Workspace</option>
                                                    <option value="workers">Workers & Tools</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[9px] font-black uppercase text-slate-600">Pictogramă (Lucide)</label>
                                                    {editingEntity.menuConfig?.icon && (
                                                        <button 
                                                            onClick={() => {
                                                                const config = { ...editingEntity.menuConfig };
                                                                delete config.icon;
                                                                setEditingEntity({ ...editingEntity, menuConfig: config });
                                                            }}
                                                            className="text-[7px] font-bold text-primary hover:underline uppercase"
                                                        >
                                                            Reset la Default
                                                        </button>
                                                    )}
                                                </div>
                                                <IconPicker 
                                                    value={editingEntity.menuConfig?.icon || editingEntity.icon || 'Box'}
                                                    onChange={(val) => {
                                                        const config = { ...editingEntity.menuConfig, icon: val };
                                                        setEditingEntity({ ...editingEntity, menuConfig: config });
                                                    }}
                                                />
                                                <p className="text-[7px] text-slate-400 italic">
                                                    {editingEntity.menuConfig?.icon ? "Folosește icon specific pentru meniu" : "Urmărește icon-ul de bază (Basic Tab)"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-600">Ordine Prioritate</label>
                                                <Input 
                                                    type="number" 
                                                    placeholder="100" 
                                                    value={editingEntity.menuConfig?.priority || 100}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.menuConfig, priority: Number(e.target.value) };
                                                        setEditingEntity({ ...editingEntity, menuConfig: config });
                                                    }}
                                                    className="h-9 rounded-lg text-xs"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black uppercase text-slate-600">Badge Text</Label>
                                                <Input 
                                                    placeholder="e.g. NOU, BETA" 
                                                    value={editingEntity.menuConfig?.badge || ''}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.menuConfig, badge: e.target.value };
                                                        setEditingEntity({ ...editingEntity, menuConfig: config });
                                                    }}
                                                    className="h-9 rounded-lg text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* DASHBOARD TAB */}
                        <TabsContent value="dashboard" className="space-y-6 mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-5">
                                    <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 flex items-center gap-2">
                                        <LayoutDashboard size={14} />
                                        Configurare Widget Dashboard
                                    </Label>
                                    <div className="space-y-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <label className="text-[9px] font-black uppercase text-slate-600">Activare Widget</label>
                                                <p className="text-[7px] text-slate-400">Apare pe pagina de Dashboard principală</p>
                                            </div>
                                            <Switch 
                                                checked={editingEntity.dashboardConfig?.enabled !== false}
                                                onCheckedChange={(checked) => {
                                                    const config = { ...editingEntity.dashboardConfig, enabled: checked };
                                                    setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-slate-600">Tip Vizualizare</label>
                                            <select 
                                                value={editingEntity.dashboardConfig?.widgetType || 'stats'}
                                                onChange={(e) => {
                                                    const config = { ...editingEntity.dashboardConfig, widgetType: e.target.value };
                                                    setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                }}
                                                className="w-full h-10 rounded-xl border border-slate-200 text-xs font-bold bg-white px-3"
                                            >
                                                <option value="stats">Card Statistici (Total Count)</option>
                                                <option value="list">Listă Ultimele Înregistrări</option>
                                                <option value="chart">Grafic Evoluție (Time-series)</option>
                                                <option value="distribution">Grafic Distribuție (Pie/Donut)</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-600">Lățime Widget</label>
                                                <select 
                                                    value={editingEntity.dashboardConfig?.width || '1/4'}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.dashboardConfig, width: e.target.value };
                                                        setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                    }}
                                                    className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold bg-white px-3"
                                                >
                                                    <option value="1/4">Mic (25%)</option>
                                                    <option value="1/2">Mediu (50%)</option>
                                                    <option value="full">Mare (100%)</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-600">Nr. Elemente</label>
                                                <Input 
                                                    type="number" 
                                                    value={editingEntity.dashboardConfig?.itemsToShow || 5}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.dashboardConfig, itemsToShow: Number(e.target.value) };
                                                        setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                    }}
                                                    className="h-9 rounded-lg text-xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 flex items-center gap-2">
                                        <Sparkles size={14} />
                                        Setări Avansate Vizualizare
                                    </Label>
                                    <div className="space-y-4 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-slate-600">Câmp pentru Analiză (Chart/List)</label>
                                            <select 
                                                value={editingEntity.dashboardConfig?.analysisField || ''}
                                                onChange={(e) => {
                                                    const config = { ...editingEntity.dashboardConfig, analysisField: e.target.value };
                                                    setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                }}
                                                className="w-full h-10 rounded-xl border border-slate-200 text-xs font-bold bg-white px-3"
                                            >
                                                <option value="">Selectează câmp...</option>
                                                {editingEntity.fields.map((f: any) => (
                                                    <option key={f.name} value={f.name}>{renderString(f.label || f.name, lang)}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-slate-600">Culoare Temă Widget</label>
                                            <div className="flex gap-2">
                                                {['blue', 'emerald', 'rose', 'amber', 'indigo', 'slate'].map(color => (
                                                    <button 
                                                        key={color}
                                                        className={cn(
                                                            "w-6 h-6 rounded-full border-2 transition-all",
                                                            editingEntity.dashboardConfig?.color === color ? "border-slate-900 scale-110" : "border-transparent opacity-50 hover:opacity-100"
                                                        )}
                                                        style={{ backgroundColor: color === 'emerald' ? '#10b981' : color === 'rose' ? '#f43f5e' : color === 'amber' ? '#f59e0b' : color === 'indigo' ? '#6366f1' : color === 'blue' ? '#3b82f6' : '#64748b' }}
                                                        onClick={() => {
                                                            const config = { ...editingEntity.dashboardConfig, color };
                                                            setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="pt-2">
                                            <div className="flex items-center gap-2 p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                                <Info size={14} className="text-indigo-500" />
                                                <p className="text-[8px] text-indigo-700 leading-relaxed italic">
                                                    Aceste setări vor genera automat componente vizuale pe Dashboard-ul principal bazate pe datele în timp real din {renderString(editingEntity.labelPlural || editingEntity.name, lang)}.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* PERMISSION TAB */}
                        <TabsContent value="permission" className="space-y-6 mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-5">
                                    <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Role Based Access Control</Label>
                                    <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                        {Object.entries(constants?.SYSTEM_ROLE || constants?.AUTH_CONFIG?.role || constants?.roles || {
                                            superadmin: { label: 'Super Admin' },
                                            workspace_owner: { label: 'Workspace Owner' },
                                            member: { label: 'Member' },
                                            guest: { label: 'Guest' }
                                        }).map(([roleKey, roleValue]: [string, any]) => (
                                            <div key={roleKey} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/50">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px] uppercase">{renderString(roleValue.label || roleKey, lang).charAt(0)}</div>
                                                    <span className="text-xs font-black uppercase italic text-slate-700">{renderString(roleValue.label || roleKey, lang)}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {['R', 'W', 'D'].map(action => {
                                                        const actionKey = action === 'R' ? 'read' : action === 'W' ? 'write' : 'delete';
                                                        const current = editingEntity.permission?.role?.[roleKey]?.[actionKey] ?? (roleKey === 'superadmin' || roleKey === 'workspace_owner' || roleKey === 'owner');
                                                        return (
                                                            <label key={action} className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-all has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="hidden" 
                                                                    checked={current}
                                                                    onChange={(e) => {
                                                                        const role = { ...(editingEntity.permission?.role || {}) };
                                                                        role[roleKey] = { ...(role[roleKey] || { read: false, write: false, delete: false }), [actionKey]: e.target.checked };
                                                                        const permission = { ...(editingEntity.permission || {}), role };
                                                                        setEditingEntity({ ...editingEntity, permission });
                                                                    }}
                                                                />
                                                                <span className="text-[8px] font-black">{action}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-5">
                                    <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Global Visibility</Label>
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <h5 className="text-[10px] font-black uppercase italic">Owner Only Access</h5>
                                                <p className="text-[8px] text-slate-400">Users can only see records they created</p>
                                            </div>
                                            <Switch 
                                                checked={!!editingEntity.permission?.ownerOnly} 
                                                onCheckedChange={(checked) => {
                                                    const permission = { ...(editingEntity.permission || {}), ownerOnly: checked };
                                                    setEditingEntity({ ...editingEntity, permission });
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <h5 className="text-[10px] font-black uppercase italic">Audit Logging</h5>
                                                <p className="text-[8px] text-slate-400">Track all changes in audit_log table</p>
                                            </div>
                                            <Switch 
                                                checked={editingEntity.features?.auditable !== false} 
                                                onCheckedChange={(checked) => {
                                                    const features = { ...(editingEntity.features || {}), auditable: checked };
                                                    setEditingEntity({ ...editingEntity, features });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* FEATURES TAB */}
                        <TabsContent value="features" className="space-y-6 mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-5">
                                    <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Enterprise Features</Label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {[
                                            { id: 'creatable', label: 'Allow Record Creation', desc: 'Can users add new records?' },
                                            { id: 'editable', label: 'Allow Record Editing', desc: 'Can users modify existing records?' },
                                            { id: 'deletable', label: 'Allow Record Deletion', desc: 'Can users delete records?' },
                                            { id: 'softDelete', label: 'Soft Delete', desc: 'Hide records instead of deleting from DB' },
                                            { id: 'attachments', label: 'Polymorphic Attachments', desc: 'Enable file uploads for this entity' },
                                            { id: 'import', label: 'Import Entity Data', desc: 'Enable Excel/CSV import for this entity' },
                                            { id: 'export', label: 'Data Export (CSV/PDF)', desc: 'Allow users to export list data' },
                                            { id: 'comments', label: 'Collaboration Wall', desc: 'Enable comments and mentions thread' },
                                            { id: 'timestamps', label: 'Timestamps (created/updated)', desc: 'Show/hide automated timestamps in UI' },
                                            { id: 'authorTracking', label: 'Author Tracking (created_by)', desc: 'Show/hide record creator in UI' }
                                        ].map(feat => (
                                            <div key={feat.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-white transition-all cursor-pointer group">
                                                <div className="space-y-1">
                                                    <h5 className="text-[10px] font-black uppercase italic group-hover:text-primary transition-colors">{renderString(feat.label, lang)}</h5>
                                                    <p className="text-[8px] text-slate-400">{feat.desc}</p>
                                                </div>
                                                <Switch 
                                                    checked={editingEntity.features?.[feat.id] !== false} 
                                                    onCheckedChange={(checked) => {
                                                        const features = { ...(editingEntity.features || {}), [feat.id]: checked };
                                                        setEditingEntity({ ...editingEntity, features });
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-5">
                                    <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Status & Workflow Engine</Label>
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase italic text-slate-400 underline">Workflow Status Field</Label>
                                            <select 
                                                className="w-full h-10 rounded-xl border border-slate-200 text-xs font-bold bg-white px-3"
                                                value={editingEntity.features?.workflow?.statusField || ''}
                                                onChange={(e) => {
                                                    const workflow = { ...(editingEntity.features?.workflow || {}), statusField: e.target.value };
                                                    setEditingEntity({ ...editingEntity, features: { ...editingEntity.features, workflow } });
                                                }}
                                            >
                                                <option value="">No Workflow</option>
                                                {editingEntity.fields.filter((f: any) => ['select', 'text'].includes(f.type)).map((f: any) => (
                                                    <option key={f.name} value={f.name}>{renderString(f.label || f.name, lang)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                                            <p className="text-[9px] font-medium text-primary/70 italic leading-relaxed">
                                                Workflow statuses will be automatically loaded from **Registry** key 
                                                <code className="mx-1 bg-primary/10 px-1 rounded font-bold uppercase tracking-tighter">{editingEntity.name?.toUpperCase()}_STATUS</code>.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* FLOW TAB */}
                        <TabsContent value="flow" className="space-y-6 mt-6">
                            <div className="grid grid-cols-1 gap-8">
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Autonomous Workflow Triggers</Label>
                                            <p className="text-[9px] text-slate-400 italic">Define what happens when an entity changes its status.</p>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-[9px] font-bold uppercase"
                                            onClick={() => {
                                                const flowRules = { ...(editingEntity.flowRules || {}) };
                                                const newStatus = prompt("Nume status (ex: pending, approved):");
                                                if (newStatus && !flowRules[newStatus]) {
                                                    flowRules[newStatus] = { nextStates: [], action: "", icon: "Circle", requiresFields: [] };
                                                    setEditingEntity({ ...editingEntity, flowRules });
                                                }
                                            }}
                                        >
                                            <Plus size={12} className="mr-1" /> Add Rule
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(editingEntity.flowRules || {}).map(([status, rule]: [string, any]) => (
                                            <div key={status} className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4 group hover:border-primary/20 transition-all">
                                                <div className="flex items-center justify-between">
                                                    <Badge className="bg-primary/10 text-primary border-none text-[10px] uppercase font-black px-3 py-1">
                                                        {status}
                                                    </Badge>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 text-slate-300 hover:text-destructive"
                                                        onClick={() => {
                                                            const flowRules = { ...editingEntity.flowRules };
                                                            delete flowRules[status];
                                                            setEditingEntity({ ...editingEntity, flowRules });
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <Label className="text-[8px] font-bold uppercase text-slate-400">Action Type</Label>
                                                        <select 
                                                            className="w-full h-8 rounded-xl border border-slate-100 text-[10px] font-bold bg-slate-50 px-2"
                                                            value={rule.action || ''}
                                                            onChange={(e) => {
                                                                const flowRules = { ...editingEntity.flowRules };
                                                                flowRules[status] = { ...rule, action: e.target.value };
                                                                setEditingEntity({ ...editingEntity, flowRules });
                                                            }}
                                                        >
                                                            <option value="">No Auto-Trigger</option>
                                                            <option value="email_admin">Email Admin</option>
                                                            <option value="slack_notify">Slack Notification</option>
                                                            <option value="whatsapp_client">WhatsApp Client</option>
                                                            <option value="generate_pdf">Generate PDF</option>
                                                            <option value="webhook">External Webhook</option>
                                                        </select>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[8px] font-bold uppercase text-slate-400">Buttons Icon</Label>
                                                        <div className="flex items-center gap-2">
                                                            <IconPicker 
                                                                value={rule.icon || 'Circle'} 
                                                                onChange={(icon) => {
                                                                    const flowRules = { ...editingEntity.flowRules };
                                                                    flowRules[status] = { ...rule, icon };
                                                                    setEditingEntity({ ...editingEntity, flowRules });
                                                                }}
                                                            />
                                                            <span className="text-[10px] font-mono text-slate-400">{rule.icon || 'Circle'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[8px] font-bold uppercase text-slate-400">Validation (Required Fields)</Label>
                                                        <div className="flex flex-wrap gap-1 border border-slate-100 rounded-xl p-2 bg-slate-50 min-h-[40px]">
                                                            {editingEntity.fields.map((f: any) => (
                                                                <div 
                                                                    key={f.name}
                                                                    className={cn(
                                                                        "text-[8px] px-2 py-0.5 rounded-full cursor-pointer transition-all border",
                                                                        rule.requiresFields?.includes(f.name) 
                                                                            ? "bg-primary text-white border-primary" 
                                                                            : "bg-white text-slate-400 border-slate-200 hover:border-primary/30"
                                                                    )}
                                                                    onClick={() => {
                                                                        const flowRules = { ...editingEntity.flowRules };
                                                                        const fields = rule.requiresFields || [];
                                                                        const newFields = fields.includes(f.name) 
                                                                            ? fields.filter((fn: string) => fn !== f.name)
                                                                            : [...fields, f.name];
                                                                        flowRules[status] = { ...rule, requiresFields: newFields };
                                                                        setEditingEntity({ ...editingEntity, flowRules });
                                                                    }}
                                                                >
                                                                    {renderString(f.label || f.name, lang)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {Object.keys(editingEntity.flowRules || {}).length === 0 && (
                                        <div className="p-12 border-2 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center text-center space-y-2">
                                            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                                                <Activity size={24} />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase">No Workflow Rules</h4>
                                                <p className="text-[10px] text-slate-400 max-w-[200px]">Define actions that trigger automatically when status changes.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="pt-4">
                        <Label className="text-[11px] font-black uppercase italic tracking-widest text-slate-400 flex items-center gap-2 mb-3">
                            <Code className="h-3 w-3" />
                            Advanced JSON View (Read-Only)
                        </Label>
                        <textarea 
                            value={JSON.stringify(editingEntity, null, 2)}
                            readOnly
                            className="w-full h-40 rounded-2xl border border-slate-100 p-4 font-mono text-[8px] bg-slate-50/50 text-slate-400 resize-none outline-none overflow-auto"
                        />
                    </div>
                </GlassCard>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4">
                        <Box className="h-16 w-16 text-slate-200 mx-auto" />
                        <p className="text-sm font-bold text-slate-500">Select an entity to edit</p>
                        <p className="text-xs text-slate-400">or create a new one to get started</p>
                    </div>
                </div>
            )}
                </div>
            </div>

            {/* Blueprint Gallery Dialog */}
            <Dialog open={blueprintDialog} onOpenChange={setBlueprintDialog}>
                <DialogContent className="max-w-4xl bg-white/95 backdrop-blur-xl border-slate-200 rounded-[2rem] shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4 border-b border-slate-100 bg-primary/5">
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <Sparkles size={20} />
                            </div>
                            Module Blueprints
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500">
                            Alege un punct de plecare pentru noua ta entitate sau începe de la zero.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
                        {/* Start from Scratch */}
                        <div 
                            onClick={() => startNew()}
                            className="p-6 border-2 border-dashed border-slate-200 rounded-[2rem] hover:border-primary hover:bg-primary/5 cursor-pointer transition-all group flex flex-col items-center justify-center text-center gap-3"
                        >
                            <div className="p-3 bg-slate-100 rounded-2xl text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                                <Plus size={24} />
                            </div>
                            <div>
                                <h5 className="font-black uppercase italic text-sm text-slate-700 group-hover:text-primary">Blank Slate</h5>
                                <p className="text-[10px] text-slate-400 font-medium">Începe o entitate fără câmpuri predefinite</p>
                            </div>
                        </div>

                        {/* Blueprints from Registry */}
                        {constants?.BLUEPRINT && Object.entries(constants.BLUEPRINT).map(([id, bp]: [string, any]) => (
                            <div 
                                key={id}
                                onClick={() => startNew({ ...bp, name: id })}
                                className="p-6 border-2 border-slate-100 rounded-[2rem] hover:border-primary hover:bg-primary/5 cursor-pointer transition-all group space-y-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "p-3 rounded-2xl text-white shadow-lg shadow-primary/20",
                                        getThemeClasses(bp.colorTheme || 'blue').bg
                                    )}>
                                        <Box size={20} />
                                    </div>
                                    <h5 className="font-black uppercase italic text-sm text-slate-700 group-hover:text-primary">{renderString(bp.label, lang)}</h5>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium line-clamp-2">
                                    {renderString(bp.description || `Template pentru ${renderString(bp.label, lang)} cu ${bp.fields?.length || 0} câmpuri standard.`, lang)}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {bp.fields?.slice(0, 3).map((f: any) => (
                                        <Badge key={f.id} variant="outline" className="text-[8px] font-bold py-0 h-4 border-slate-200 bg-white">
                                            {f.id}
                                        </Badge>
                                    ))}
                                    {(bp.fields?.length || 0) > 3 && <span className="text-[8px] text-slate-400">+{bp.fields.length - 3}</span>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50">
                        <Button 
                            variant="ghost"
                            onClick={() => setBlueprintDialog(false)}
                            className="w-full rounded-2xl font-black uppercase italic tracking-tight"
                        >
                            Anulează
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dry Run Results Dialog */}
            <Dialog open={dryRunDialog.open} onOpenChange={(open) => !open && setDryRunDialog({ ...dryRunDialog, open })}>
                <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-slate-200 rounded-[2rem] shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4 border-b border-slate-100 bg-slate-50/50">
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <Code size={20} />
                            </div>
                            SQL Preview (Dry Run)
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500">
                            Aceste comenzi DDL vor fi executate pe baza de date dacă salvezi modificările.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-8 max-h-[60vh] overflow-y-auto">
                        {dryRunDialog.results && Object.keys(dryRunDialog.results).length > 0 ? (
                            <div className="space-y-6">
                                {Object.entries(dryRunDialog.results).map(([entityName, sqls]) => (
                                    <div key={entityName} className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-slate-900 text-white font-mono uppercase text-[9px] px-2">
                                                {entityName}
                                            </Badge>
                                            <div className="h-px flex-1 bg-slate-100" />
                                        </div>
                                        {sqls.length > 0 ? (
                                            <div className="space-y-2">
                                                {sqls.map((sql, idx) => (
                                                    <div key={idx} className="group relative">
                                                        <pre className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700 overflow-x-auto">
                                                            {sql};
                                                        </pre>
                                                        <button 
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(sql);
                                                                toast.success("Copied to clipboard");
                                                            }}
                                                            className="absolute right-2 top-2 p-1.5 opacity-0 group-hover:opacity-100 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-primary transition-all shadow-sm"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
                                                <div className="p-1.5 bg-emerald-500 rounded-full text-white">
                                                    <Zap size={10} />
                                                </div>
                                                <p className="text-[11px] font-bold text-emerald-700 uppercase italic">
                                                    Nicio modificare necesară (Schema deja sincronizată)
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Sparkles className="h-12 w-12 text-slate-200 mb-4" />
                                <p className="text-sm font-black text-slate-400 uppercase italic">
                                    Nicio modificare de structură detectată
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50">
                        <Button 
                            onClick={() => setDryRunDialog({ ...dryRunDialog, open: false })}
                            className="w-full rounded-2xl font-black uppercase italic tracking-tight"
                        >
                            Am înțeles
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Garbage Collector Dialog */}
            <Dialog open={garbageDialog.open} onOpenChange={(open) => !open && setGarbageDialog({ ...garbageDialog, open })}>
                <DialogContent className="max-w-xl bg-white/95 backdrop-blur-xl border-slate-200 rounded-[2rem] shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4 border-b border-slate-100 bg-amber-50/30">
                        <DialogTitle className="text-xl font-black uppercase italic tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                                <Trash2 size={20} />
                            </div>
                            Database Garbage Collector
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500">
                            Tabele găsite în baza de date care nu mai au o definiție activă în sistem.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-8 max-h-[50vh] overflow-y-auto">
                        {garbageDialog.orphans.length > 0 ? (
                            <div className="space-y-3">
                                {garbageDialog.orphans.map((orphan) => (
                                    <div key={orphan.name} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group transition-all hover:bg-white hover:shadow-sm">
                                        <div className="space-y-1">
                                            <p className="font-mono text-xs font-bold text-slate-700">{orphan.name}</p>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[8px] font-black uppercase bg-white">
                                                    {orphan.rowCount} Rows
                                                </Badge>
                                                {orphan.rowCount === 0 && (
                                                    <span className="text-[9px] text-emerald-600 font-bold uppercase italic flex items-center gap-1">
                                                        <Zap size={8} /> Safe to remove
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <Button 
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteOrphanTable(orphan.name)}
                                            className="rounded-xl h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Shield className="h-12 w-12 text-emerald-100 mb-4" />
                                <p className="text-sm font-black text-emerald-600 uppercase italic">
                                    Baza de date este curată
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium mt-1">
                                    Niciun tabel orfan detectat.
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50/50">
                        <Button 
                            variant="outline"
                            onClick={() => setGarbageDialog({ ...garbageDialog, open: false })}
                            className="w-full rounded-2xl font-black uppercase italic tracking-tight"
                        >
                            Închide
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ ...deleteDialog, open })}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2 uppercase italic font-black">
                            <Trash2 size={18} />
                            Șterge Entitate: {renderString(deleteDialog.entity?.label, lang)}
                        </DialogTitle>
                        <DialogDescription className="text-xs pt-2">
                            Această acțiune va elimina definiția entității din sistem. 
                            Pentru a confirma, scrie numele tehnic al entității: <strong className="font-mono text-destructive">{renderString(deleteDialog.entity?.name, lang)}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase italic text-slate-500">Confirmă Numele</Label>
                            <Input 
                                value={confirmName} 
                                onChange={e => setConfirmName(e.target.value)} 
                                placeholder={deleteDialog.entity?.name}
                                className="h-10 rounded-xl border-destructive/30 font-mono text-sm focus:ring-destructive/20"
                            />
                        </div>
                        
                        <div className="flex items-start space-x-3 p-4 rounded-2xl bg-red-50 border border-red-100">
                            <Checkbox 
                                id="dropDb" 
                                checked={dropDatabase} 
                                onCheckedChange={(checked) => {
                                    setDropDatabase(!!checked);
                                    if (!checked) setForceDelete(false);
                                }} 
                                className="mt-1"
                            />
                            <div className="space-y-1">
                                <Label htmlFor="dropDb" className="text-[11px] font-black leading-tight cursor-pointer text-red-700 uppercase italic">
                                    Șterge și Tabelul din Baza de Date
                                </Label>
                                <p className="text-[9px] text-red-600/70 font-medium">
                                    WARNING: Această opțiune va rula un <code className="bg-red-100 px-1 rounded">DROP TABLE</code>. 
                                    Toate datele salvate în această entitate vor fi pierdute IREVERSIBIL!
                                </p>
                            </div>
                        </div>

                        {dropDatabase && (
                            <div className="flex items-start space-x-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 animate-in slide-in-from-top-2 duration-300">
                                <Checkbox 
                                    id="forceDelete" 
                                    checked={forceDelete} 
                                    onCheckedChange={(checked) => setForceDelete(!!checked)} 
                                    className="mt-1 border-amber-400 data-[state=checked]:bg-amber-600"
                                />
                                <div className="space-y-1">
                                    <Label htmlFor="forceDelete" className="text-[11px] font-black leading-tight cursor-pointer text-amber-700 uppercase italic">
                                        Forțează ștergerea (chiar dacă există date)
                                    </Label>
                                    <p className="text-[9px] text-amber-600/70 font-medium">
                                        Bifează această căsuță dacă ești SIGUR că vrei să ștergi tabelul deși acesta conține înregistrări active.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button 
                            variant="outline" 
                            onClick={() => setDeleteDialog({ open: false, entity: null })}
                            className="rounded-xl font-bold uppercase text-[10px]"
                        >
                            Anulează
                        </Button>
                        <Button 
                            variant="destructive" 
                            disabled={confirmName !== deleteDialog.entity?.name} 
                            onClick={() => executeDelete()}
                            className="rounded-xl font-black uppercase italic text-[10px] px-6"
                        >
                            Confirmă Ștergerea
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Level 9 Self-Healing Dialog */}
            <Dialog open={healingDialog.open} onOpenChange={(open) => setHealingDialog({ ...healingDialog, open })}>
                <DialogContent className="max-w-2xl rounded-3xl border-slate-200/50">
                    <DialogHeader>
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                            <Sparkles className="h-6 w-6 text-primary" />
                        </div>
                        <DialogTitle className="text-xl font-black italic uppercase tracking-tighter">Autonomous Intelligence Hub (Level 9)</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500">
                            Analiza de performanță în timp real și optimizarea automată a bazei de date.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        {(!healingDialog.report || healingDialog.report.length === 0) ? (
                            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <Activity className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-500 italic uppercase">Nu au fost detectate interogări lente.</p>
                                <p className="text-[10px] text-slate-400 font-medium">Sistemul funcționează la parametri optimi.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {healingDialog.report.map((item, idx) => (
                                    <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-start gap-4">
                                        <div className={cn("mt-1", item.action === 'INDEX_CREATED' ? "text-emerald-500" : "text-amber-500")}>
                                            {item.action === 'INDEX_CREATED' ? <Zap className="h-5 w-5" /> : <Info className="h-5 w-5" />}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter px-2 border-slate-200 text-slate-400">
                                                    {item.table}
                                                </Badge>
                                                <span className="text-[9px] font-black uppercase italic text-slate-300">{item.action}</span>
                                            </div>
                                            <p className="text-[10px] font-mono bg-slate-50 p-2 rounded-lg text-slate-600 line-clamp-1">{(item as any).pattern}</p>
                                            <p className="text-[11px] font-bold text-slate-700">
                                                {item.action === 'INDEX_CREATED' ? 'Indice creat automat pentru optimizare scanare.' : 
                                                 item.action === 'AI_ERROR' ? `Eroare AI: ${item.error || 'Nu s-a putut contacta LLM'}` :
                                                 item.reason || 'Optimizare planificată.'}
                                            </p>
                                            {item.sql && (
                                                <div className="mt-2 bg-slate-900 p-2 rounded-xl text-[9px] font-mono text-emerald-400 leading-tight">
                                                    {item.sql}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button 
                            onClick={() => setHealingDialog({ open: false, report: null })}
                            className="rounded-xl font-black uppercase italic text-xs w-full"
                        >
                            Închide Raportul
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

