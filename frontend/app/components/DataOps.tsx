import React, { useState, useRef, useEffect } from 'react';
import { 
  Archive, Trash2, Upload, Download, X, Check, FileSpreadsheet, Settings2, 
  Users, Sparkles, Paperclip, Loader2, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Eye
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "./ui/dialog";
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useConfig } from '~/hooks/useConfig';
import { useAuth } from '~/hooks/useAuth';
import { Textarea } from './ui/textarea';
import { api, normalizeEntity, renderString } from '~/lib/core';

// --- DataManagementActions Component ---

interface DataManagementActionsProps {
  entityType: string;
  selectedCount: number;
  showArchived: boolean;
  onToggleShowArchived: (show: boolean) => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onImport: (File: File, mapping: Record<string, string>) => Promise<any>;
  onImportAI?: (text: string, File?: File) => Promise<any>;
  onExport?: (format: 'csv' | 'json') => void;
}

export function DataManagementActions({
  entityType, selectedCount, showArchived, onToggleShowArchived, onBulkArchive, onBulkDelete, onImport, onImportAI, onExport
}: DataManagementActionsProps) {
  const { t } = useTranslation(['common', 'entities']);
  const { entities } = useConfig();
  const { user } = useAuth();
  const config = entities[entityType];
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  if (!config) return null;

  // Enterprise Level 8: Always use the central normalizer
  const normalized = normalizeEntity(config);
  const entityFields = normalized.fields
    .filter(field => !field.readOnly && field.type !== 'id')
    .map(field => ({ name: field.name, label: field.label || field.name }));

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

  return (
    <div className="flex items-center gap-2 mb-4 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="flex-1 flex items-center gap-2">
        {selectedCount > 0 ? (
          <>
            <Badge variant="secondary" className="px-2 py-1">{selectedCount} {t('common:selected')}</Badge>
            <Button 
                variant="outline" 
                size="sm" 
                className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 gap-2" 
                onClick={() => { 
                    const needsConfirm = ['workspace', 'contact'].includes(entityType);
                    if (!needsConfirm || confirm(t('entities:bulk_archive_confirm', { count: selectedCount }))) {
                        onBulkArchive(); 
                    }
                }}
            >
                <Archive size={14} /> <span className="hidden sm:inline">{t('common:archive')}</span>
            </Button>
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 bg-red-50 hover:bg-red-100 gap-2" onClick={() => { if (confirm(t('entities:bulk_delete_confirm', { count: selectedCount }))) onBulkDelete(); }}><Trash2 size={14} /> <span className="hidden sm:inline">{t('common:delete')}</span></Button>
          </>
        ) : <span className="text-sm text-slate-500 ml-2">{t('entities:select_items')}</span>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className={`gap-2 ${showArchived ? 'text-blue-600 bg-blue-50' : 'text-slate-500'}`} onClick={() => onToggleShowArchived(!showArchived)}>
          <Archive size={14} /> 
          <span className="hidden sm:inline">{showArchived ? t('common:hide_archived') : t('common:show_archived')}</span>
        </Button>

        {normalized.features.import !== false && normalized.features.creatable !== false && (
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Upload size={14} /> 
                <span className="hidden sm:inline">{t('common:import')}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden">
              <DialogHeader>
                  <DialogTitle>{t('entities:import_entity', { label: t(`entities:${entityType.replace(/s$/, '')}.labelPlural`) })}</DialogTitle>
                  <DialogDescription>{t('entities:import_desc')}</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto py-4 px-1">
                  {!importFile ? (
                      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors" onClick={() => fileInputRef.current?.click()}><FileSpreadsheet className="mx-auto h-12 w-12 text-slate-400 mb-2" /><p className="text-sm text-slate-600 dark:text-slate-400">{t('entities:import_click')}</p><form onSubmit={(e) => e.preventDefault()}><input type="File" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} /></form></div>
                  ) : (
                      <div className="space-y-4">
                          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded">
                              <span className="text-sm font-medium truncate max-w-[300px]">{importFile.name}</span>
                              <Button variant="ghost" size="sm" onClick={() => { setImportFile(null); setCsvHeaders([]); setMapping({}); setPreviewData([]); }}><X size={14} /></Button>
                          </div>
                          <div className="space-y-2">
                              <h4 className="text-sm font-medium flex items-center gap-2"><Settings2 size={14} /> {t('entities:field_mapping') as string}</h4>
                              <div className="max-h-[150px] overflow-y-auto border rounded-md p-2 space-y-2">
                                  {entityFields.map(field => (
                                      <div key={field.name} className="flex items-center justify-between gap-4">
                                          <label className="text-xs font-medium text-slate-500 w-1/3 truncate">{(t(renderString(field.label) as string, renderString(field.label) as string) as string)}</label>
                                          <select className={`flex-1 text-xs border rounded p-1 ${mapping[field.name] ? 'bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-700' : 'bg-white dark:bg-slate-950'}`} value={mapping[field.name] || ''} onChange={(e) => setMapping(prev => ({ ...prev, [field.name]: e.target.value }))}>
                                              <option value="">{t('entities:skip_field') as string}</option>
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
                  <Button disabled={!importFile} onClick={handleImport}><Check size={14} className="mr-2" /> {t('entities:start_import')}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {onImportAI && normalized.features.import !== false && normalized.features.creatable !== false && (
          <Dialog open={isAiImportOpen} onOpenChange={setIsAiImportOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2 border-purple-200 hover:bg-purple-50 text-purple-600"><Sparkles size={14} /> <span className="hidden sm:inline">{t('entities:import_ai')}</span></Button></DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Sparkles className="text-purple-600" size={20} />{t('entities:import_ai') as string}</DialogTitle>
                    <DialogDescription>{t('entities:import_ai_desc', { label: (t(`entities:${entityType.replace(/s$/, '')}.labelPlural`) as string).toLowerCase() }) as string}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto py-4 px-1 space-y-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-slate-500 uppercase">{t('entities:ai_content') as string}</Label>
                            <div className="flex items-center gap-2">
                                <input type="File" className="hidden" ref={aiFileInputRef} onChange={handleAiFileChange} accept=".txt,.csv,.json,.md,.pdf,.docx" />
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => aiFileInputRef.current?.click()}>
                                    <Paperclip size={12} /> {aiFile ? aiFile.name : (t('entities:attach_file') as string)}
                                </Button>
                                {aiFile && (<Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => { setAiFile(null); if (aiFileInputRef.current) aiFileInputRef.current.value = ''; }}><X size={12} /></Button>)}
                            </div>
                        </div>
                        <Textarea placeholder={t('entities:ai_placeholder')} className="min-h-[300px] font-mono text-[10px] bg-slate-50/50" value={aiText} onChange={(e) => setAiText(e.target.value)} />
                    </div>
                </div>
                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={() => setIsAiImportOpen(false)}>{t('common:cancel') as string}</Button>
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white" disabled={(!aiText.trim() && !aiFile) || isAiProcessing} onClick={handleAiImport}>
                        {isAiProcessing ? <><Loader2 className="animate-spin mr-2" size={14} />{t('common:processing') as string}</> : <><Sparkles size={14} className="mr-2" /> {t('entities:extract_import') as string}</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {onExport && normalized.features.export !== false && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => onExport('csv')}>
            <Download size={14} /> 
            <span className="hidden sm:inline">{t('common:export')}</span>
          </Button>
        )}
      </div>
    </div>
  );
}


