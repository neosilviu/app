import React, { useState, useMemo } from 'react';
import { useConfig } from '~/hooks/useConfig';
import { normalizeEntity } from '~/lib/entity-engine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Badge } from '~/components/ui/badge';
import { Bug, Database, Layout, Shield, Zap, Info, Layers, Eye } from 'lucide-react';
import { renderString, cn } from '~/lib/core';
import { useParams } from 'react-router';

export function EntityDevTools() {
  const { entity } = useConfig();
  const { lang = 'ro' } = useParams();
  const [selectedEntity, setSelectedEntity] = useState<string>('');

  const entityNames = useMemo(() => Object.keys(entity).sort(), [entity]);
  
  const normalized = useMemo(() => {
    if (!selectedEntity || !entity[selectedEntity]) return null;
    return normalizeEntity(entity[selectedEntity]);
  }, [selectedEntity, entity]);

  if (entityNames.length === 0) return <div>No entities found in registry.</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl">
            <Bug size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter">Registry DNA Inspector</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Level 8 Diagnostic Tools</p>
          </div>
        </div>

        <div className="w-full md:w-64">
          <Select value={selectedEntity} onValueChange={setSelectedEntity}>
            <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold uppercase text-[10px] tracking-widest">
              <SelectValue placeholder="Select Entity to Inspect" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
              {entityNames.map(name => (
                <SelectItem key={name} value={name} className="rounded-lg py-2 font-bold uppercase text-[9px] tracking-widest">
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedEntity ? (
        <div className="flex flex-col items-center justify-center p-20 text-center bg-slate-50/50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
          <Eye size={48} className="text-slate-300 mb-4" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Select an entity from the list above to inspect its calculated DNA.</p>
        </div>
      ) : normalized && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Summary Card */}
          <Card className="lg:col-span-1 rounded-[2rem] border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/50 dark:shadow-none overflow-hidden h-fit sticky top-24">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-black italic uppercase tracking-tighter">{selectedEntity}</CardTitle>
                <div className={`p-2 rounded-xl bg-${normalized.colorTheme || 'blue'}-50 dark:bg-${normalized.colorTheme || 'blue'}-900/20 text-${normalized.colorTheme || 'blue'}-600`}>
                   <Database size={20} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
               <div>
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Labels</Label>
                  <div className="mt-1 flex flex-col gap-1">
                     <span className="text-sm font-bold">Base: {renderString(normalized.label, lang)}</span>
                     <span className="text-sm font-bold">Plural: {renderString(normalized.labelPlural, lang)}</span>
                  </div>
               </div>
               <div>
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Database</Label>
                  <div className="mt-1 flex flex-col gap-1">
                     <span className="text-sm font-mono font-bold text-indigo-600">Table: {normalized.tableName}</span>
                     <span className="text-sm font-mono font-bold text-emerald-600">Display: {normalized.displayField}</span>
                  </div>
               </div>
               <div>
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Active Features</Label>
                  <div className="mt-2 flex flex-wrap gap-1">
                     {Object.entries(normalized.features || {}).filter(([_, v]) => v).map(([k]) => (
                        <Badge key={k} variant="secondary" className="text-[8px] font-black uppercase tracking-tighter py-0">{k}</Badge>
                     ))}
                  </div>
               </div>
            </CardContent>
          </Card>

          {/* Details Scroll Area */}
          <div className="lg:col-span-2 space-y-6">
             <Card className="rounded-[2rem] border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/50 dark:shadow-none overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                   <div className="flex items-center gap-2">
                       <Layers size={18} className="text-indigo-600" />
                       <CardTitle className="text-sm font-black italic uppercase tracking-widest">Fields Matrix ({normalized.fields.length})</CardTitle>
                   </div>
                </CardHeader>
                <CardContent className="p-0">
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                               <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Field</th>
                               <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Type</th>
                               <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Flags</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {normalized.fields.map(f => (
                               <tr key={f.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                  <td className="px-4 py-3">
                                     <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{f.name}</span>
                                        <span className="text-[9px] font-medium text-slate-400 italic">{renderString(f.label, lang)}</span>
                                     </div>
                                  </td>
                                  <td className="px-4 py-3">
                                     <Badge variant="outline" className="text-[9px] font-mono border-slate-200 dark:border-slate-700">{f.type}</Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                     <div className="flex flex-wrap gap-1">
                                        {f.required && <Badge className="bg-red-50 text-red-600 border-none text-[8px] px-1 py-0">REQ</Badge>}
                                        {f.unique && <Badge className="bg-blue-50 text-blue-600 border-none text-[8px] px-1 py-0">UNIQ</Badge>}
                                        {f.searchable !== false && <Badge className="bg-emerald-50 text-emerald-600 border-none text-[8px] px-1 py-0">SEARCH</Badge>}
                                        {f.relation && <Badge className="bg-purple-50 text-purple-600 border-none text-[8px] px-1 py-0">REL</Badge>}
                                     </div>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </CardContent>
             </Card>

             <Card className="rounded-[2rem] border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/50 dark:shadow-none overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                   <div className="flex items-center gap-2">
                       <Layout size={18} className="text-amber-500" />
                       <CardTitle className="text-sm font-black italic uppercase tracking-widest">UI Config Layout</CardTitle>
                   </div>
                </CardHeader>
                <CardContent className="p-6">
                   <div className="bg-slate-900 rounded-2xl p-4 overflow-auto max-h-[400px]">
                      <pre className="text-[11px] font-mono text-emerald-400">
                         {JSON.stringify(normalized.uiConfig, null, 2)}
                      </pre>
                   </div>
                </CardContent>
             </Card>

             <Card className="rounded-[2rem] border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/50 dark:shadow-none overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                   <div className="flex items-center gap-2">
                       <Zap size={18} className="text-purple-500" />
                       <CardTitle className="text-sm font-black italic uppercase tracking-widest">Raw DNA Spec</CardTitle>
                   </div>
                </CardHeader>
                <CardContent className="p-4">
                   <div className="bg-slate-900 rounded-2xl p-4 overflow-auto max-h-[400px]">
                      <pre className="text-[11px] font-mono text-indigo-400">
                         {JSON.stringify(entity[selectedEntity], null, 2)}
                      </pre>
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>
      )}
    </div>
  );
}

const Label = ({ children, className }: any) => (
  <span className={cn("block text-xs font-bold mb-1", className)}>{children}</span>
);
