import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams, useSubmit, useParams } from 'react-router';
import { Plus, Search, Trash2, ArrowUpDown, Layers, ChevronRight, Table as TableIcon, LayoutGrid, Edit2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { GlassCard } from '~/components/ui/GlassCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Checkbox } from "~/components/ui/checkbox";
import { cn, renderString, getThemeClasses } from '~/lib/core';
import { normalizeEntity } from '~/lib/entity-engine';
import { useTranslation } from 'react-i18next';
import { IconMap } from '~/lib/icons';
import { useConfig } from '~/hooks/useConfig';
import { useEntity } from '~/hooks/useEntity';
import { DataManagementActions } from '../DataOps';

interface DynamicEntityListProps {
    entityId: string;
    config: any;
    initialData?: any[];
}

export function DynamicEntityList({ entityId, config: initialConfig, initialData }: DynamicEntityListProps) {
    const { lang } = useParams();
    const { t } = useTranslation(['common', 'entity']);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const systemConfig = useConfig();
    const submit = useSubmit();
    const [showArchived, setShowArchived] = useState(false);
    const config = initialConfig || (systemConfig?.entity as any)?.[entityId] || {};
    
    // Core Entity Hook (Enterprise Level 8)
    const { 
        data: realData, 
        loading, 
        selectedIds, 
        toggleSelection, 
        selectAll, 
        clearSelection,
        refresh: fetchData,
        remove: handleDelete,
        bulkDelete: handleBulkDelete,
        bulkArchive: handleBulkArchive,
        importWithAI,
        importData,
        exportData
    } = useEntity(entityId, { 
        includeArchived: showArchived,
        skipFetch: !!config.mockup || !!initialData,
        sortBy: searchParams.get('sortBy') || undefined,
        sortOrder: (searchParams.get('sortOrder')?.toUpperCase() as any) || undefined
    });

    const handleSort = (field: string) => {
        const currentSort = searchParams.get('sortBy');
        const currentOrder = searchParams.get('sortOrder') || 'ASC';
        
        const nextOrder = currentSort === field && currentOrder === 'ASC' ? 'DESC' : 'ASC';
        
        setSearchParams(prev => {
            prev.set('sortBy', field);
            prev.set('sortOrder', nextOrder);
            return prev;
        });
    };

    const data = Array.isArray(config.mockup ? (config.data || []) : (initialData || realData || [])) 
        ? (config.mockup ? (config.data || []) : (initialData || realData || []))
        : [];

    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    // Normalize fields & Apply Security Visibility (Enterprise Level 8)
    const fieldsList = React.useMemo(() => {
        const normalized = normalizeEntity(config);
        const AUDIT_FIELDS = ['workspaceId', 'createdBy', 'updatedBy', 'archived', 'archivedAt', 'deletedAt', 'password', 'secret'];
        
        const rawFields = normalized.fields;

        // Filter out audit/protected fields by default in listings
        const filtered = rawFields.filter((f: any) => {
            const isAudit = AUDIT_FIELDS.includes(f.name);
            if (isAudit) return (normalized.uiConfig?.list as any)?.showAuditFields === true;
            return f.hidden !== true && f.hideInTable !== true;
        });

        // Respect columns selection if defined in Builder
        const selectedCols = normalized.uiConfig?.list?.columns;
        if (Array.isArray(selectedCols) && selectedCols.length > 0) {
            return selectedCols
                .map(colName => filtered.find(f => (f.name === colName || f.key === colName)))
                .filter(Boolean);
        }

        return filtered;
    }, [config]);

    const EntityIcon = IconMap[config.icon] || Layers;
    const features = config.features || {};

    const filteredData = useMemo(() => {
        if (!search) return data;
        const searchStr = search.toLowerCase();
        
        // Use defined searchFields or fall back to all searchable fields
        const searchFields = config.searchFields || fieldsList.filter((f: any) => f.searchable).map((f: any) => f.key || f.name);
        
        if (searchFields.length > 0) {
            return data.filter((item: any) => 
                searchFields.some((field: string) => String(item[field] || '').toLowerCase().includes(searchStr))
            );
        }
        
        return data.filter((item: any) => 
            Object.values(item).some(val => 
                String(val).toLowerCase().includes(searchStr)
            )
        );
    }, [data, search, config.searchFields, fieldsList]);

    const getPrimaryField = () => {
        return fieldsList.find((f: any) => f.primary || f.primaryKey) || fieldsList[0] || { name: 'id' };
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.size === filteredData.length && filteredData.length > 0) clearSelection();
        else selectAll(filteredData.map((i: any) => i.id));
    };

    const handleToggleSelectOne = (id: any, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        toggleSelection(id);
    };

    const formatValue = (val: any, field: any) => {
        if (val === undefined || val === null || val === '') return '-';
        
        switch (field.type) {
            case 'currency': return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR' }).format(val);
            case 'percent': return `${val}%`;
            case 'date': return new Date(val).toLocaleDateString();
            case 'datetime': return new Date(val).toLocaleString();
            case 'boolean':
            case 'toggle': return val 
                ? <Badge className="bg-emerald-500 text-white border-none py-0 h-4 text-[8px]">{renderString(t('common:yes') || 'DA', lang)}</Badge> 
                : <Badge variant="outline" className="text-slate-300 py-0 h-4 text-[8px]">{renderString(t('common:no') || 'NU', lang)}</Badge>;
            default: return String(val);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Header section - Integrated Search (Enterprise Level 8) */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div className="flex-1 flex items-center gap-4">
                    {/* Compact Brand Icon */}
                    <div className={cn(
                        "p-3 rounded-2xl text-white shadow-xl transition-all duration-300 hidden md:flex",
                        getThemeClasses(config.colorTheme || config.color || 'indigo').bg
                    )}>
                        <EntityIcon size={24} />
                    </div>

                    {/* Integrated Search Console */}
                    <div className="relative flex-1 max-w-3xl">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <Input
                            placeholder={`${renderString(t('common:search_placeholder') || 'Caută...', lang)} ${renderString(config.labelPlural || config.label || entityId, lang)}...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-14 pr-32 h-16 bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-800 shadow-sm rounded-[24px] font-bold text-lg text-slate-700 dark:text-slate-300 focus-visible:ring-indigo-500/30"
                        />
                        {/* Statistics Badge */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                             <Badge className="bg-slate-100 dark:bg-slate-900 text-slate-500 border-none px-4 py-1.5 rounded-xl font-black italic uppercase tracking-[0.1em] text-[10px]">
                                {data.length} {renderString(t('common:records') || 'Înregistrări', lang)}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 self-end xl:self-auto">
                    <div className="bg-slate-100/50 dark:bg-slate-900/50 p-1.5 rounded-2xl flex items-center border border-slate-200/60 dark:border-slate-800/60">
                        <Button
                            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                            size="icon"
                            className={cn(
                                "h-10 w-10 rounded-xl transition-all",
                                viewMode === 'table' && "bg-white dark:bg-slate-800 shadow-sm"
                            )}
                            onClick={() => setViewMode('table')}
                        >
                            <TableIcon size={18} />
                        </Button>
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="icon"
                            className={cn(
                                "h-10 w-10 rounded-xl transition-all",
                                viewMode === 'grid' && "bg-white dark:bg-slate-800 shadow-sm"
                            )}
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid size={18} />
                        </Button>
                    </div>

                    {features.creatable !== false && (
                        <Button
                            onClick={() => navigate(`new`)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black italic uppercase tracking-widest text-[11px] h-14 px-8 rounded-2xl shadow-xl shadow-indigo-100/50 dark:shadow-none transition-all hover:scale-105 active:scale-95"
                        >
                            <Plus className="mr-2 h-5 w-5 stroke-[3]" />
                            {renderString(t('common:new') || 'Nou', lang)} {renderString(config.label || entityId, lang)}
                        </Button>
                    )}
                </div>
            </div>

            {/* Entity Actions & Management (Enterprise Level 8) */}
            <DataManagementActions
                entityType={entityId}
                selectedCount={selectedIds.size}
                showArchived={showArchived}
                onToggleShowArchived={setShowArchived}
                onBulkArchive={() => handleBulkArchive(Array.from(selectedIds))}
                onBulkDelete={() => handleBulkDelete(Array.from(selectedIds))}
                onImport={importData}
                onImportAI={importWithAI}
                onExport={exportData}
            />

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1,2,3,4,5,6].map(i => (
                        <div key={i} className="h-48 bg-slate-100 dark:bg-slate-900 rounded-3xl animate-pulse" />
                    ))}
                </div>
            ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 mb-4">
                        <Layers size={32} />
                    </div>
                    <h3 className="text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">{renderString(t('common:empty_dataset'), lang)}</h3>
                    <p className="text-slate-500 font-medium text-sm mt-1">{renderString(t('common:no_records_matching', { label: renderString(config.labelPlural || entityId, lang) }), lang)}</p>
                    
                    {features.creatable !== false && (
                        <Button 
                            variant="link" 
                            className="mt-4 text-indigo-600 font-black uppercase italic tracking-widest text-[10px]"
                            onClick={() => navigate(`new`)}
                        >
                            {renderString(t('common:create_first'), lang)} <ChevronRight size={14} className="ml-1" />
                        </Button>
                    )}
                </div>
            ) : viewMode === 'table' ? (
                <div className="bg-white dark:bg-slate-950 rounded-[32px] border border-slate-100 dark:border-slate-900 overflow-hidden shadow-xl shadow-slate-200/20 dark:shadow-none">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                    <TableHead className="w-[50px] px-6">
                                        <Checkbox 
                                            checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                                            onCheckedChange={handleToggleSelectAll}
                                            className="rounded-md border-slate-300"
                                        />
                                    </TableHead>
                                    {fieldsList.map((f: any) => (
                                        <TableHead 
                                            key={f.key || f.name} 
                                            className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer hover:text-indigo-500 transition-colors"
                                            onClick={() => handleSort(f.key || f.name)}
                                        >
                                            <div className="flex items-center gap-2">
                                                {renderString(f.label || f.name || f.key, lang)}
                                                <ArrowUpDown size={12} className={cn(
                                                    "transition-opacity",
                                                    searchParams.get('sortBy') === (f.key || f.name) ? "opacity-100 text-indigo-500" : "opacity-30"
                                                )} />
                                            </div>
                                        </TableHead>
                                    ))}
                                    <TableHead className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                        {renderString(t('common:actions') || 'Acțiuni', lang)}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.map((item: any, idx: number) => (
                                    <TableRow 
                                        key={item.id || `row-${idx}`} 
                                        className={cn(
                                            "group transition-all duration-200 border-slate-50 dark:border-slate-900/50",
                                            selectedIds.has(item.id) ? "bg-indigo-50/10 dark:bg-indigo-500/10" : "hover:bg-slate-50/80 dark:hover:bg-slate-900/30"
                                        )}
                                    >
                                        <TableCell className="px-6 py-4">
                                            <Checkbox 
                                                checked={selectedIds.has(item.id)}
                                                onCheckedChange={() => handleToggleSelectOne(item.id)}
                                                className="rounded-md border-slate-300 data-[state=checked]:bg-indigo-600"
                                            />
                                        </TableCell>
                                        {fieldsList.map((f: any) => (
                                            <TableCell key={f.key || f.name} className="px-6 py-4 cursor-pointer" onClick={() => navigate(String(item.id))}>
                                                {formatValue(item[f.name || f.key], f)}
                                            </TableCell>
                                        ))}
                                        <TableCell className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800"
                                                    onClick={(e) => { e.stopPropagation(); navigate(String(item.id)); }}
                                                >
                                                    {features.editable !== false ? <Edit2 size={14} className="text-slate-600 dark:text-slate-400" /> : <Layers size={14} className="text-slate-400" />}
                                                </Button>
                                                {features.deletable !== false && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if(confirm(renderString(t('common:confirm_delete') || 'Ești sigur că vrei să ștergi?', lang))) {
                                                                submit({ id: item.id }, { method: "delete" });
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredData.map((item: any, idx: number) => (
                        <GlassCard 
                            key={item.id || `grid-${idx}`} 
                            className={cn(
                                "group hover:ring-2 hover:ring-indigo-500/20 transition-all cursor-pointer overflow-hidden flex flex-col pt-0",
                                selectedIds.has(item.id) && "ring-2 ring-indigo-500 bg-indigo-50/5 dark:bg-indigo-500/5"
                            )}
                            onClick={() => navigate(String(item.id))}
                        >
                            <div className={cn("h-1.5 w-full bg-indigo-500/10", selectedIds.has(item.id) && "bg-indigo-500")} />
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <Checkbox 
                                            checked={selectedIds.has(item.id)}
                                            onCheckedChange={() => handleToggleSelectOne(item.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="rounded-md border-slate-300 shadow-none border-2"
                                        />
                                        <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                                            <EntityIcon size={20} />
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter">
                                        ID: {String(item.id).slice(-4)}
                                    </Badge>
                                </div>
                                
                                <div>
                                    <h4 className="text-sm font-black italic uppercase tracking-tighter text-slate-900 dark:text-white line-clamp-1">
                                        {renderString(item[getPrimaryField().name] || t('common:untitled_record'), lang)}
                                    </h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                        {renderString(t('common:created'), lang)}: {new Date(item.createdAt || Date.now()).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-1.5 pt-2">
                                    {fieldsList.filter((f: any) => !f.primary).slice(0, 3).map((f: any, fIdx: number) => (
                                        <div key={f.key || f.name || `f-${fIdx}`} className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-400 font-bold uppercase tracking-widest">{renderString(f.label || f.name, lang)}:</span>
                                            <span className="text-slate-600 dark:text-slate-400 font-black truncate max-w-[120px]">
                                                {formatValue(item[f.name], f)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    );
}

