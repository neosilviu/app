import React, { useState, useEffect } from 'react';
import { useConfig } from '~/hooks/useConfig';
import { useTranslation } from 'react-i18next';
import { api, cn, socket, renderString, normalizeEntity, getThemeClasses } from '~/lib/core';
import { toast } from 'sonner';
import { Search, Plus, Save, Trash2, X, Box, Columns, Code, RefreshCw, HelpCircle, Menu, LayoutGrid, Eye, EyeOff, LayoutDashboard, Zap, Shield, Link, Sparkles, CircleDollarSign, Info, ArrowUp, ArrowDown, Copy } from 'lucide-react';
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

    // Delete confirmation state
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, entity: any | null }>({ open: false, entity: null });
    const [confirmName, setConfirmName] = useState('');
    const [dropDatabase, setDropDatabase] = useState(false);
    const [forceDelete, setForceDelete] = useState(false);

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
            const res = await api.brain.post('entity/save', editingEntity);
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

    const handleDelete = (entity: any) => {
        // Check if any other entity depends on this one
        const dependents = entities.filter(e => 
            e.name !== entity.name && 
            Array.isArray(e.requires) && 
            e.requires.includes(entity.name)
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
                await fetchEntities();
                await refreshConfig(true);
                
                // Broadcast change
                socket.emit('config:updated', { source: 'entity-builder', action: 'delete', entity: entity.name });
            } else {
                toast.error(res.error || "Delete failed");
            }
        } catch (e: any) {
            toast.error("Delete failed");
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

    const startNew = () => {
        setEditingEntity({
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
        });
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
                    onClick={startNew}
                    className="rounded-xl font-black uppercase italic text-xs px-6"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    New Entity
                </Button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex gap-6 p-6">
                {/* Left Sidebar - Entity List */}
                <div className="w-80 flex flex-col border-r border-slate-200/50 pr-6 gap-4">
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
                                        "w-full p-3 text-left rounded-2xl border-2 transition-all group relative",
                                        editingEntity?.id === entity.id 
                                            ? `border-indigo-500 bg-indigo-50` 
                                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                    )}
                                >
                                    <div 
                                        className="flex items-start gap-2 cursor-pointer"
                                        onClick={() => setEditingEntity(normalizeEntity(entity))}
                                    >
                                        <div className={cn(
                                            "p-2 rounded-lg text-white mt-0.5 shadow-sm",
                                            theme.bg
                                        )}>
                                            <Box size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-900 truncate">{renderString(entity.label, lang)}</p>
                                            <p className="text-[10px] text-slate-500 font-mono uppercase">{renderString(entity.name, lang)}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                {entity.isSystem && (
                                                    <Badge variant="outline" className="px-1 py-0 h-3.5 text-[7px] font-black uppercase tracking-tighter bg-slate-50 text-slate-500 border-slate-200">
                                                        SYSTEM
                                                    </Badge>
                                                )}
                                                <p className="text-[9px] text-slate-400 line-clamp-1">{renderString(entity.description, lang)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (!entity.isSystem) handleDelete(entity); 
                                        }}
                                        className={cn(
                                            "absolute right-3 top-3 p-1.5 opacity-0 group-hover:opacity-100 transition-all rounded-lg",
                                            entity.isSystem 
                                                ? "text-slate-300 cursor-not-allowed" 
                                                : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                                        )}
                                        title={entity.isSystem ? "System Entity Locked" : "Delete Entity"}
                                    >
                                        {entity.isSystem ? <Shield size={12} /> : <Trash2 size={12} />}
                                    </button>
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Content - Edit Form */}
                <div className="flex-1 overflow-y-auto">
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
                                        className="rounded-xl font-black uppercase italic text-xs px-6" 
                                        disabled={saving}
                                        onClick={handleSave}
                                    >
                                        {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save
                                    </Button>
                                </div>
                            </div>

                            <Tabs defaultValue="basic" className="w-full">
                                <TabsList className="grid w-full grid-cols-7 bg-slate-100/50 p-2 rounded-2xl">
                                    <TabsTrigger value="basic" className="text-[9px] font-bold uppercase">Basic</TabsTrigger>
                                    <TabsTrigger value="fields" className="text-[9px] font-bold uppercase">Fields</TabsTrigger>
                                    <TabsTrigger value="display" className="text-[9px] font-bold uppercase"><Eye size={11} /></TabsTrigger>
                                    <TabsTrigger value="menu" className="text-[9px] font-bold uppercase"><Menu size={11} /></TabsTrigger>
                                    <TabsTrigger value="dashboard" className="text-[9px] font-bold uppercase"><LayoutDashboard size={11} /></TabsTrigger>
                                    <TabsTrigger value="permission" className="text-[9px] font-bold uppercase"><Shield size={11} /></TabsTrigger>
                                    <TabsTrigger value="features" className="text-[9px] font-bold uppercase"><Zap size={11} /></TabsTrigger>
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
                                            onChange={(e) => setEditingEntity({ ...editingEntity, label: e.target.value })}
                                            className="h-12 rounded-2xl border-slate-200 font-medium focus:ring-primary/20"
                                        />
                                        <p className="text-[8px] text-slate-400 italic">Human-readable label shown in UI</p>
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
                                            onChange={(e) => setEditingEntity({ ...editingEntity, description: e.target.value })}
                                            className="w-full h-32 rounded-2xl border border-slate-200 p-4 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Visual Identity (Icon)</Label>
                                        <IconPicker 
                                            value={editingEntity.icon}
                                            onChange={(val) => setEditingEntity({ ...editingEntity, icon: val })}
                                            placeholder="Choose an icon..."
                                        />
                                        <p className="text-[8px] text-slate-400 italic">Icon used in navigation and lists</p>
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
                                                {(editingEntity.requires || []).map((dep: string) => (
                                                    <Badge key={dep} variant="outline" className="bg-white border-amber-200 text-amber-700 gap-1 text-[9px] py-0 px-2">
                                                        {renderString(entities.find(e => e.name === dep)?.label || dep, lang)}
                                                        <X 
                                                            size={10} 
                                                            className="cursor-pointer hover:text-red-500" 
                                                            onClick={() => {
                                                                const requires = (editingEntity.requires || []).filter((r: string) => r !== dep);
                                                                setEditingEntity({ ...editingEntity, requires });
                                                            }}
                                                        />
                                                    </Badge>
                                                ))}
                                                {(!editingEntity.requires || editingEntity.requires.length === 0) && (
                                                    <span className="text-[9px] text-amber-500/50 italic">No dependencies defined</span>
                                                )}
                                            </div>
                                            <select 
                                                className="h-8 rounded-lg border border-amber-200 text-[10px] font-bold bg-white px-2 w-full focus:ring-amber-500/20"
                                                onChange={(e) => {
                                                    if (!e.target.value) return;
                                                    const requires = [...(editingEntity.requires || [])];
                                                    if (!requires.includes(e.target.value)) {
                                                        requires.push(e.target.value);
                                                    }
                                                    setEditingEntity({ ...editingEntity, requires });
                                                    e.target.value = '';
                                                }}
                                            >
                                                <option value="">+ Add Dependency...</option>
                                                {entities
                                                    .filter(e => e.name !== editingEntity.name && !(editingEntity.requires || []).includes(e.name))
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
                        <TabsContent value="fields" className="space-y-6 mt-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <div className="space-y-0.5">
                                        <h5 className="text-[11px] font-black uppercase italic tracking-widest text-slate-900 flex items-center gap-2">
                                            <Columns className="h-4 w-4 text-primary" />
                                            Structural Architecture
                                        </h5>
                                        <p className="text-[9px] text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Define the schema, validation and visibility logic for this entity</p>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        disabled={editingEntity.isSystem}
                                        className={cn(
                                            "h-9 rounded-xl font-black uppercase italic text-[10px] border-primary/20 text-primary transition-all shadow-sm flex-shrink-0",
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
                                        <Plus className="mr-2 h-4 w-4" /> Add Logic Field
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    <Accordion type="single" collapsible className="space-y-4">
                                        {Array.isArray(editingEntity.fields) && editingEntity.fields.map((field: any, idx: number) => (
                                            <AccordionItem key={field.name || `field-${idx}`} value={`field-${idx}`} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border-none">
                                                <div className="relative group/item">
                                                    <AccordionTrigger className="hover:no-underline w-full p-0">
                                                        {/* Header Area */}
                                                        <div className="bg-slate-50/50 border-b border-slate-100 p-4 flex items-center justify-between gap-4 w-full">
                                                            <div className="flex-1 flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-mono text-[10px]">
                                                                    #{idx + 1}
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs font-black uppercase italic text-slate-700">{renderString(field.label || field.name || 'New Field', lang)}</span>
                                                                    <Badge variant="outline" className="text-[8px] font-bold uppercase py-0 px-2 bg-indigo-50 text-indigo-600 border-indigo-100">{field.type || 'text'}</Badge>
                                                                    {field.required && <Badge variant="outline" className="text-[8px] font-bold uppercase py-0 px-2 bg-red-50 text-red-600 border-red-100">Required</Badge>}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Spacer for actions overlay */}
                                                            <div className="w-32" />
                                                        </div>
                                                    </AccordionTrigger>

                                                    {/* Actions Overlay (Outside of Trigger button to avoid nested buttons) */}
                                                    <div className="absolute right-10 top-4 flex items-center gap-1 z-20">
                                                        <div className="flex items-center gap-0.5 mr-2">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                disabled={editingEntity.isSystem}
                                                                className="h-8 w-8 text-slate-300 rounded-lg hover:text-indigo-600 disabled:opacity-20 translate-y-[2px]"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    duplicateField(idx);
                                                                }}
                                                            >
                                                                <Copy size={12} />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                disabled={editingEntity.isSystem || idx === 0}
                                                                className="h-8 w-8 text-slate-300 rounded-lg hover:text-indigo-600 disabled:opacity-20 translate-y-[2px]"
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

                                                                // Reset visibility logic for fields that depended on the deleted field
                                                                fields.forEach((f: any, fIdx: number) => {
                                                                    if (f.visibility?.dependsOn === fieldName) {
                                                                        fields[fIdx].visibility = { type: 'always' };
                                                                    }
                                                                });

                                                                setEditingEntity({ ...editingEntity, fields });
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

                                                                        // Update visibility dependencies
                                                                        fields.forEach((f, fIdx) => {
                                                                            if (f.visibility?.dependsOn === oldName) {
                                                                                fields[fIdx].visibility = { ...f.visibility, dependsOn: newName };
                                                                            }
                                                                        });

                                                                        setEditingEntity({ ...editingEntity, fields });
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
                                                                        const fields = [...editingEntity.fields];
                                                                        fields[idx].label = e.target.value;
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
                                                                            <div key={`${val}-${optIdx}`} className="flex items-center gap-2 bg-white border border-slate-200 pl-1.5 pr-2 py-1 rounded-lg shadow-sm group/opt transition-all hover:border-indigo-200">
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
                                                                        
                                                                        // Auto-add to requires if not present
                                                                        const requires = [...(editingEntity.requires || [])];
                                                                        if (targetName && targetName !== editingEntity.name && !requires.includes(targetName)) {
                                                                            requires.push(targetName);
                                                                        }
                                                                        
                                                                        setEditingEntity({ ...editingEntity, fields, requires });
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
                                                                    value={field.ui?.placeholder || ''}
                                                                    onChange={(e) => {
                                                                        const fields = [...editingEntity.fields];
                                                                        if (!fields[idx].ui) fields[idx].ui = {};
                                                                        fields[idx].ui.placeholder = e.target.value;
                                                                        setEditingEntity({ ...editingEntity, fields });
                                                                    }}
                                                                    className="h-8 rounded-lg text-xs"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-bold">Help Text (Tooltip)</Label>
                                                                <Input 
                                                                    placeholder="More info..." 
                                                                    value={field.ui?.helpText || ''}
                                                                    onChange={(e) => {
                                                                        const fields = [...editingEntity.fields];
                                                                        if (!fields[idx].ui) fields[idx].ui = {};
                                                                        fields[idx].ui.helpText = e.target.value;
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
                                                    defaultValue={editingEntity.uiConfig?.list?.pageSize || 50}
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
                                                    defaultValue={editingEntity.uiConfig?.form?.columns || '2'}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, columns: e.target.value } };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                    className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold bg-white px-3"
                                                >
                                                    <option value="1">1 Column</option>
                                                    <option value="2">2 Columns</option>
                                                    <option value="3">3 Columns</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">Show Timestamps</label>
                                                <Switch 
                                                    defaultChecked={editingEntity.uiConfig?.form?.showTimestamps !== false}
                                                    onCheckedChange={(checked) => {
                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, showTimestamps: checked } };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">Show Inbound Relations</label>
                                                <Switch 
                                                    defaultChecked={editingEntity.uiConfig?.form?.showChildren !== false}
                                                    onCheckedChange={(checked) => {
                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, showChildren: checked } };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">Show Archive/Delete</label>
                                                <Switch 
                                                    defaultChecked={editingEntity.uiConfig?.form?.showActions !== false}
                                                    onCheckedChange={(checked) => {
                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, showActions: checked } };
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

                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <label className="text-[9px] font-black uppercase text-slate-600">Vizibil în meniul "Adaugă Nou"</label>
                                                <p className="text-[7px] text-slate-400">Apare în butonul global de "+" / "Quick Add"</p>
                                            </div>
                                            <Switch 
                                                checked={!!editingEntity.menuConfig?.showInNewMenu}
                                                onCheckedChange={(checked) => {
                                                    const config = { ...editingEntity.menuConfig, showInNewMenu: checked };
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
                                                <label className="text-[9px] font-black uppercase text-slate-600">Pictogramă (Lucide)</label>
                                                <IconPicker 
                                                    value={editingEntity.menuConfig?.icon || editingEntity.icon || 'Box'}
                                                    onChange={(val) => {
                                                        const config = { ...editingEntity.menuConfig, icon: val };
                                                        setEditingEntity({ ...editingEntity, menuConfig: config });
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-600">Ordine Prioritate</label>
                                                <Input 
                                                    type="number" 
                                                    placeholder="100" 
                                                    defaultValue={editingEntity.menuConfig?.priority || 100}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.menuConfig, priority: Number(e.target.value) };
                                                        setEditingEntity({ ...editingEntity, menuConfig: config });
                                                    }}
                                                    className="h-9 rounded-lg text-xs"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-600">Badge Text</label>
                                                <Input 
                                                    placeholder="e.g. NOU, BETA" 
                                                    defaultValue={editingEntity.menuConfig?.badge || ''}
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
                                                    defaultValue={editingEntity.dashboardConfig?.itemsToShow || 5}
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
        </div>
    );
}

