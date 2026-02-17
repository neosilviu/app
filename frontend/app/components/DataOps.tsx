import React, { useState, useRef } from 'react';
import { Archive, Trash2, Upload, Download, X, Check, FileSpreadsheet, Settings2, Sparkles, Paperclip, Loader2, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "./ui/dialog";
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useConfig } from '~/hooks/useConfig';
import { useAuth } from '~/hooks/useAuth';
import { Textarea } from './ui/textarea';
import { normalizeEntity, renderString, cn } from '~/lib/core';

// --- DataManagementActions Component ---

interface DataManagementActionsProps {
  entityType: string;
  selectedCount: number;
  showArchived: boolean;
  onToggleShowArchived: (show: boolean) => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onBulkUpdate?: (field: string, value: any) => void;
  onImport: (File: File, mapping: Record<string, string>) => Promise<any>;
  onImportAI?: (text: string, File?: File) => Promise<any>;
  onExport?: (format: 'csv' | 'json') => void;
  variant?: 'default' | 'compact';
}

export function DataManagementActions({
  entityType, selectedCount, showArchived, onToggleShowArchived, onBulkArchive, onBulkDelete, onBulkUpdate, onImport, onImportAI, onExport, variant = 'default'
}: DataManagementActionsProps) {
  const { t } = useTranslation(['common', 'entity', 'sidebar']);
  const { entity } = useConfig();
  const { user, hasPermission } = useAuth();
  const config = entity[entityType];
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkField, setBulkField] = useState('');
  const [bulkValue, setBulkValue] = useState<any>('');
  
  const [aiText, setAiText] = useState('');
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // Enterprise Level 10: Granular Permission Checks
  // Bulk operations are allowed for admins, workspace managers, or explicit :bulk holders
  const isWsAdmin = hasPermission('workspace:manage') || hasPermission('workspace:members:manage');
  
  const canBulkDelete = hasPermission(`${entityType}:bulk`) || (hasPermission(`${entityType}:delete`) && isWsAdmin) || isWsAdmin;
  const canBulkUpdate = hasPermission(`${entityType}:bulk`) || (hasPermission(`${entityType}:update`) && isWsAdmin) || isWsAdmin;
  const canCreate = hasPermission(`${entityType}:create`) || isWsAdmin;
  const canImport = hasPermission(`${entityType}:bulk`) || (hasPermission(`${entityType}:create`) && isWsAdmin) || isWsAdmin;
  const canExport = hasPermission('workspace:data:export') || hasPermission(`${entityType}:export`) || hasPermission(`${entityType}:bulk`) || isWsAdmin;
  
  if (!config) return null;

  // Enterprise Level 10: Always use the central normalizer
  const normalized = normalizeEntity(config);
  const entityFields = normalized.fields
    .filter(field => !field.readOnly && field.type !== 'id' && !field.primaryKey)
    .map(field => ({ 
      name: field.name, 
      label: field.label || field.name,
      type: field.type,
      options: field.options
    }));

  const handleBulkUpdate = async () => {
    if (!onBulkUpdate || !bulkField) return;
    try {
      await onBulkUpdate(bulkField, bulkValue);
      setIsBulkUpdateOpen(false);
      setBulkField('');
      setBulkValue('');
    } catch (e) {}
  };

  // Fuzzy string matching for better column detection
  const fuzzyMatch = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (s1 === s2) return 1; // Perfect match
    if (s1.includes(s2) || s2.includes(s1)) return 0.8; // Contains
    // Simple Levenshtein-like scoring
    let matches = 0;
    const minLen = Math.min(s1.length, s2.length);
    for (let i = 0; i < minLen; i++) {
      if (s1[i] === s2[i]) matches++;
    }
    return matches / Math.max(s1.length, s2.length);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const File = e.target.files?.[0];
    if (File) {
      setImportFile(File);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || "";
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const firstLine = lines[0] || "";
        
        // Detect delimiter (comma or semicolon)
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const delimiter = semicolonCount > commaCount ? ';' : ',';
        
        const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
        setCsvHeaders(headers);
        const newMapping: Record<string, string> = {};
        
        // Fuzzy matching for better auto-detection
        entityFields.forEach(field => {
          let bestMatch = { header: '', score: 0 };
          headers.forEach(header => {
            const score = fuzzyMatch(field.name, header) + (fuzzyMatch(field.label, header) * 0.5);
            if (score > bestMatch.score && score > 0.5) {
              bestMatch = { header, score };
            }
          });
          if (bestMatch.header) newMapping[field.name] = bestMatch.header;
        });
        setMapping(newMapping);

        // Generate preview data (first 3 rows)
        const delimiter_char = delimiter;
        const previewRows = lines.slice(1, 4).map(line => {
          const values = line.split(delimiter_char).map(v => v.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });
          return row;
        });
        setPreviewData(previewRows);
      };
      reader.readAsText(File);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try { 
      await onImport(importFile, mapping); 
      setIsImportOpen(false); 
      setImportFile(null); 
      setCsvHeaders([]); 
      setMapping({}); 
      setPreviewData([]);
    } catch (error) {}
  };

  const handleAiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const File = e.target.files?.[0];
    if (File) {
      setAiFile(File);
      const reader = new FileReader();
      reader.onload = (event) => setAiText(event.target?.result as string);
      if (File.type.startsWith('text/') || ['.csv', '.json', '.md', '.txt'].some(ext => File.name.endsWith(ext))) reader.readAsText(File);
      else toast.info("Fișier binar detectat. AI va încerca să-l proceseze dacă serverul suportă, altfel vă rugăm să copiați textul manual.");
    }
  };

  const handleAiImport = async () => {
    if ((!aiText && !aiFile) || !onImportAI) return;
    setIsAiProcessing(true);
    try { await onImportAI(aiText, aiFile || undefined); setIsAiImportOpen(false); setAiText(''); setAiFile(null); } catch (error) {} finally { setIsAiProcessing(false); }
  };

  const isCompact = variant === 'compact';

  return (
    <div className={cn(
      "flex items-center gap-2",
      isCompact ? "" : "mb-4 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800"
    )}>
      <div className="flex items-center gap-2">
        {selectedCount > 0 ? (
          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <Badge variant="secondary" className="px-2 py-0.5 h-6 text-[10px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-none uppercase tracking-tighter">
                {selectedCount} {t('common:selected')}
            </Badge>
            <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
            <div className="flex items-center gap-1">
                {canBulkUpdate && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 gap-1.5 uppercase tracking-tight" 
                    onClick={() => { 
                        const needsConfirm = ['workspace', 'contact'].includes(entityType);
                        if (!needsConfirm || confirm(t('entity:bulk_archive_confirm', { count: selectedCount }))) {
                            onBulkArchive(); 
                        }
                    }}
                >
                    <Archive size={12} /> {t('common:archive')}
                </Button>
                )}
                {canBulkUpdate && onBulkUpdate && normalized.features.bulkActions !== false && (
                <Dialog open={isBulkUpdateOpen} onOpenChange={setIsBulkUpdateOpen}>
                    <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 gap-1.5 uppercase tracking-tight">
                        <Settings2 size={12} /> {t('common:edit')}
                    </Button>
                    </DialogTrigger>
                    <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('entity:bulk_update')}</DialogTitle>
                        <DialogDescription>{t('entity:bulk_update_desc', { count: selectedCount })}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                        <Label>{t('entity:field_to_update')}</Label>
                        <select 
                            className="w-full border rounded-md p-2 bg-white dark:bg-slate-950"
                            value={bulkField}
                            onChange={(e) => {
                            setBulkField(e.target.value);
                            setBulkValue('');
                            }}
                        >
                            <option value="">{t('entity:select_field')}</option>
                            {entityFields.map(f => (
                            <option key={f.name} value={f.name}>{renderString(f.label)}</option>
                            ))}
                        </select>
                        </div>

                        {bulkField && (
                        <div className="space-y-2">
                            <Label>{t('entity:new_value')}</Label>
                            {(() => {
                            const field = entityFields.find(f => f.name === bulkField);
                            if (field?.type === 'select' || field?.type === 'enum') {
                                return (
                                <select 
                                    className="w-full border rounded-md p-2 bg-white dark:bg-slate-950"
                                    value={bulkValue}
                                    onChange={(e) => setBulkValue(e.target.value)}
                                >
                                    <option value="">-- {t('common:select')} --</option>
                                    {field.options?.map((o: any) => (
                                    <option key={o.value} value={o.value}>{renderString(o.label)}</option>
                                    ))}
                                </select>
                                );
                            }
                            if (field?.type === 'boolean') {
                                return (
                                <div className="flex gap-4">
                                    <Button variant={bulkValue === true ? 'default' : 'outline'} onClick={() => setBulkValue(true)}>True</Button>
                                    <Button variant={bulkValue === false ? 'default' : 'outline'} onClick={() => setBulkValue(false)}>False</Button>
                                </div>
                                );
                            }
                            return (
                                <Textarea 
                                placeholder={t('entity:value_placeholder')}
                                value={bulkValue}
                                onChange={(e) => setBulkValue(e.target.value)}
                                />
                            );
                            })()}
                        </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBulkUpdateOpen(false)}>{t('common:cancel')}</Button>
                        <Button disabled={!bulkField} onClick={handleBulkUpdate}>{t('common:save')}</Button>
                    </DialogFooter>
                    </DialogContent>
                </Dialog>
                )}
                {canBulkDelete && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 gap-1.5 uppercase tracking-tight" onClick={() => { if (confirm(t('entity:bulk_delete_confirm', { count: selectedCount }))) onBulkDelete(); }}>
                    <Trash2 size={12} /> {t('common:delete')}
                </Button>
                )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100/30 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 transition-colors">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Check size={10} className="text-slate-300" />
                {t('entity:select_items')}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 ml-1">
        <div className="flex items-center p-0.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                    "h-7 px-3 gap-2 text-[10px] font-black uppercase tracking-tighter rounded-lg transition-all", 
                    showArchived ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-slate-600'
                )} 
                onClick={() => onToggleShowArchived(!showArchived)}
            >
                <Archive size={12} /> 
                <span className="hidden lg:inline">{showArchived ? t('common:hide_archived') : t('common:show_archived')}</span>
            </Button>

            <div className="w-[1px] h-4 bg-slate-100 dark:bg-slate-800 mx-0.5" />

            {canImport && normalized.features.import !== false && normalized.features.creatable !== false && (
                <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                    <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-3 gap-2 text-[10px] font-black uppercase tracking-tighter text-slate-400 hover:text-slate-600 rounded-lg">
                        <Upload size={12} /> 
                        <span className="hidden xl:inline">{t('common:import')}</span>
                    </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden">
                        <DialogHeader>
                            <DialogTitle>{t('entity:import_entity', { label: t(`entity:${entityType}.labelPlural`) })}</DialogTitle>
                            <DialogDescription>{t('entity:import_desc')}</DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto py-4 px-1">
                            {!importFile ? (
                                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors" onClick={() => fileInputRef.current?.click()}><FileSpreadsheet className="mx-auto h-12 w-12 text-slate-400 mb-2" /><p className="text-sm text-slate-600 dark:text-slate-400">{t('entity:import_click')}</p><form onSubmit={(e) => e.preventDefault()}><input type="File" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} /></form></div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded">
                                        <span className="text-sm font-medium truncate max-w-[300px]">{importFile.name}</span>
                                        <Button variant="ghost" size="sm" onClick={() => { setImportFile(null); setCsvHeaders([]); setMapping({}); setPreviewData([]); }}><X size={14} /></Button>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium flex items-center gap-2"><Settings2 size={14} /> {t('entity:field_mapping') as string}</h4>
                                        <div className="max-h-[150px] overflow-y-auto border rounded-md p-2 space-y-2">
                                            {entityFields.map(field => (
                                                <div key={field.name} className="flex items-center justify-between gap-4">
                                                    <label className="text-xs font-medium text-slate-500 w-1/3 truncate">{(t(renderString(field.label) as string, renderString(field.label) as string) as string)}</label>
                                                    <select className={`flex-1 text-xs border rounded p-1 ${mapping[field.name] ? 'bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700' : 'bg-white dark:bg-slate-950'}`} value={mapping[field.name] || ''} onChange={(e) => setMapping(prev => ({ ...prev, [field.name]: e.target.value }))}>
                                                        <option value="">{t('entity:skip_field') as string}</option>
                                                        {csvHeaders.map(header => (<option key={header} value={header}>{header}</option>))}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {previewData.length > 0 && (
                                        <div className="space-y-2">
                                        <h4 className="text-sm font-medium flex items-center gap-2"><Eye size={14} /> Preview (primele 3 rânduri)</h4>
                                        <div className="max-h-[120px] overflow-auto border rounded-md bg-slate-50 dark:bg-slate-900 p-2">
                                            <table className="text-[10px] w-full border-collapse">
                                            <thead>
                                                <tr>
                                                {Object.keys(mapping).filter(k => mapping[k as keyof typeof mapping]).map(field => (
                                                    <th key={field} className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800">{mapping[field as keyof typeof mapping]}</th>
                                                ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.map((row, idx) => (
                                                <tr key={idx} className="border-b hover:bg-white dark:hover:bg-slate-800">
                                                    {Object.keys(mapping).filter(k => mapping[k as keyof typeof mapping]).map(field => (
                                                    <td key={field} className="border border-slate-200 dark:border-slate-700 px-2 py-1 truncate max-w-[100px]">{row[mapping[field as keyof typeof mapping]] || '-'}</td>
                                                    ))}
                                                </tr>
                                                ))}
                                            </tbody>
                                            </table>
                                        </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <DialogFooter className="border-t pt-4">
                            <Button variant="outline" onClick={() => setIsImportOpen(false)}>{t('common:cancel')}</Button>
                            <Button disabled={!importFile} onClick={handleImport}><Check size={14} className="mr-2" /> {t('entity:start_import')}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {canImport && onImportAI && normalized.features.import !== false && normalized.features.creatable !== false && (
                <Dialog open={isAiImportOpen} onOpenChange={setIsAiImportOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-3 gap-2 text-[10px] font-black uppercase tracking-tighter text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg">
                            <Sparkles size={12} /> 
                            <span className="hidden xl:inline">{t('entity:import_ai')}</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><Sparkles className="text-purple-600" size={20} />{t('entity:import_ai') as string}</DialogTitle>
                            <DialogDescription>{t('entity:import_ai_desc', { label: (t(`entity:${entityType.replace(/s$/, '')}.labelPlural`) as string).toLowerCase() }) as string}</DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">{t('entity:ai_content') as string}</Label>
                                    <div className="flex items-center gap-2">
                                        <input type="File" className="hidden" ref={aiFileInputRef} onChange={handleAiFileChange} accept=".txt,.csv,.json,.md,.pdf,.docx" />
                                        <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => aiFileInputRef.current?.click()}>
                                            <Paperclip size={12} /> {aiFile ? aiFile.name : (t('entity:attach_file') as string)}
                                        </Button>
                                        {aiFile && (<Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => { setAiFile(null); if (aiFileInputRef.current) aiFileInputRef.current.value = ''; }}><X size={12} /></Button>)}
                                    </div>
                                </div>
                                <Textarea placeholder={t('entity:ai_placeholder')} className="min-h-[300px] font-mono text-[10px] bg-slate-50/50" value={aiText} onChange={(e) => setAiText(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter className="border-t pt-4">
                            <Button variant="outline" onClick={() => setIsAiImportOpen(false)}>{t('common:cancel') as string}</Button>
                            <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled={(!aiText.trim() && !aiFile) || isAiProcessing} onClick={handleAiImport}>
                                {isAiProcessing ? <><Loader2 className="animate-spin mr-2" size={14} />{t('common:processing') as string}</> : <><Sparkles size={14} className="mr-2" /> {t('entity:extract_import') as string}</>}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {canExport && onExport && normalized.features.export !== false && (
                <Button variant="ghost" size="sm" className="h-7 px-3 gap-2 text-[10px] font-black uppercase tracking-tighter text-slate-400 hover:text-slate-600 rounded-lg" onClick={() => onExport('csv')}>
                    <Download size={12} /> 
                    <span className="hidden xl:inline">{t('common:export')}</span>
                </Button>
            )}
        </div>
      </div>
    </div>
  );
}

