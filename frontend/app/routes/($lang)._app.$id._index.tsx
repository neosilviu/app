import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useConfig } from '~/hooks/useConfig';
import { useEntity } from '~/hooks/useEntity';
import { useAuth } from '~/hooks/useAuth';
import { DynamicTable, DynamicForm } from '~/components/EntitySystem';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  ChevronRight, 
  Database,
  ArrowRight,
  PlusCircle,
  Archive,
  Trash2,
  FileSpreadsheet,
  Layers
} from 'lucide-react';
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
import type { Route } from "../../.react-router/types/app/routes/+types/($lang)._app.$id._index";

export async function loader({ params }: Route.LoaderArgs) {
  return {
    entityId: params.id,
    lang: params.lang
  };
}

export default function EntityPage() {
  const { id, lang } = useParams<{ id: string; lang: string }>();
  const { t } = useTranslation(['common', 'entities']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { entities, loading: configLoading } = useConfig();
  const { hasPermission } = useAuth();
  const entityType = id || '';
  const config = entities[entityType];
  
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

  const canCreate = hasPermission(config);
  const canUpdate = hasPermission(config, 'update');
  const canDelete = hasPermission(config, 'delete');

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
        <h1 className="text-2xl font-black text-rose-900 dark:text-rose-100 mb-2">{t('entities:unknown_entity')}</h1>
        <p className="text-rose-600/70 max-w-md text-center" dangerouslySetInnerHTML={{ __html: t('entities:unknown_entity_desc', { id }) }} />
        <Button variant="outline" className="mt-8 border-rose-200 text-rose-700" onClick={() => navigate(-1)}>
            {t('common:back_to_dashboard')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-700 p-2 md:p-4">
      {/* Clean Header */}
      <div className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-md border border-indigo-100 dark:border-indigo-800">
               <Database className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
               <span className="text-[8px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{renderString(t('entities:master_data'), lang)}</span>
            </div>
            <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic leading-none">
                    {renderString(t(`entities:${entityType}.labelPlural`, renderString(config.labelPlural || entityType, lang)), lang)}
                </h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                    {renderString(t('entities:manage_your', { label: renderString(t(`entities:${entityType}.labelPlural`, renderString(config.labelPlural || entityType, lang)), lang).toLowerCase() }), lang)}
                </p>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-xl font-black text-slate-900 dark:text-white leading-none">{entity.data.length}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{t('entities:records_count')}</span>
            </div>

            {canCreate && (
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                    <Button className="h-8 px-4 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-lg gap-2 shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95 text-[10px] uppercase">
                        <PlusCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('entities:add_entity', { label: t(`entities:${entityType}.label`, renderString(config.label || entityType, lang)) })}</span>
                    </Button>
                    </DialogTrigger>
                    <DialogContent 
                      className="sm:max-w-xl max-h-[92vh] rounded-[2.5rem] p-0 flex flex-col border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl"
                    >
                        <div className="p-10 overflow-y-auto custom-scrollbar">
                            <DialogHeader className="mb-10 text-left relative">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-6">
                                    <div 
                                      className="w-16 h-16 rounded-[2rem] flex items-center justify-center text-white shadow-2xl relative group overflow-hidden"
                                      style={{ 
                                          backgroundColor: config.color || '#4f46e5',
                                          boxShadow: `0 20px 25px -5px ${config.color || '#4f46e5'}44` 
                                      }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {(() => {
                                          const Icon = IconMap[config.icon] || Layers;
                                          return <Icon size={32} className="relative z-10" />;
                                        })()}
                                    </div>
                                    <div className="space-y-1">
                                      <DialogTitle className="text-3xl font-black tracking-tighter italic uppercase text-slate-900 dark:text-white leading-none">
                                          {t('entities:new_record', { label: t(`entities:${entityType}.label`, renderString(config.label || entityType, lang)) })}
                                      </DialogTitle>
                                      <DialogDescription className="text-slate-500 font-bold italic uppercase tracking-widest text-[10px] flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        {t('entities:new_record_desc')}
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
                                onSubmit={async (values) => {
                                try {
                                    await entity.create(values);
                                    setIsCreateOpen(false);
                                } catch (e) {
                                    console.error('Failed to create entity:', e);
                                }
                                }} 
                            />
                        </div>
                    </DialogContent>
                </Dialog>
              )}
        </div>
      </div>

      {/* Stats & Actions Row */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
         <div className="flex-1">
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
            />
         </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden relative">
        <div className="p-1 px-2 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2 pl-4">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('entities:master_data_grid')}</span>
                {isFiltersVisible && (
                    <div className="ml-4 animate-in fade-in slide-in-from-left-2 duration-300">
                        <Input 
                            placeholder={t('entities:table.search_placeholder', { label: '' }).replace('...', '')} 
                            className="h-8 w-48 text-[10px] bg-white border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1 p-1">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`h-8 rounded-lg transition-all ${isFiltersVisible ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}
                    onClick={() => {
                        setIsFiltersVisible(!isFiltersVisible);
                        if (isFiltersVisible) setSearchTerm('');
                    }}
                >
                    <Filter className="w-3.5 h-3.5 mr-2" />
                    {t('entities:filters')}
                </Button>
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
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('entities:no_records')}</h3>
                <p className="text-slate-500 max-w-sm mb-8">
                    {t('entities:no_records_desc')}
                </p>
                {canCreate && (
                    <Button onClick={() => setIsCreateOpen(true)} className="rounded-2xl bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="mr-2 h-5 w-5" /> {t('entities:add_first_record')}
                    </Button>
                )}
            </div>
        )}
      </div>

      {/* Confirmation Modals */}
      <ConfirmDestructiveAction 
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title={t('entities:delete_title')}
        description={t('entities:delete_confirm', { name: deletingItem?.name || deletingItem?.id, label: renderString(config.label, lang) })}
        confirmationWord={t('entities:confirmation_delete')}
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
        title={t('entities:archive_title')}
        description={t('entities:archive_confirm', { name: archivingItem?.name || archivingItem?.id, label: renderString(config.label, lang) })}
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
                        {t('entities:add_new_entity', { label: renderString(config?.label, lang) })}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 font-bold italic uppercase tracking-widest text-[10px] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      {t('entities:create_record_desc', { defaultValue: 'Introduceți datele pentru noua înregistrare' })}
                    </DialogDescription>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <Badge variant="outline" className="rounded-full border-slate-200 dark:border-slate-800 text-slate-400 font-black italic text-[9px] uppercase tracking-tighter px-3 py-1 bg-white dark:bg-slate-950">
                      Action: {t('common:create', { defaultValue: 'ADĂUGARE' })}
                  </Badge>
                </div>
              </div>
            </DialogHeader>
            <DynamicForm 
              entityType={entityType} 
              onSubmit={async (values) => {
                try {
                  await entity.create(values);
                  setIsCreateOpen(false);
                } catch (e) {
                  console.error('Failed to create entity:', e);
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
                        {t('entities:edit_entity', { label: renderString(config?.label, lang) })}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 font-bold italic uppercase tracking-widest text-[10px] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      {t('entities:edit_record_desc')}
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
                onSubmit={async (values) => {
                  try {
                    await entity.update(editingItem.id, values);
                    setEditingItem(null);
                  } catch (e) {
                    console.error('Failed to update entity:', e);
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
