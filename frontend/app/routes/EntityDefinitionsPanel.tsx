import React, { useState, useEffect, useRef } from 'react';
import { useConfig } from '~/hooks/useConfig';
import { useTranslation } from 'react-i18next';
import { 
    api, 
    cn,
    normalizeEntity
} from '~/lib/core';
import { getErrorMessage } from '~/lib/utils';
import { toast } from 'sonner';
import { Search, Plus, Save, Trash2, Edit2, X, Box, Columns, Code, Layout, Settings, RefreshCw, ChevronRight, HelpCircle, Menu, LayoutGrid, Eye, EyeOff, LayoutDashboard, Zap } from 'lucide-react';
import { GlassCard } from '~/components/ui/GlassCard';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { IconPicker } from '~/components/ui/IconPicker';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { 
    Tabs, 
    TabsContent, 
    TabsList, 
    TabsTrigger 
} from '~/components/ui/tabs';
import { Switch } from '~/components/ui/switch';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '~/components/ui/dialog';
import { Textarea } from '~/components/ui/textarea';

export function EntityDefinitionsPanel() {
    const { entity: configEntities, refreshConfig } = useConfig();
    const { t } = useTranslation(['common', 'superadmin']);
    
    const [entityData, setEntityData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingEntity, setEditingEntity] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const savingRef = useRef(false);

    // AI Architect State
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isArchitectRunning, setIsArchitectRunning] = useState(false);

    const handleArchitect = async () => {
        if (!aiPrompt) return;
        setIsArchitectRunning(true);
        try {
            const res = await api.brain.action('ai_prompt', 'architect', { prompt: aiPrompt });
            if (res.success && res.data) {
                // The AI might return an object that needs normalization
                const raw = res.data;
                const result = normalizeEntity(raw);
                
                setEditingEntity({
                    ...result,
                    name: result.name || result.id || 'new_entity',
                    id: undefined, // Ensure we don't overwrite if AI hallucinated an ID
                    fields: result.fields || [],
                    uiConfig: result.uiConfig || {
                        list: { columns: [] },
                        form: { sections: [] }
                    }
                });
                setIsAiModalOpen(false);
                setAiPrompt('');
                toast.success(t('superadmin:entity_builder:ai_success'));
            } else {
                toast.error(res.error || "Architect failed");
            }
        } catch (e: any) {
            toast.error(getErrorMessage(e, "Architect failed"));
        } finally {
            setIsArchitectRunning(false);
        }
    };

    useEffect(() => {
        if (!configEntities) return;
        
        const list = Object.entries(configEntities).map(([key, entity]: [string, any]) => {
            return normalizeEntity({ ...entity, name: entity.name || key });
        });
        setEntityData(list);
        setLoading(false);
    }, [configEntities]);

    const handleSave = async () => {
        if (savingRef.current) return;
        if (!editingEntity.name) return toast.error(t('superadmin:entity_builder:errors:name_required'));

        savingRef.current = true;
        setSaving(true);
        try {
            const res = await api.brain.post('entity/save', editingEntity);
            if (res.success) {
                toast.success(t('superadmin:entity_builder:save_success', { name: editingEntity.name }));
                setEditingEntity(null);
                await refreshConfig(true);
            } else {
                toast.error(getErrorMessage(res.error, t('common:error_saving')));
            }
        } catch (e: any) {
            toast.error(getErrorMessage(e, t('common:error_saving')));
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('superadmin:entity_builder:confirm_delete'))) return;
        
        try {
            const res = await api.brain.post('entity/delete', { id });
            if (res.success) {
                toast.success(t('common:delete_success'));
                await refreshConfig(true);
            }
        } catch (e: any) {
            toast.error(t('common:error'));
        }
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
            }
        });
    };

    const filteredEntities = entityData.filter(entity =>
        entity.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entity.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entity.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
                        <Box className="text-primary" />
                        {t('superadmin:entity_builder:title')}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{t('superadmin:entity_builder:subtitle')} {entityData.length} {t('common:records', { count: entityData.length })}.</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline"
                        onClick={() => setIsAiModalOpen(true)}
                        className="rounded-xl font-black uppercase italic text-xs px-6 border-primary/20 text-primary hover:bg-primary/5"
                    >
                        <Zap className="mr-2 h-4 w-4" />
                        AI Architect
                    </Button>
                    <Button 
                        onClick={startNew}
                        className="rounded-xl font-black uppercase italic text-xs px-6"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        {t('superadmin:entity_builder:new_entity')}
                    </Button>
                </div>
            </div>

            {/* AI Architect Dialog */}
            <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
                <DialogContent className="sm:max-w-xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                    <div className="p-8 space-y-6">
                        <DialogHeader>
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4">
                                <Zap size={24} />
                            </div>
                            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">{t('superadmin:entity_builder:ai_title')}</DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium">
                                {t('superadmin:entity_builder:ai_prompt_desc')}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <Textarea 
                                placeholder={t('superadmin:entity_builder:ai_placeholder')}
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                className="min-h-[150px] rounded-2xl border-slate-200 focus:ring-primary/20 p-4 font-medium"
                            />
                            
                            <div className="bg-slate-50 rounded-2xl p-4 flex gap-3">
                                <div className="p-2 bg-white rounded-xl shadow-sm h-fit">
                                    <Code size={16} className="text-slate-400" />
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                    <span className="font-bold text-slate-700 block mb-1">PRO TIP</span>
                                    AI-ul va genera automat relațiile (Foreign Keys) dacă menționezi alte entități existente (ex: "legat de contacte").
                                </p>
                            </div>
                        </div>

                        <DialogFooter className="flex gap-3 sm:justify-end">
                            <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setIsAiModalOpen(false)}>
                                {t('superadmin:entity_builder:cancel')}
                            </Button>
                            <Button 
                                className="rounded-xl font-black uppercase italic px-8 h-12"
                                disabled={!aiPrompt || isArchitectRunning}
                                onClick={handleArchitect}
                            >
                                {isArchitectRunning ? (
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Zap className="mr-2 h-4 w-4" />
                                )}
                                {isArchitectRunning ? "..." : t('superadmin:entity_builder:generate')}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {editingEntity ? (
                <GlassCard className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                <Box size={24} />
                            </div>
                            <div>
                                <h4 className="text-lg font-black uppercase italic tracking-tight">
                                    {editingEntity.id ? t('superadmin:entity_builder:edit_entity', { name: editingEntity.name }) : t('superadmin:entity_builder:create_new')}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                                    {t('superadmin:entity_builder:complete_config')}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="ghost" className="rounded-xl font-bold text-xs" onClick={() => setEditingEntity(null)}>{t('superadmin:entity_builder:cancel')}</Button>
                            <Button 
                                className="rounded-xl font-black uppercase italic text-xs px-8" 
                                disabled={saving}
                                onClick={handleSave}
                            >
                                {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {t('superadmin:entity_builder:save_entity')}
                            </Button>
                        </div>
                    </div>

                    <Tabs defaultValue="basic" className="w-full">
                        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-5 bg-slate-100/50 p-2 rounded-2xl">
                            <TabsTrigger value="basic" className="text-[10px] font-bold uppercase">{t('superadmin:entity_builder:tabs:basic')}</TabsTrigger>
                            <TabsTrigger value="fields" className="text-[10px] font-bold uppercase">{t('superadmin:entity_builder:tabs:fields')}</TabsTrigger>
                            <TabsTrigger value="display" className="text-[10px] font-bold uppercase flex items-center gap-1"><Eye size={12} />{t('superadmin:entity_builder:tabs:display')}</TabsTrigger>
                            <TabsTrigger value="menu" className="text-[10px] font-bold uppercase flex items-center gap-1"><Menu size={12} />{t('superadmin:entity_builder:tabs:menu')}</TabsTrigger>
                            <TabsTrigger value="dashboard" className="text-[10px] font-bold uppercase flex items-center gap-1"><LayoutDashboard size={12} />{t('superadmin:entity_builder:tabs:dashboard')}</TabsTrigger>
                        </TabsList>

                        {/* BASIC TAB */}
                        <TabsContent value="basic" className="space-y-6 mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Basic Info */}
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">{t('superadmin:entity_builder:system_name')}</Label>
                                        <Input 
                                            placeholder="e.g. products" 
                                            value={editingEntity.name}
                                            onChange={(e) => setEditingEntity({ ...editingEntity, name: e.target.value })}
                                            className="h-12 rounded-2xl border-slate-200 font-bold focus:ring-primary/20"
                                        />
                                        <p className="text-[8px] text-slate-400 italic">{t('superadmin:entity_builder:tooltips:system_name')}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">{t('superadmin:entity_builder:display_label')}</Label>
                                        <Input 
                                            placeholder="e.g. Inventory Products" 
                                            value={editingEntity.label}
                                            onChange={(e) => setEditingEntity({ ...editingEntity, label: e.target.value })}
                                            className="h-12 rounded-2xl border-slate-200 font-medium focus:ring-primary/20"
                                        />
                                        <p className="text-[8px] text-slate-400 italic">{t('superadmin:entity_builder:tooltips:display_label')}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">{t('superadmin:entity_builder:db_table')}</Label>
                                        <Input 
                                            placeholder="Optional: will default to identifier" 
                                            value={editingEntity.tableName}
                                            onChange={(e) => setEditingEntity({ ...editingEntity, tableName: e.target.value })}
                                            className="h-10 rounded-xl border-slate-200 font-mono text-xs focus:ring-primary/20"
                                        />
                                        <p className="text-[8px] text-slate-400 italic">{t('superadmin:entity_builder:tooltips:db_table')}</p>
                                    </div>
                                </div>

                                {/* Description & Icon */}
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">{t('superadmin:entity_builder:description')}</Label>
                                        <textarea 
                                            placeholder="Describe what this entity represents..." 
                                            value={editingEntity.description}
                                            onChange={(e) => setEditingEntity({ ...editingEntity, description: e.target.value })}
                                            className="w-full h-32 rounded-2xl border border-slate-200 p-4 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">{t('superadmin:entity_builder:icon')}</Label>
                                        <IconPicker 
                                            value={editingEntity.icon}
                                            onChange={(val) => setEditingEntity({ ...editingEntity, icon: val })}
                                            placeholder="Choose an icon..."
                                        />
                                        <p className="text-[8px] text-slate-400 italic">{t('superadmin:entity_builder:tooltips:icon')}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">{t('superadmin:entity_builder:color_theme')}</Label>
                                        <select 
                                            value={editingEntity.colorTheme || 'blue'}
                                            onChange={(e) => setEditingEntity({ ...editingEntity, colorTheme: e.target.value })}
                                            className="h-10 rounded-xl border border-slate-200 text-xs font-bold bg-white px-3 focus:ring-2 focus:ring-primary/20"
                                        >
                                            <option value="blue">{t('superadmin:entity_builder:colors:blue')}</option>
                                            <option value="green">{t('superadmin:entity_builder:colors:green')}</option>
                                            <option value="purple">{t('superadmin:entity_builder:colors:purple')}</option>
                                            <option value="red">{t('superadmin:entity_builder:colors:red')}</option>
                                            <option value="amber">{t('superadmin:entity_builder:colors:amber')}</option>
                                            <option value="slate">{t('superadmin:entity_builder:colors:slate')}</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* FIELDS TAB */}
                        <TabsContent value="fields" className="space-y-6 mt-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[11px] font-black uppercase italic tracking-widest text-slate-900 flex items-center gap-2">
                                        <Columns className="h-4 w-4" />
                                        {t('superadmin:entity_builder:field_architecture')}
                                    </Label>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 rounded-xl font-black uppercase italic text-[9px] border-primary/20 text-primary"
                                        onClick={() => {
                                            const fields = [...(editingEntity.fields || [])];
                                            fields.push({ name: '', label: '', type: 'text', required: false, width: '1/2' });
                                            setEditingEntity({ ...editingEntity, fields });
                                        }}
                                    >
                                        <Plus className="mr-1 h-3 w-3" /> {t('superadmin:entity_builder:add_field')}
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {(editingEntity.fields || []).map((field: any, idx: number) => (
                                        <div key={idx} className="p-4 rounded-3xl bg-slate-50 border border-slate-200/50 space-y-3 relative group transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/50">
                                            <div className="flex flex-col md:flex-row gap-3 items-center">
                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                                                    <Input 
                                                        placeholder="ID (e.g. email)" 
                                                        value={field.name}
                                                        onChange={(e) => {
                                                            const fields = [...editingEntity.fields];
                                                            fields[idx].name = e.target.value.toLowerCase().replace(/\s+/g, '_');
                                                            setEditingEntity({ ...editingEntity, fields });
                                                        }}
                                                        className="h-9 rounded-xl border-slate-200 text-[10px] font-mono uppercase"
                                                    />
                                                    <Input 
                                                        placeholder="Label (e.g. Email Address)" 
                                                        value={field.label}
                                                        onChange={(e) => {
                                                            const fields = [...editingEntity.fields];
                                                            fields[idx].label = e.target.value;
                                                            setEditingEntity({ ...editingEntity, fields });
                                                        }}
                                                        className="h-9 rounded-xl border-slate-200 text-xs font-bold"
                                                    />
                                                    <select 
                                                        value={field.type || 'text'}
                                                        onChange={(e) => {
                                                            const fields = [...editingEntity.fields];
                                                            fields[idx].type = e.target.value;
                                                            setEditingEntity({ ...editingEntity, fields });
                                                        }}
                                                        className="h-9 rounded-xl border-slate-200 text-[10px] font-black uppercase italic bg-white px-3"
                                                    >
                                                        <option value="text">{t('superadmin:entity_builder:field_types:text')}</option>
                                                        <option value="textarea">{t('superadmin:entity_builder:field_types:textarea')}</option>
                                                        <option value="number">{t('superadmin:entity_builder:field_types:number')}</option>
                                                        <option value="date">{t('superadmin:entity_builder:field_types:date')}</option>
                                                        <option value="datetime">{t('superadmin:entity_builder:field_types:datetime')}</option>
                                                        <option value="boolean">{t('superadmin:entity_builder:field_types:boolean')}</option>
                                                        <option value="select">{t('superadmin:entity_builder:field_types:select')}</option>
                                                        <option value="relation">{t('superadmin:entity_builder:field_types:relation')}</option>
                                                        <option value="image">{t('superadmin:entity_builder:field_types:image')}</option>
                                                        <option value="file">{t('superadmin:entity_builder:field_types:file')}</option>
                                                    </select>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <select 
                                                        value={field.width || '1/2'}
                                                        onChange={(e) => {
                                                            const fields = [...editingEntity.fields];
                                                            fields[idx].width = e.target.value;
                                                            setEditingEntity({ ...editingEntity, fields });
                                                        }}
                                                        className="h-9 rounded-xl border-slate-200 text-[9px] font-bold bg-white px-2"
                                                    >
                                                        <option value="1/1">{t('superadmin:entity_builder:layout:full')}</option>
                                                        <option value="1/2">{t('superadmin:entity_builder:layout:half')}</option>
                                                        <option value="1/4">{t('superadmin:entity_builder:layout:quarter')}</option>
                                                    </select>

                                                    <label className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-xl cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={field.required}
                                                            onChange={(e) => {
                                                                const fields = [...editingEntity.fields];
                                                                fields[idx].required = e.target.checked;
                                                                setEditingEntity({ ...editingEntity, fields });
                                                            }}
                                                            className="w-3.5 h-3.5 rounded"
                                                        />
                                                        <span className="text-[8px] font-black uppercase text-slate-400">{t('common:required_short')}</span>
                                                    </label>

                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                                        onClick={() => {
                                                            const fields = editingEntity.fields.filter((_: any, i: number) => i !== idx);
                                                            setEditingEntity({ ...editingEntity, fields });
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {(!editingEntity.fields || editingEntity.fields.length === 0) && (
                                    <div className="py-12 border-2 border-dashed border-slate-200 rounded-3xl text-center">
                                        <p className="text-[10px] font-black uppercase italic text-slate-400">{t('superadmin:entity_builder:no_fields')}</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* DISPLAY TAB */}
                        <TabsContent value="display" className="space-y-6 mt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-5">
                                    <div>
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 mb-3">{t('superadmin:entity_builder:settings:list_view')}</Label>
                                        <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600 flex items-center gap-2">
                                                    <EyeOff size={12} />
                                                    {t('superadmin:entity_builder:settings:default_columns')}
                                                </label>
                                                <div className="space-y-1">
                                                    {(editingEntity.fields || []).slice(0, 5).map((field: any) => (
                                                        <label key={field.name} className="flex items-center gap-2 text-[9px]">
                                                            <input 
                                                                type="checkbox" 
                                                                defaultChecked={true}
                                                                className="w-3 h-3 rounded"
                                                            />
                                                            <span className="font-bold text-slate-600">{field.label || field.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:items_per_page')}</label>
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
                                        <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 mb-3">{t('superadmin:entity_builder:settings:form_layout')}</Label>
                                        <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600 flex items-center gap-2">
                                                    <LayoutGrid size={12} />
                                                    {t('superadmin:entity_builder:settings:form_layout')}
                                                </label>
                                                <select 
                                                    defaultValue={editingEntity.uiConfig?.form?.columns || '2'}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, columns: e.target.value } };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                    className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold bg-white px-3"
                                                >
                                                    <option value="1">{t('superadmin:entity_builder:settings:form_columns', { count: 1 })}</option>
                                                    <option value="2">{t('superadmin:entity_builder:settings:form_columns_plural', { count: 2 })}</option>
                                                    <option value="3">{t('superadmin:entity_builder:settings:form_columns_plural', { count: 3 })}</option>
                                                    <option value="4">{t('superadmin:entity_builder:settings:form_columns_plural', { count: 4 })}</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:show_timestamps')}</label>
                                                <Switch 
                                                    defaultChecked={editingEntity.uiConfig?.form?.showTimestamps !== false}
                                                    onCheckedChange={(checked) => {
                                                        const config = { ...editingEntity.uiConfig, form: { ...editingEntity.uiConfig?.form, showTimestamps: checked } };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:show_actions')}</label>
                                                <Switch 
                                                    checked={editingEntity.uiConfig?.form?.showActions === true}
                                                    onCheckedChange={(checked) => {
                                                        const config = { 
                                                            ...editingEntity.uiConfig, 
                                                            form: { ...editingEntity.uiConfig?.form, showActions: checked },
                                                            list: { ...editingEntity.uiConfig?.list, showActions: checked } // Enterprise Level 10 Unified UI Sync
                                                        };
                                                        setEditingEntity({ ...editingEntity, uiConfig: config });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* MENU TAB */}
                        <TabsContent value="menu" className="space-y-6 mt-6">
                            <div className="space-y-5">
                                <div>
                                    <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                        <Menu size={14} />
                                        {t('superadmin:entity_builder:settings:navigation_menu')}
                                    </Label>
                                    <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:main_menu')}</label>
                                            <Switch 
                                                defaultChecked={editingEntity.menuConfig?.showInMenu !== false}
                                                onCheckedChange={(checked) => {
                                                    const config = { ...editingEntity.menuConfig, showInMenu: checked };
                                                    setEditingEntity({ ...editingEntity, menuConfig: config });
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:admin_menu')}</label>
                                            <Switch 
                                                defaultChecked={editingEntity.menuConfig?.showInAdminMenu}
                                                onCheckedChange={(checked) => {
                                                    const config = { ...editingEntity.menuConfig, showInAdminMenu: checked };
                                                    setEditingEntity({ ...editingEntity, menuConfig: config });
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-slate-600">{t('superadmin:entity_builder:settings:menu_icon')}</label>
                                            <IconPicker 
                                                value={editingEntity.menuConfig?.icon || ''}
                                                onChange={(val) => {
                                                    const config = { ...editingEntity.menuConfig, icon: val };
                                                    setEditingEntity({ ...editingEntity, menuConfig: config });
                                                }}
                                                placeholder="Alege o pictogramă pentru meniu..."
                                            />
                                            <p className="text-[8px] text-slate-400 italic">{t('superadmin:entity_builder:tooltips:menu_icon')}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:menu_priority_sort')}</label>
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
                                            <p className="text-[8px] text-slate-400 italic">{t('superadmin:entity_builder:tooltips:menu_priority')}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:menu_badge')}</label>
                                            <Input 
                                                placeholder="e.g. NEW, BETA, 5" 
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
                        </TabsContent>

                        {/* DASHBOARD TAB */}
                        <TabsContent value="dashboard" className="space-y-6 mt-6">
                            <div className="space-y-5">
                                <div>
                                    <Label className="text-[10px] font-black uppercase italic tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                                        <LayoutDashboard size={14} />
                                        {t('superadmin:entity_builder:settings:dashboard_widget')}
                                    </Label>
                                    <div className="space-y-3 p-4 bg-slate-50 rounded-2xl">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:dashboard_show')}</label>
                                            <Switch 
                                                defaultChecked={editingEntity.dashboardConfig?.enabled !== false}
                                                onCheckedChange={(checked) => {
                                                    const config = { ...editingEntity.dashboardConfig, enabled: checked };
                                                    setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                }}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:widget_type')}</label>
                                                <select 
                                                    defaultValue={editingEntity.dashboardConfig?.widgetType || 'stats'}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.dashboardConfig, widgetType: e.target.value };
                                                        setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                    }}
                                                    className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold bg-white px-3"
                                                >
                                                    <option value="stats">{t('superadmin:entity_builder:widget_types:stats')}</option>
                                                    <option value="list">{t('superadmin:entity_builder:widget_types:list')}</option>
                                                    <option value="chart">{t('superadmin:entity_builder:widget_types:chart')}</option>
                                                    <option value="table">{t('superadmin:entity_builder:widget_types:table')}</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:color_theme')}</label>
                                                <select 
                                                    defaultValue={editingEntity.colorTheme || 'indigo'}
                                                    onChange={(e) => {
                                                        setEditingEntity({ ...editingEntity, colorTheme: e.target.value });
                                                    }}
                                                    className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold bg-white px-3"
                                                >
                                                    <option value="indigo">Indigo (Primary)</option>
                                                    <option value="blue">{t('superadmin:entity_builder:colors:blue')}</option>
                                                    <option value="emerald">Emerald (Green)</option>
                                                    <option value="purple">{t('superadmin:entity_builder:colors:purple')}</option>
                                                    <option value="rose">Rose (Red)</option>
                                                    <option value="amber">{t('superadmin:entity_builder:colors:amber')}</option>
                                                    <option value="slate">{t('superadmin:entity_builder:colors:slate')}</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:items_to_show')}</label>
                                                <Input 
                                                    type="number" 
                                                    placeholder="5" 
                                                    defaultValue={editingEntity.dashboardConfig?.itemsToShow || 5}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.dashboardConfig, itemsToShow: Number(e.target.value) };
                                                        setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                    }}
                                                    className="h-9 rounded-lg text-xs font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:priority_weight')}</label>
                                                <Input 
                                                    type="number" 
                                                    placeholder="10" 
                                                    defaultValue={editingEntity.dashboardConfig?.priority || 10}
                                                    onChange={(e) => {
                                                        const config = { ...editingEntity.dashboardConfig, priority: Number(e.target.value) };
                                                        setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                    }}
                                                    className="h-9 rounded-lg text-xs font-bold"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:widget_width')}</label>
                                            <select 
                                                defaultValue={editingEntity.dashboardConfig?.width || '1/4'}
                                                onChange={(e) => {
                                                    const config = { ...editingEntity.dashboardConfig, width: e.target.value };
                                                    setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                }}
                                                className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold bg-white px-3"
                                            >
                                                <option value="1/4">{t('superadmin:entity_builder:layout:small')}</option>
                                                <option value="1/2">{t('superadmin:entity_builder:layout:medium')}</option>
                                                <option value="3/4">{t('superadmin:entity_builder:layout:large')}</option>
                                                <option value="full">{t('superadmin:entity_builder:layout:full_block')}</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase text-slate-600">{t('superadmin:entity_builder:settings:show_trends')}</label>
                                                <Switch 
                                                    defaultChecked={editingEntity.dashboardConfig?.showTrends !== false}
                                                    onCheckedChange={(checked) => {
                                                        const config = { ...editingEntity.dashboardConfig, showTrends: checked };
                                                        setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                    }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between col-span-2 border-t border-slate-100 pt-3 mt-1">
                                                <label className="text-[10px] font-black uppercase text-indigo-600">{t('superadmin:entity_builder:settings:enable_dashboard')}</label>
                                                <Switch 
                                                    defaultChecked={editingEntity.dashboardConfig?.enabled !== false}
                                                    onCheckedChange={(checked) => {
                                                        const config = { ...editingEntity.dashboardConfig, enabled: checked };
                                                        setEditingEntity({ ...editingEntity, dashboardConfig: config });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="pt-4">
                        <Label className="text-[11px] font-black uppercase italic tracking-widest text-slate-400 flex items-center gap-2 mb-3">
                            <Code className="h-3 w-3" />
                            {t('superadmin:entity_builder:settings:advanced_json')}
                        </Label>
                        <textarea 
                            value={JSON.stringify(editingEntity, null, 2)}
                            readOnly
                            className="w-full h-40 rounded-2xl border border-slate-100 p-4 font-mono text-[8px] bg-slate-50/50 text-slate-400 resize-none outline-none overflow-auto"
                        />
                    </div>
                </GlassCard>
            ) : (
                <div className="space-y-4">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search entities by name or description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-11 rounded-2xl border-slate-200 font-medium focus:ring-primary/20"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Entities Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loading ? (
                            [1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse" />)
                        ) : filteredEntities.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                                <Box className="h-12 w-12 text-slate-200 mb-4" />
                                <p className="text-sm font-bold text-slate-500">
                                    {searchQuery ? 'No entities match your search' : 'No entities found'}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {searchQuery ? 'Try a different search term' : 'Create your first entity to get started'}
                                </p>
                            </div>
                        ) : (
                            filteredEntities.map(entity => (
                                <GlassCard key={entity.id} className="p-6 hover:shadow-xl hover:shadow-primary/5 transition-all group border-b-4 border-b-transparent hover:border-b-primary">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-3 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
                                            <Box size={20} />
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditingEntity(entity)}>
                                                <Edit2 size={14} className="text-slate-400 hover:text-slate-900" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleDelete(entity.id)}>
                                                <Trash2 size={14} className="text-red-400 hover:text-red-600" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1 mb-4">
                                        <h5 className="font-black uppercase italic tracking-tight text-slate-900 leading-none">{entity.label}</h5>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entity.name}</p>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-4 h-8 italic">
                                        {entity.description || 'No description provided.'}
                                    </p>
                                    <div className="flex items-center gap-2 pt-4 border-t border-slate-100/50">
                                        <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[8px] font-black uppercase tracking-tighter bg-slate-50">
                                            {entity.fields?.length || 0} FIELDS
                                        </Badge>
                                        {entity.tableName && <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[8px] font-black uppercase tracking-tighter bg-blue-50 text-blue-600 border-blue-100">
                                            DB: {entity.tableName}
                                        </Badge>}
                                        {entity.__is_baseline && <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[8px] font-black uppercase tracking-tighter bg-amber-50 text-amber-600 border-amber-100">
                                            SYSTEM
                                        </Badge>}
                                    </div>
                                </GlassCard>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
