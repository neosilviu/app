import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Activity, RotateCcw, Filter, Calendar, User, Zap, Database, ChevronDown, ChevronUp, Search, BarChart3, ArrowRight } from 'lucide-react';
import { useConfig } from '~/hooks/useConfig';
import { api } from '~/lib/core';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { renderString } from '~/lib/core';
import { formatForRender } from '~/lib/utils';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  display_value?: string;
  user: string;
  details?: string;
  snapshot_before?: any;
  snapshot_after?: any;
  createdAt: string;
}

interface AuditStats {
  total: number;
  lastWeek: number;
  byAction: { action: string; count: number }[];
  byEntity: { entityType: string; count: number }[];
}

const JsonDiff = ({ before, after, lang }: { before: any, after: any, lang: string }) => {
  const b = typeof before === 'string' ? JSON.parse(before) : (before || {});
  const a = typeof after === 'string' ? JSON.parse(after) : (after || {});
  
  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
  const changes = allKeys.filter(k => JSON.stringify(b[k]) !== JSON.stringify(a[k]));

  if (changes.length === 0) {
    return (
      <div className="text-[10px] italic text-muted-foreground p-2">
        {renderString({ ro: 'Nicio diferență detectată în datele brute.', en: 'No differences detected in raw data.' }, lang)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
        {renderString({ ro: 'Câmpuri Modificate', en: 'Changed Fields' }, lang)}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {changes.map(k => {
          const valBefore = b[k];
          const valAfter = a[k];
          
          return (
            <div key={k} className="flex flex-col gap-1 p-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-indigo-600">{k}</span>
                <Badge variant="outline" className="text-[8px] py-0 h-4">
                  {typeof valAfter === 'object' ? 'object' : typeof valAfter}
                </Badge>
              </div>
              <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
                <div className="text-[11px] font-mono p-1 bg-red-500/5 text-red-600 rounded break-all line-through opacity-70">
                  {valBefore === null || valBefore === undefined ? 'null' : (typeof valBefore === 'object' ? JSON.stringify(valBefore) : String(valBefore))}
                </div>
                <ArrowRight size={12} className="text-slate-400" />
                <div className="text-[11px] font-mono p-1 bg-green-500/5 text-green-600 rounded break-all font-bold">
                  {valAfter === null || valAfter === undefined ? 'null' : (typeof valAfter === 'object' ? JSON.stringify(valAfter) : String(valAfter))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export function AuditHistory() {
  const config = useConfig();
  const navigate = useNavigate();
  const lang = config?.constants?.language || 'ro';
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  
  // Filters
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  // Guards to prevent duplicate requests
  const loadingRef = useRef(false);
  const statsLoadingRef = useRef(false);
  const undoRef = useRef(false);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    loadHistory();
    loadStats();
  }, [offset, entityTypeFilter, actionFilter]);

  const loadHistory = async () => {
    if (loadingRef.current) return; // Prevent duplicate concurrent loads
    loadingRef.current = true;
    setLoading(true);
    try {
      // Use GET with query params to avoid sending a request body which can be
      // consumed by middleware or SSR routing in development.
      const qs: string[] = [];
      qs.push(`limit=${limit}`);
      qs.push(`offset=${offset}`);
      if (entityTypeFilter) qs.push(`entityType=${encodeURIComponent(entityTypeFilter)}`);
      if (actionFilter) qs.push(`action=${encodeURIComponent(actionFilter)}`);

      const url = `action/history${qs.length ? `?${qs.join('&')}` : ''}`;
      const data = await api.get(url);

      if (data) {
        const payload = data?.data || data;
        setLogs(payload.logs || []);
        setTotal(payload.total || 0);
      }
    } catch (error) {
      console.error('Failed to load audit history:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (statsLoadingRef.current) return; // Prevent duplicate concurrent stats calls
    statsLoadingRef.current = true;
    try {
      // Use GET to avoid relying on request body parsing
      const data = await api.get('action/stats');
      
      if (data) {
        const payload = data?.data || data;
        setStats(payload);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      statsLoadingRef.current = false;
    }
  };

  const handleUndo = async (logId: string) => {
    if (undoRef.current) return; // Prevent duplicate undo attempts
    if (!confirm(renderString({ ro: 'Ești sigur că vrei să restorezi această modificare?', en: 'Are you sure you want to undo this change?' }, lang))) {
      return;
    }

    undoRef.current = true;
    setUndoing(true);
    try {
      const data = await api.post(`action/undo/${logId}`, {});
      
      if (data && !data.error) {
        alert(renderString({ ro: 'Modificare restaurată cu succes!', en: 'Change successfully reverted!' }, lang));
        loadHistory();
      } else {
        alert(data?.message || renderString({ ro: 'Eroare la restaurare', en: 'Undo failed' }, lang));
      }
    } catch (error) {
      console.error('Undo failed:', error);
      alert(renderString({ ro: 'Eroare la restaurare', en: 'Undo failed' }, lang));
    } finally {
      undoRef.current = false;
      setUndoing(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const action = formatForRender(log.action, lang).toLowerCase();
      const entityTypeStr = formatForRender(log.entityType, lang).toLowerCase();
      const userStr = formatForRender(log.user, lang).toLowerCase();
      const display = formatForRender(log.display_value, lang).toLowerCase();
      return (
        action.includes(term) ||
        entityTypeStr.includes(term) ||
        userStr.includes(term) ||
        display.includes(term)
      );
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return renderString({ ro: 'Acum', en: 'Just now' }, lang);
    if (diffMins < 60) return `${diffMins} ${renderString({ ro: 'min în urmă', en: 'min ago' }, lang)}`;
    if (diffHours < 24) return `${diffHours} ${renderString({ ro: 'ore în urmă', en: 'hours ago' }, lang)}`;
    if (diffDays < 7) return `${diffDays} ${renderString({ ro: 'zile în urmă', en: 'days ago' }, lang)}`;
    
    return date.toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'bg-green-500/10 text-green-600 border-green-500/20';
    if (action.includes('update')) return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    if (action.includes('delete')) return 'bg-red-500/10 text-red-600 border-red-500/20';
    if (action.includes('undo')) return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    if (action.includes('ai')) return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  };

  const canUndo = (log: AuditLog) => {
    const actionStr = formatForRender(log.action, lang).toLowerCase();
    return log.snapshot_before && !actionStr.includes('system-undo') && !actionStr.includes('delete');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold">{renderString({ ro: 'Istoric Modificări', en: 'Change History' }, lang)}</h1>
            <p className="text-sm text-muted-foreground">
              {renderString({ ro: 'Enterprise Level 8 - Undo Engine', en: 'Enterprise Level 8 - Undo Engine' }, lang)}
            </p>
          </div>
        </div>
        
        <Button
          variant={showStats ? 'default' : 'outline'}
          size="sm"
          onClick={async () => {
            const next = !showStats;
            setShowStats(next);
            if (next) await loadStats();
          }}
          disabled={statsLoadingRef.current}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          {renderString({ ro: 'Statistici', en: 'Statistics' }, lang)}
        </Button>
      </div>

      {/* Stats Panel */}
      {showStats && stats && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {renderString({ ro: 'Statistici Audit', en: 'Audit Statistics' }, lang)}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-3xl font-bold text-blue-600">{stats.total.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">{renderString({ ro: 'Total Modificări', en: 'Total Changes' }, lang)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-3xl font-bold text-green-600">{stats.lastWeek.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">{renderString({ ro: 'Ultimele 7 Zile', en: 'Last 7 Days' }, lang)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-3xl font-bold text-purple-600">{stats.byAction.length}</div>
              <div className="text-sm text-muted-foreground">{renderString({ ro: 'Tipuri Acțiuni', en: 'Action Types' }, lang)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-3xl font-bold text-orange-600">{stats.byEntity.length}</div>
              <div className="text-sm text-muted-foreground">{renderString({ ro: 'Entități Active', en: 'Active Entities' }, lang)}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">{renderString({ ro: 'Top Acțiuni', en: 'Top Actions' }, lang)}</h4>
              <div className="space-y-1">
                {stats.byAction.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm bg-white dark:bg-gray-800 rounded px-3 py-1.5">
                    <span className="font-mono">{item.action}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">{renderString({ ro: 'Top Entități', en: 'Top Entities' }, lang)}</h4>
              <div className="space-y-1">
                {stats.byEntity.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm bg-white dark:bg-gray-800 rounded px-3 py-1.5">
                    <span className="font-mono">{item.entityType}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={renderString({ ro: 'Caută...', en: 'Search...' }, lang)}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={renderString({ ro: 'Filtrează după entitate...', en: 'Filter by entity...' }, lang)}
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={renderString({ ro: 'Filtrează după acțiune...', en: 'Filter by action...' }, lang)}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
      </Card>

      {/* Logs List */}
      <Card className="divide-y">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            {renderString({ ro: 'Încărcare...', en: 'Loading...' }, lang)}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {renderString({ ro: 'Niciun istoric disponibil', en: 'No history available' }, lang)}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                      {(() => {
                        const actionStr = formatForRender(log.action, lang);
                        return (
                          <Badge className={`${getActionColor(actionStr)} border`}>
                            {actionStr}
                          </Badge>
                        );
                      })()}
                    
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Database className="w-3.5 h-3.5" />
                      <span className="font-mono">{formatForRender(log.entityType, lang)}</span>
                    </div>
                    
                    {log.display_value && (
                      <span className="text-sm font-medium">{formatForRender(log.display_value, lang)}</span>
                    )}
                    
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      <span>{formatForRender(log.user, lang)}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(log.createdAt)}</span>
                    </div>
                  </div>
                  
                  {log.details && (
                    <p className="text-sm text-muted-foreground">{formatForRender(log.details, lang)}</p>
                  )}
                  
                  {expandedLog === log.id && (log.snapshot_before || log.snapshot_after) && (
                    <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                      {/* Visual Diff Section */}
                      <Card className="p-4 border-indigo-100 bg-indigo-50/20 dark:bg-indigo-950/10 dark:border-indigo-900/30">
                        <JsonDiff before={log.snapshot_before} after={log.snapshot_after} lang={lang} />
                      </Card>

                      {/* Raw Comparison Section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {log.snapshot_before && (
                          <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                            <div className="text-[10px] font-black uppercase tracking-widest mb-2 text-red-600">
                              {renderString({ ro: 'Snapshot Înainte:', en: 'Snapshot Before:' }, lang)}
                            </div>
                            <pre className="text-[10px] font-mono overflow-auto max-h-48 p-2 bg-white/50 dark:bg-slate-900/50 rounded-lg border border-red-200/20">
                              {typeof log.snapshot_before === 'string' ? JSON.stringify(JSON.parse(log.snapshot_before), null, 2) : JSON.stringify(log.snapshot_before, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.snapshot_after && (
                          <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
                            <div className="text-[10px] font-black uppercase tracking-widest mb-2 text-green-600">
                              {renderString({ ro: 'Snapshot După:', en: 'Snapshot After:' }, lang)}
                            </div>
                            <pre className="text-[10px] font-mono overflow-auto max-h-48 p-2 bg-white/50 dark:bg-slate-900/50 rounded-lg border border-green-200/20">
                              {typeof log.snapshot_after === 'string' ? JSON.stringify(JSON.parse(log.snapshot_after), null, 2) : JSON.stringify(log.snapshot_after, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {(log.snapshot_before || log.snapshot_after) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      {expandedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  )}
                  
                  {canUndo(log) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUndo(log.id)}
                      className="gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {renderString({ ro: 'Restaurează', en: 'Undo' }, lang)}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {renderString({ ro: `Afișare ${offset + 1}-${Math.min(offset + limit, total)} din ${total}`, en: `Showing ${offset + 1}-${Math.min(offset + limit, total)} of ${total}` }, lang)}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              {renderString({ ro: 'Înapoi', en: 'Previous' }, lang)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              {renderString({ ro: 'Înainte', en: 'Next' }, lang)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
