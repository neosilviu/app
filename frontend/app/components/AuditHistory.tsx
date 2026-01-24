import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Activity, RotateCcw, Filter, Calendar, User, Zap, Database, ChevronDown, ChevronUp, Search, BarChart3 } from 'lucide-react';
import { useConfig } from '~/hooks/useConfig';
import { api } from '~/lib/core';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { renderString } from '~/lib/core';

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

  useEffect(() => {
    loadHistory();
    loadStats();
  }, [offset, entityTypeFilter, actionFilter]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await api.post('/api/action/history', {
        limit,
        offset,
        entityType: entityTypeFilter || undefined,
        action: actionFilter || undefined
      });
      
      if (data) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load audit history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.post('/api/action/stats', {});
      
      if (data) {
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleUndo = async (logId: string) => {
    if (!confirm(renderString({ ro: 'Ești sigur că vrei să restorezi această modificare?', en: 'Are you sure you want to undo this change?' }, lang))) {
      return;
    }

    try {
      const data = await api.post(`/api/action/undo/${logId}`, {});
      
      if (data && !data.error) {
        alert(renderString({ ro: 'Modificare restaurată cu succes!', en: 'Change successfully reverted!' }, lang));
        loadHistory();
      } else {
        alert(data?.message || renderString({ ro: 'Eroare la restaurare', en: 'Undo failed' }, lang));
      }
    } catch (error) {
      console.error('Undo failed:', error);
      alert(renderString({ ro: 'Eroare la restaurare', en: 'Undo failed' }, lang));
    }
  };

  const filteredLogs = logs.filter(log => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        log.action.toLowerCase().includes(term) ||
        log.entityType.toLowerCase().includes(term) ||
        log.user.toLowerCase().includes(term) ||
        log.display_value?.toLowerCase().includes(term)
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
    return log.snapshot_before && !log.action.includes('system-undo') && !log.action.includes('delete');
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
          onClick={() => setShowStats(!showStats)}
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
                    <Badge className={`${getActionColor(log.action)} border`}>
                      {log.action}
                    </Badge>
                    
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Database className="w-3.5 h-3.5" />
                      <span className="font-mono">{log.entityType}</span>
                    </div>
                    
                    {log.display_value && (
                      <span className="text-sm font-medium">{log.display_value}</span>
                    )}
                    
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      <span>{log.user}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(log.createdAt)}</span>
                    </div>
                  </div>
                  
                  {log.details && (
                    <p className="text-sm text-muted-foreground">{log.details}</p>
                  )}
                  
                  {expandedLog === log.id && log.snapshot_before && (
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <div className="text-xs font-semibold mb-2 text-muted-foreground">
                        {renderString({ ro: 'Snapshot Înainte:', en: 'Snapshot Before:' }, lang)}
                      </div>
                      <pre className="text-xs overflow-auto max-h-64 p-2 bg-background rounded">
                        {JSON.stringify(log.snapshot_before, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {log.snapshot_before && (
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
