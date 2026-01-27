import { useState, useEffect } from 'react';
import { History, RotateCcw, ChevronDown, ChevronUp, Calendar, User } from 'lucide-react';
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

interface EntityHistoryWidgetProps {
  entityType: string;
  entityId: string;
  maxHeight?: string;
  showUndoButton?: boolean;
}

export function EntityHistoryWidget({ 
  entityType, 
  entityId, 
  maxHeight = '400px',
  showUndoButton = true 
}: EntityHistoryWidgetProps) {
  const config = useConfig();
  const lang = config?.constants?.language || 'ro';
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [entityType, entityId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await api.post(`action/entity-history/${entityType}/${entityId}`, {});
      
      if (data) {
        const payload = data?.data || data;
        if (Array.isArray(payload)) setLogs(payload);
        else setLogs(payload.logs || payload || []);
      }
    } catch (error) {
      console.error('Failed to load entity history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (logId: string) => {
    if (!confirm(renderString({ ro: 'Ești sigur că vrei să restorezi această modificare?', en: 'Are you sure you want to undo this change?' }, lang))) {
      return;
    }

    try {
      const data = await api.post(`action/undo/${logId}`, {});
      
      if (data && !data.error) {
        alert(renderString({ ro: 'Modificare restaurată cu succes!', en: 'Change successfully reverted!' }, lang));
        loadHistory();
        // Trigger parent refresh if available
        window.location.reload();
      } else {
        alert(data?.message || renderString({ ro: 'Eroare la restaurare', en: 'Undo failed' }, lang));
      }
    } catch (error) {
      console.error('Undo failed:', error);
      alert(renderString({ ro: 'Eroare la restaurare', en: 'Undo failed' }, lang));
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return renderString({ ro: 'Acum', en: 'Just now' }, lang);
    if (diffMins < 60) return `${diffMins} ${renderString({ ro: 'min', en: 'min' }, lang)}`;
    if (diffHours < 24) return `${diffHours} ${renderString({ ro: 'ore', en: 'hours' }, lang)}`;
    if (diffDays < 7) return `${diffDays} ${renderString({ ro: 'zile', en: 'days' }, lang)}`;
    
    return date.toLocaleDateString(lang === 'ro' ? 'ro-RO' : 'en-US', {
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

  if (collapsed) {
    return (
      <Card className="p-3">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            <span>{renderString({ ro: 'Istoric Modificări', en: 'Change History' }, lang)}</span>
            <Badge variant="outline" className="text-xs">{logs.length}</Badge>
          </div>
          <ChevronDown className="w-4 h-4" />
        </button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-sm">{renderString({ ro: 'Istoric Modificări', en: 'Change History' }, lang)}</span>
          <Badge variant="outline" className="text-xs">{logs.length}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(true)}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>

      <div style={{ maxHeight, overflowY: 'auto' }} className="divide-y">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {renderString({ ro: 'Încărcare...', en: 'Loading...' }, lang)}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {renderString({ ro: 'Nicio modificare înregistrată', en: 'No changes recorded' }, lang)}
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-3 hover:bg-muted/30 transition-colors text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${getActionColor(log.action)} border text-xs`}>
                      {log.action}
                    </Badge>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>{log.user}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(log.createdAt)}</span>
                    </div>
                  </div>
                  
                  {log.details && (
                    <p className="text-xs text-muted-foreground">{log.details}</p>
                  )}
                  
                  {expandedLog === log.id && log.snapshot_before && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      <div className="font-semibold mb-1 text-muted-foreground">
                        {renderString({ ro: 'Snapshot:', en: 'Snapshot:' }, lang)}
                      </div>
                      <pre className="overflow-auto max-h-32 p-1.5 bg-background rounded text-[10px]">
                        {JSON.stringify(log.snapshot_before, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1">
                  {log.snapshot_before && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      className="h-7 w-7 p-0"
                    >
                      {expandedLog === log.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                  
                  {showUndoButton && canUndo(log) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUndo(log.id)}
                      className="h-7 px-2 gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="text-xs">{renderString({ ro: 'Undo', en: 'Undo' }, lang)}</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
