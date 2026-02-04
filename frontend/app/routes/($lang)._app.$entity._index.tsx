import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useConfig } from '~/hooks/useConfig';
import { useEntity } from '~/hooks/useEntity';
import { useAuth } from '~/hooks/useAuth';
import { DynamicTable, DynamicForm } from '~/components/EntitySystem';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Plus, Search, Filter, Download, ChevronRight, Database, ArrowRight, PlusCircle, Archive, Trash2, FileSpreadsheet, Layers } from 'lucide-react';
import { IconMap } from '~/lib/icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { DataManagementActions } from '~/components/DataOps';
import { ConfirmDestructiveAction, SimpleConfirmAction } from '~/components/AppModals';
import { cn, renderString } from '~/lib/core';
import { useSmartBack } from '~/hooks/useSmartBack';
import type { Route } from "../../.react-router/types/app/routes/+types/($lang)._app.$entity._index";

export async function loader({ params }: Route.LoaderArgs) {
  return {
    entityId: params.entity,
    lang: params.lang
  };
}

export async function action() {
  return new Response("OK", { status: 200 });
}

export default function EntityPage() {
  const { entity: id, lang } = useParams<{ entity: string; lang: string }>();
  const { t } = useTranslation(['common', 'entity']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { entity: configMap, loading: configLoading } = useConfig();
  const { hasPermission } = useAuth();
  
  // Enterprise Level 8: Case-Insensitive Lookup
  const entityType = (id || '').toLowerCase();
  
  // Find config by matching name case-insensitively
  const configKey = Object.keys(configMap).find(k => k.toLowerCase() === entityType);
  const config = configKey ? configMap[configKey] : undefined;
  
  const goBack = useSmartBack();
  
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);
  
  // Determinăm câmpul principal de căutare (name sau title)
  const searchField = config?.fields?.name ? 'name' : (config?.fields?.title ? 'title' : 'id');

  const entity = useEntity(entityType, { 
    includeArchived: showArchived,
    filters: searchTerm ? { [`${searchField}[like]`]: searchTerm } : {}
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<any>(null);
  const [archivingItem, setArchivingItem] = useState<any>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsCreateOpen(true);
      // Delay cleaning search params to ensure Dialog has started mounting
      const timer = setTimeout(() => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('action');
        setSearchParams(newParams, { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  const canCreate = hasPermission(`${entityType}:create`) || hasPermission(`${entityType}:*`) || hasPermission('workspace:manage');
  const canUpdate = hasPermission(`${entityType}:update`) || hasPermission(`${entityType}:*`) || hasPermission('workspace:manage');
  const canDelete = hasPermission(`${entityType}:delete`) || hasPermission(`${entityType}:*`) || hasPermission('workspace:manage');

  const handleRowClick = (item: any) => {
    // Navigăm către detaliile înregistrării folosind ruta unificată
    navigate(`/${lang}/${entityType}/${item.id}`);
  };

  if (configLoading) {
    // Non-blocking placeholder: render the page skeleton while config loads
    // This avoids blocking the whole UI when the backend DB is busy.
    return (
      <div className="space-y-4 animate-in fade-in duration-300 p-4">
        <div className="h-8 bg-slate-100 rounded-md w-1/3 animate-pulse" />
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="h-6 bg-slate-100 rounded-md w-full animate-pulse mb-4" />
          <div className="h-40 bg-slate-50 rounded-md animate-pulse" />
          <p className="text-sm text-slate-500 mt-3">{t('common:syncing_structure')}</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-rose-50 dark:bg-rose-950/20 rounded-3xl border border-rose-100 dark:border-rose-900/50">
        <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/40 rounded-full flex items-center justify-center text-rose-600 mb-6">
            <Database size={40} />
        </div>
        <h1 className="text-2xl font-black text-rose-900 dark:text-rose-100 mb-2">{t('entity:unknown_entity')}</h1>
        <p className="text-rose-600/70 max-w-md text-center" dangerouslySetInnerHTML={{ __html: t('entity:unknown_entity_desc', { id }) }} />
        <Button variant="outline" className="mt-8 border-rose-200 text-rose-700" onClick={() => goBack()}>
          {t('common:back_to_dashboard')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-700 p-2 md:p-4">
      {/* Dynamic Header - More compact as requested */}
      <div className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-4">
            <div className="space-y-0.5">
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase italic leading-tight">
                    {renderString(t(`entities:${entityType}.labelPlural`, renderString(config.labelPlural || entityType, lang)), lang)}
                </h1>
            </div>

            <div className="hidden sm:flex items-baseline gap-1">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{entity.data.length}</span>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{t('entity:records_count')}</span>
            </div>
        </div>

        <div className="flex items-center gap-2">
            {canCreate && (
                <Button 
                    onClick={() => navigate('new')}
                    className="h-7 px-3 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-lg gap-2 shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95 text-[9px] uppercase"
                >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t('entity:add_entity', { label: t(`entities:${entityType}.label`, renderString(config.label || entityType, lang)) })}</span>
                </Button>
            )}
        </div>
      </div>

      {/* Main Table Container with Unified Actions Header */}
      <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] shadow-xl shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden relative">
        <div className="p-1 px-2 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between min-h-[52px] gap-2">
            {/* Left Side: Selection & Bulk Actions */}
            <div className="flex items-center gap-2 pl-2">
                <DataManagementActions 
                    entityType={entityType}
                    selectedCount={entity.selectedIds.size}
                    showArchived={showArchived}
                    onToggleShowArchived={setShowArchived}
                    onBulkArchive={() => entity.bulkArchive(Array.from(entity.selectedIds))}
                    onBulkDelete={() => entity.bulkDelete(Array.from(entity.selectedIds))}
                    onImport={entity.importData}
                    onImportAI={entity.importWithAI}
                    onExport={entity.exportData}
                    variant="compact"
                />
            </div>
            
            {/* Right Side: Global Tools (Search, Filters, Data Ops) */}
            <div className="flex items-center gap-1.5 p-1 ml-auto">
                <div className="flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20">
                    <div className={cn(
                        "flex items-center transition-all duration-300 overflow-hidden",
                        isFiltersVisible ? "w-32 md:w-64 px-2" : "w-0 px-0"
                    )}>
                        <Input 
                            placeholder={t('entity:table.search_placeholder', { label: '' }).replace('...', '')} 
                            className="h-7 border-none bg-transparent text-xs focus-visible:ring-0 shadow-none px-0"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn(
                            "h-7 px-2.5 rounded-lg transition-all text-[10px] font-black uppercase tracking-tighter gap-1.5",
                            isFiltersVisible ? "text-indigo-600 bg-indigo-50" : "text-slate-500"
                        )}
                        onClick={() => {
                            setIsFiltersVisible(!isFiltersVisible);
                            if (isFiltersVisible) setSearchTerm('');
                        }}
                    >
                        <Search className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{t('entity:filters')}</span>
                    </Button>
                </div>
            </div>
        </div>

        <DynamicTable 
          entityType={entityType}
          data={entity.data}
          loading={entity.loading}
          selectedIds={entity.selectedIds}
          onToggleSelection={entity.toggleSelection}
          onSelectAll={entity.selectAll}
          onClearSelection={entity.clearSelection}
          onRowClick={handleRowClick}
          onEdit={canUpdate ? (item) => setEditingItem(item) : undefined}
          onDelete={canDelete ? (item) => setDeletingItem(item) : undefined}
          onArchive={canUpdate ? (item) => setArchivingItem(item) : undefined}
          onRestore={canUpdate ? (item) => entity.restore(item.id) : undefined}
        />

        {entity.data.length === 0 && !entity.loading && (
            <div className="py-32 flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-slate-200 dark:text-slate-700 mb-6">
                    <Database size={48} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('entity:no_records')}</h3>
                <p className="text-slate-500 max-w-sm mb-8">
                    {t('entity:no_records_desc')}
                </p>
                {canCreate && (
                    <Button onClick={() => navigate('new')} className="rounded-2xl bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="mr-2 h-5 w-5" /> {t('entity:add_first_record')}
                    </Button>
                )}
            </div>
        )}
      </div>

      {/* Confirmation Modals */}
      <ConfirmDestructiveAction 
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title={t('entity:delete_title')}
        description={t('entity:delete_confirm', { name: deletingItem?.name || deletingItem?.id, label: renderString(config.label, lang) })}
        confirmationWord={t('entity:confirmation_delete')}
        onConfirm={async () => {
          if (deletingItem) {
            await entity.remove(deletingItem.id);
            setDeletingItem(null);
          }
        }}
      />

      <SimpleConfirmAction 
        open={!!archivingItem}
        onOpenChange={(open) => !open && setArchivingItem(null)}
        title={t('entity:archive_title')}
        description={t('entity:archive_confirm', { name: archivingItem?.name || archivingItem?.id, label: renderString(config.label, lang) })}
        confirmText={t('common:archive')}
        cancelText={t('common:cancel')}
        isDangerous={false}
        onConfirm={async () => {
          if (archivingItem) {
            await entity.archive(archivingItem.id);
            setArchivingItem(null);
          }
        }}
      />

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent 
          className="sm:max-w-xl max-h-[92vh] rounded-[2.5rem] p-0 flex flex-col border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl"
        >
          <div className="p-10 overflow-y-auto custom-scrollbar">
            <DialogHeader className="mb-10 text-left">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-6">
                  <div 
                    className="w-16 h-16 rounded-[2rem] flex items-center justify-center text-white shadow-2xl relative group overflow-hidden"
                    style={{ 
                        backgroundColor: config?.colorTheme || config?.color || '#4f46e5',
                        boxShadow: `0 20px 25px -5px ${(config?.colorTheme || config?.color || '#4f46e5')}44` 
                    }}
                  >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      {(() => {
                        const Icon = IconMap[config?.icon || 'Package'] || Layers;
                        return <Icon size={32} className="relative z-10" />;
                      })()}
                  </div>
                  <div className="space-y-1">
                    <DialogTitle className="text-3xl font-black tracking-tighter italic uppercase text-slate-900 dark:text-white leading-none">
                        {t('entity:add_new_entity', { label: renderString(config?.label, lang) })}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 font-bold italic uppercase tracking-widest text-[10px] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      {t('entity:create_record_desc')}
                    </DialogDescription>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <Badge variant="outline" className="rounded-full border-slate-200 dark:border-slate-800 text-slate-400 font-black italic text-[9px] uppercase tracking-tighter px-3 py-1 bg-white dark:bg-slate-950">
                      Action: {t('common:create')}
                  </Badge>
                </div>
              </div>
            </DialogHeader>
            <DynamicForm 
              entityType={entityType} 
              loading={isSaving}
              isModal={true}
              onSubmit={async (values) => {
                if (isSaving) return;
                try {
                  setIsSaving(true);
                  await entity.create(values);
                  setIsCreateOpen(false);
                } catch (e) {
                  console.error('Failed to create entity:', e);
                } finally {
                  setIsSaving(false);
                }
              }} 
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent 
          className="sm:max-w-xl max-h-[92vh] rounded-[2.5rem] p-0 flex flex-col border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl"
        >
          <div className="p-10 overflow-y-auto custom-scrollbar">
            <DialogHeader className="mb-10 text-left">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-6">
                  <div 
                    className="w-16 h-16 rounded-[2rem] flex items-center justify-center text-white shadow-2xl relative group overflow-hidden"
                    style={{ 
                        backgroundColor: config?.colorTheme || config?.color || '#4f46e5',
                        boxShadow: `0 20px 25px -5px ${(config?.colorTheme || config?.color || '#4f46e5')}44` 
                    }}
                  >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      {(() => {
                        const Icon = IconMap[config?.icon || 'Package'] || Layers;
                        return <Icon size={32} className="relative z-10" />;
                      })()}
                  </div>
                  <div className="space-y-1">
                    <DialogTitle className="text-3xl font-black tracking-tighter italic uppercase text-slate-900 dark:text-white leading-none">
                        {t('entity:edit_entity', { label: renderString(config?.label, lang) })}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 font-bold italic uppercase tracking-widest text-[10px] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      {t('entity:edit_record_desc')}
                    </DialogDescription>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <Badge variant="outline" className="rounded-full border-slate-200 dark:border-slate-800 text-slate-400 font-black italic text-[9px] uppercase tracking-tighter px-3 py-1 bg-white dark:bg-slate-950">
                      Action: {t('common:edit')}
                  </Badge>
                </div>
              </div>
            </DialogHeader>
            {editingItem && (
              <DynamicForm 
                entityType={entityType} 
                initialData={editingItem}
                loading={isSaving}
                isModal={true}
                onSubmit={async (values) => {
                  if (isSaving) return;
                  try {
                    setIsSaving(true);
                    await entity.update(editingItem.id, values);
                    setEditingItem(null);
                  } catch (e) {
                    console.error('Failed to update entity:', e);
                  } finally {
                    setIsSaving(false);
                  }
                }} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
