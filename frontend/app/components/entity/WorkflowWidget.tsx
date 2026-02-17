import { useState, useEffect } from 'react';
import { ArrowRight, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { useConfig } from '~/hooks/useConfig';
import { useTranslation } from 'react-i18next';
import { api, getErrorMessage } from '~/lib/core';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '~/components/ui/dialog';
import { renderString } from '~/lib/core';

interface WorkflowTransition {
  value: string;
  label: any;
  icon: string;
  action: string;
  requiresFields: string[];
}

interface WorkflowWidgetProps {
  entityType: string;
  entityId: string;
  currentStatus?: string;
}

export function WorkflowWidget({ entityType, entityId, currentStatus: initialStatus }: WorkflowWidgetProps) {
  const { t, i18n } = useTranslation();
  const config = useConfig();
  const lang = i18n.language;
  
  const [currentStatus, setCurrentStatus] = useState(initialStatus || '');
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<WorkflowTransition | null>(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTransitions();
  }, [entityType, entityId, initialStatus]);

  const loadTransitions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post(`action/workflow/get-transitions/${entityType}/${entityId}`, {});
      
      if (data) {
        const payload = data?.data || data;
        setCurrentStatus(payload.currentStatus);
        setTransitions(payload.availableTransitions || []);
      }
    } catch (err: any) {
      setError(getErrorMessage(err, t('workflow:load_error')));
    } finally {
      setLoading(false);
    }
  };

  const handleTransitionClick = (transition: WorkflowTransition) => {
    setSelectedTransition(transition);
    setConfirmDialog(true);
  };

  const performTransition = async () => {
    if (!selectedTransition) return;
    
    setTransitioning(true);
    setError(null);
    try {
      const data = await api.post(`action/workflow/transition/${entityType}/${entityId}`, {
        toStatus: selectedTransition.value
      });
      
      if (data) {
        const payload = data?.data || data;
        setCurrentStatus(payload.newStatus);
        setSelectedTransition(null);
        setConfirmDialog(false);
        await loadTransitions();
      }
    } catch (err: any) {
      setError(getErrorMessage(err, t('workflow:transition_failed')));
    } finally {
      setTransitioning(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      lead: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      customer: 'bg-green-500/10 text-green-600 border-green-500/20',
      partner: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      archived: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      todo: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
      in_progress: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      done: 'bg-green-500/10 text-green-600 border-green-500/20',
      blocked: 'bg-red-500/10 text-red-600 border-red-500/20',
      proposal: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      negotiation: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      won: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      lost: 'bg-red-500/10 text-red-600 border-red-500/20'
    };
    return colors[status] || 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="text-sm text-muted-foreground text-center">
          {t('common:loading')}
        </div>
      </Card>
    );
  }

  if (!currentStatus) {
    return (
      <Card className="p-4">
        <div className="text-sm text-muted-foreground text-center">
          {t('workflow:no_status')}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-4 space-y-4">
        {/* Current Status */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            {t('workflow:current_status')}
          </p>
          <Badge className={`${getStatusColor(currentStatus)} border text-sm py-2 px-3`}>
            {currentStatus}
          </Badge>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/50 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Available Transitions */}
        {transitions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {t('workflow:available_transitions')}
            </p>
            <div className="space-y-2">
              {transitions.map((transition) => (
                <Button
                  key={transition.value}
                  variant="outline"
                  className="w-full justify-start gap-2 h-10 text-xs"
                  onClick={() => handleTransitionClick(transition)}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>{renderString(transition.label, lang)}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {transitions.length === 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/50 flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('workflow:no_transitions')}
            </p>
          </div>
        )}
      </Card>

      {/* Transition Confirmation Dialog */}
      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              {t('workflow:confirm_title')}
            </DialogTitle>
            <DialogDescription>
              {selectedTransition && t('workflow:confirm_desc', { from: currentStatus, to: selectedTransition.value })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {selectedTransition?.requiresFields && selectedTransition.requiresFields.length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900/50">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-1">
                  {t('workflow:required_fields')}
                </p>
                <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
                  {selectedTransition.requiresFields.map(field => (
                    <li key={field} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3" />
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog(false)}
              disabled={transitioning}
            >
              {t('common:cancel')}
            </Button>
            <Button
              onClick={performTransition}
              disabled={transitioning}
              className="gap-2"
            >
              {transitioning && <span className="animate-spin">⟳</span>}
              {t('workflow:confirm_title')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
