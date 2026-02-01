import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useEntity } from '~/hooks/useEntity';
import { useConfig } from '~/hooks/useConfig';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Plus, CheckCircle2, Circle, Trash2, ChevronRight, Clock, User, Tag as TagIcon } from 'lucide-react';
import { cn, renderString } from '~/lib/utils';
import { toast } from 'sonner';

interface SubtaskManagerProps {
  parentTaskId: string;
  workspaceId?: string;
}

export function SubtaskManager({ parentTaskId, workspaceId }: SubtaskManagerProps) {
  const { lang } = useParams();
  const { t } = useTranslation(['common', 'entity']);
  const { entity } = useConfig();
  const { data: allTasks, create, update, remove, refresh } = useEntity('task');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const subtasks = allTasks.filter(t => t.parentTaskId === parentTaskId && !t.deletedAt);

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    try {
      await create({
        title: newSubtaskTitle.trim(),
        parentTaskId: parentTaskId,
        status: 'pending',
        priority: 'medium',
        workspaceId
      });
      setNewSubtaskTitle('');
      setIsAdding(false);
      toast.success(renderString(t('entity:subtask_added'), lang));
      refresh();
    } catch (error) {
      toast.error(renderString(t('common:error_generic'), lang));
    }
  };

  const toggleSubtask = async (task: any) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const newProgress = newStatus === 'completed' ? 100 : 0;
    
    try {
      await update(task.id, { 
        status: newStatus,
        progress: newProgress
      });
      refresh();
    } catch (error) {
      toast.error(renderString(t('common:error_generic'), lang));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <ChevronRight size={14} className="text-indigo-500" />
          {renderString(t('entity:subtasks'), lang)} ({subtasks.length})
        </h3>
        {!isAdding && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-[10px] uppercase font-bold tracking-tighter gap-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg"
            onClick={() => setIsAdding(true)}
          >
            <Plus size={12} /> {renderString(t('common:add'), lang)}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {subtasks.map((task) => (
          <div 
            key={task.id} 
            className={cn(
              "group flex items-center gap-3 p-3 rounded-xl border transition-all duration-300",
              task.status === 'completed' 
                ? "bg-slate-50 border-slate-100 opacity-60" 
                : "bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm"
            )}
          >
            <button 
              onClick={() => toggleSubtask(task)}
              className={cn(
                "transition-colors",
                task.status === 'completed' ? "text-green-500" : "text-slate-300 hover:text-indigo-500"
              )}
            >
              {task.status === 'completed' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </button>
            
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-bold transition-all truncate",
                task.status === 'completed' ? "text-slate-400 line-through" : "text-slate-700"
              )}>
                {renderString(task.title, lang)}
              </p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 font-medium">
                <span className="flex items-center gap-1"><Clock size={10} /> {new Date(task.createdAt).toLocaleDateString()}</span>
                {task.assignedTo && <span className="flex items-center gap-1"><User size={10} /> {task.assignedTo}</span>}
              </div>
            </div>

            <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 text-red-400 hover:text-red-500 hover:bg-red-50"
                onClick={() => { if(confirm('Ștergi subtask-ul?')) remove(task.id).then(() => refresh()); }}
            >
                <Trash2 size={14} />
            </Button>
          </div>
        ))}

        {isAdding && (
          <form onSubmit={handleAddSubtask} className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <Input 
              value={newSubtaskTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSubtaskTitle(e.target.value)}
              placeholder={renderString(t('entity:subtask_placeholder'), lang)}
              className="h-9 text-sm rounded-xl focus-visible:ring-indigo-500"
              autoFocus
            />
            <div className="flex gap-1">
              <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl">
                {renderString(t('common:save'), lang)}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsAdding(false)}
                className="rounded-xl"
              >
                {renderString(t('common:cancel'), lang)}
              </Button>
            </div>
          </form>
        )}

        {subtasks.length === 0 && !isAdding && (
          <div className="text-center py-6 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              {renderString(t('entity:no_subtasks'), lang)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
