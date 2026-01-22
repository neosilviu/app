import React from 'react';
import { Activity, Clock, User, Box, ArrowRight, RotateCcw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { IconMap } from '~/lib/icons';
import { cn, api, getThemeClasses } from '~/lib/core';
import { normalizeEntity } from '~/lib/entity-engine';
import { useConfig } from '~/hooks/useConfig';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  display_value: string;
  user: string;
  timestamp: string;
  details?: string;
}

export function UnifiedActivityFeed({ logs, loading }: { logs: ActivityLog[], loading: boolean }) {
  const { entities, constants } = useConfig();
  const { lang = 'ro' } = useParams();
  const [filter, setFilter] = React.useState<string>('all');

  const handleUndo = async (logId: string) => {
    try {
      const res = await api.brain.post(`actions/undo/${logId}`);
      if (res.success) {
        toast.success("Operațiune anulată cu succes!");
        window.location.reload();
      } else {
        toast.error("Eroare la undo: " + res.error);
      }
    } catch (e: any) {
      toast.error("Eroare conexiune: " + e.message);
    }
  };

  const filteredLogs = logs.filter(log => filter === 'all' || log.entityType === filter);
  const activeEntities = Array.from(new Set(logs.map(l => l.entityType)));

  return (
    <Card className="border-none shadow-sm bg-white/50 backdrop-blur-md dark:bg-slate-900/50 flex flex-col h-full">
      <CardHeader className="border-b border-slate-50 dark:border-white/5 py-4 space-y-4">
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
               <Activity className="w-4 h-4 text-indigo-500" />
               <CardTitle className="text-base font-black uppercase italic tracking-tight">Flux Activitate Uniformizat</CardTitle>
            </div>
            <Link to={`/${lang}/audit_log`} className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 hover:underline">
              Vezi tot auditul
            </Link>
        </div>

        {/* Entity Filters (Flow State Machine) */}
        {!loading && activeEntities.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Button 
                variant={filter === 'all' ? 'default' : 'outline'} 
                size="sm" 
                className="h-6 px-3 rounded-full text-[8px] font-black uppercase tracking-widest transition-all"
                onClick={() => setFilter('all')}
            >
                Toate
            </Button>
            {activeEntities.map(ent => {
                const def = entities[ent] || { label: ent };
                return (
                    <Button 
                        key={ent}
                        variant={filter === ent ? 'default' : 'outline'} 
                        size="sm" 
                        className="h-6 px-3 rounded-full text-[8px] font-black uppercase tracking-widest transition-all"
                        onClick={() => setFilter(ent)}
                    >
                        {def.label || ent}
                    </Button>
                );
            })}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto max-h-[600px] scrollbar-hide">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-2 bg-slate-100 rounded w-3/4" />
                  <div className="h-2 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-300">
            <Activity className="w-12 h-12 opacity-10 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Nicio activitate recentă</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-white/5">
            {filteredLogs.map((log) => {
              const entityDefRaw = entities[log.entityType] || entities[log.entityType.toLowerCase()] || {};
              const entityDef = normalizeEntity({ ...entityDefRaw, name: log.entityType });
              const theme = getThemeClasses(entityDef.colorTheme || 'slate');
              const Icon = IconMap[entityDef.icon || ''] || Box;
              
              const actionColors: Record<string, string> = {
                create: 'text-emerald-500 bg-emerald-50',
                update: 'text-blue-500 bg-blue-50',
                delete: 'text-rose-500 bg-rose-50',
                insert: 'text-emerald-500 bg-emerald-50'
              };

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all group">
                  <div className="flex gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                      theme.bg,
                      "text-white"
                    )}>
                      <Icon size={18} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {entityDef.label}
                        </span>
                        <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn(
                          "px-1.5 py-0 h-4 text-[7px] font-black uppercase tracking-tighter border-none",
                          actionColors[log.action] || 'bg-slate-100 text-slate-500'
                        )}>
                          {log.action}
                        </Badge>
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                          {log.display_value || log.entityId}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                         <div className="flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-black text-slate-500 uppercase">
                             {log.user.charAt(0)}
                           </div>
                           <span className="text-[9px] font-bold text-slate-500">{log.user}</span>
                         </div>
                         
                         <div className="flex gap-1">
                           <Button 
                             size="sm" 
                             variant="ghost" 
                             className="h-7 px-2 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg gap-1"
                             onClick={() => handleUndo(log.id)}
                           >
                             <RotateCcw size={10} /> Undo
                           </Button>
                           <Button 
                             size="sm" 
                             variant="ghost" 
                             className="h-7 px-2 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                             asChild
                           >
                             <Link to={`/${lang}/${entityDef.name}/${log.entityId}`}>
                               Detalii <ArrowRight size={10} className="ml-1" />
                             </Link>
                           </Button>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

