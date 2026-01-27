import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { renderString, assertRenderable } from '~/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { 
  HelpCircle, 
  Sparkles, 
  RefreshCw, 
  BookOpen, 
  History, 
  X,  
  BadgeCheck, 
  Bug, 
  Zap, 
  Send,
  AlertTriangle 
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { api, socket } from '~/lib/core';
import { getErrorMessage } from '~/lib/utils';
import { useAuth } from '~/hooks/useAuth';
import { toast } from 'sonner';

interface HelpDialogProps {
  id: string; // The route or entityKey
  trigger?: React.ReactNode;
  onOpen?: () => void;
}

/**
 * HelpDialog - AI-powered contextual help system.
 */
export function HelpDialog({ id, trigger, onOpen }: HelpDialogProps) {
  const { lang } = useParams();
  const { i18n, t } = useTranslation();
  const [help, setHelp] = useState<{ title: string; content: string; description?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchHelp = async (force = false) => {
    setLoading(true);
    try {
      const response = await api.brain.get(`help?id=${id}&lang=${i18n.language}${force ? '&force=true' : ''}`);
      if (response.success) {
        setHelp(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch help:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !help) {
      fetchHelp();
    }
    if (open && onOpen) onOpen();
  }, [open, id]);

  const handleRefresh = () => fetchHelp(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary">
            <HelpCircle className="h-5 w-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[700px] max-h-[92vh] flex flex-col p-0 overflow-hidden border-2"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-2 flex flex-row items-center justify-between border-b bg-muted/30">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <BookOpen className="h-5 w-5 text-primary" />
              {help?.title || renderString(t('help:title'), lang)}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              {help?.description || renderString(t('help:description'), lang)}
            </DialogDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={loading}
            className="text-xs gap-1 border-primary/20 hover:bg-primary/5 mr-4"
          >
            {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
            {renderString(t('common:regenerate'), lang)}
          </Button>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-card selection:bg-primary/10">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
                <RefreshCw className="h-10 w-10 text-primary animate-spin relative" />
              </div>
              <p className="text-sm font-medium animate-pulse text-muted-foreground">{renderString(t('help:ai_thinking'), lang)}</p>
            </div>
          ) : help ? (
            <div className="prose prose-sm dark:prose-invert max-w-none 
              prose-headings:font-bold prose-headings:text-primary prose-a:text-primary 
              prose-code:bg-muted prose-code:p-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
              prose-ul:list-disc prose-ol:list-decimal">
              <ReactMarkdown>{help.content}</ReactMarkdown>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground">
              {renderString(t('help:load_error'), lang)}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/30 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{renderString(t('common:close'), lang)}</Button>
        </div>
        <DialogDescription className="hidden">
            {renderString(t('help:ai_guide_description'), lang)}
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

interface ChangelogEntry {
  id: string;
  module: string;
  version: string;
  title: string;
  description: string;
  type: 'feature' | 'fix' | 'improvement';
  date: string;
  createdAt?: string;
}

/**
 * Changelog - Displays system updates and allows AI generation for SuperAdmins.
 */
export function Changelog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useParams();
  const [logs, setLogs] = useState<Record<string, ChangelogEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<Partial<ChangelogEntry> | null>(null);
  const { user, hasPermission } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const loadLogs = () => {
    setLoading(true);
    socket.emit('changelog:get', {}, (res: any) => {
      if (res.success) {
        setLogs(res.data);
      }
      setLoading(false);
    });
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    socket.emit('changelog:generate', {}, (res: any) => {
      setIsGenerating(false);
      if (res.success) {
        setGeneratedDraft(res.data);
        toast.info(renderString(t('changelog:ai_success'), lang));
      } else {
        toast.error(getErrorMessage(res.error, renderString(t('changelog:generate_error'), lang)));
      }
    });
  };

  const handlePublish = () => {
    if (!generatedDraft) return;
    
    socket.emit('changelog:add', generatedDraft, (res: any) => {
      if (res.success) {
        toast.success(renderString(t('changelog:publish_success'), lang));
        setGeneratedDraft(null);
        loadLogs();
      } else {
        toast.error(getErrorMessage(res.error, renderString(t('changelog:publish_error'), lang)));
      }
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'feature': return <Zap className="w-3 h-3 text-amber-500" />;
      case 'fix': return <Bug className="w-3 h-3 text-red-500" />;
      default: return <BadgeCheck className="w-3 h-3 text-blue-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="sm:max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden"
      >
        <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl">
              <History size={20} />
            </div>
            <div className="text-left">
              <DialogTitle className="text-lg font-black text-slate-900 dark:text-white uppercase italic tracking-tight">{renderString(t('settings:changelog.title'), lang)}</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">{renderString(t('settings:changelog.description'), lang)}</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mr-8">
            {hasPermission('*') && (
              <Button 
                onClick={handleGenerate}
                disabled={isGenerating}
                variant="outline"
                size="sm"
                className="h-8 gap-2 bg-indigo-600 text-white border-none hover:bg-indigo-700 font-bold"
              >
                <Sparkles size={14} className={isGenerating ? 'animate-pulse' : ''} />
                {isGenerating ? 'Analiză AI...' : 'Generează'}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {generatedDraft && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl mb-6 animate-in slide-in-from-top-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600" />
                  <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 lg:uppercase tracking-widest">{t('common:ai_draft')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-slate-500" onClick={() => setGeneratedDraft(null)}>{t('common:cancel')}</Button>
                  <Button size="sm" className="h-7 gap-1 bg-indigo-600 text-white text-[10px] font-bold" onClick={handlePublish}>
                    <Send size={10} /> {t('common:publish')}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded uppercase">v{generatedDraft.version}</span>
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">{generatedDraft.module}</span>
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white">{generatedDraft.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">{generatedDraft.description}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">{t('settings:changelog.syncing')}</p>
            </div>
          ) : Object.keys(logs).length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <History className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="font-bold uppercase tracking-widest text-[10px]">{t('settings:changelog.no_changes')}</p>
            </div>
          ) : (
            Object.entries(logs).map(([module, entries]) => (
              <div key={module} className="space-y-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">{module}</h3>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                </div>
                <div className="space-y-6 ml-2">
                  {entries.map((entry) => (
                    <div key={entry.id} className="relative pl-8 border-l-2 border-slate-100 dark:border-slate-800 pb-2 group">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-950 border-2 border-indigo-500 flex items-center justify-center group-hover:scale-125 transition-transform">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                          v{entry.version}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {new Date(entry.createdAt || entry.date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                          {getTypeIcon(entry.type)}
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{entry.type}</span>
                        </div>
                      </div>
                      <h4 className="text-md font-bold text-slate-800 dark:text-slate-200">{entry.title}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{entry.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center sm:justify-center">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">{t('settings:changelog.versioning_system')}</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SimpleConfirmActionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  isLoading?: boolean;
}

/**
 * SimpleConfirmAction - A simple confirmation modal without text input (used for archive, etc.)
 */
export function SimpleConfirmAction({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  onConfirm,
  isLoading
}: SimpleConfirmActionProps) {
  const { i18n, t } = useTranslation();

  const renderDescription = (desc: any) => {
    assertRenderable(desc, 'description');
    return renderString(desc, i18n?.language || 'ro');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isDangerous ? 'text-amber-600' : 'text-blue-600'}`}>
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="pt-2 text-slate-600">
            {renderDescription(description)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>{cancelText}</Button>
          <Button 
            variant={isDangerous ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isLoading}
            className={isDangerous ? "bg-red-600 hover:bg-red-700 font-bold" : ""}
          >
            {isLoading ? t('processing') : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmDestructiveActionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmationWord: string; // The word they must type
  onConfirm: () => void;
  isLoading?: boolean;
}

/**
 * ConfirmDestructiveAction - A modal that forces users to type a word to confirm a destructive action.
 */
export function ConfirmDestructiveAction({
  open,
  onOpenChange,
  title,
  description,
  confirmationWord,
  onConfirm,
  isLoading
}: ConfirmDestructiveActionProps) {
  const [inputValue, setInputValue] = useState('');
  const { t, i18n } = useTranslation(['common', 'settings']);

  const renderDescription = (desc: any) => {
    assertRenderable(desc, 'description');
    return renderString(desc, i18n?.language || 'ro');
  };

  const handleConfirm = () => {
    if (inputValue === confirmationWord) {
      onConfirm();
      setInputValue('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
        if (!val) setInputValue('');
        onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="pt-2 text-slate-600" asChild>
            <div>
              <p>{renderDescription(description)}</p>
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-100">
                {t('common:destructive_action_warning', { word: confirmationWord })}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="confirm-word" className="text-xs font-bold uppercase text-gray-500">{t('common:visual_confirmation')}</Label>
          <Input
            id="confirm-word"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={confirmationWord}
            className="border-red-200 focus:ring-red-500"
            onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue === confirmationWord) {
                    handleConfirm();
                }
            }}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:cancel')}</Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={inputValue !== confirmationWord || isLoading}
            className="bg-red-600 hover:bg-red-700 font-bold"
          >
            {isLoading ? t('common:processing') : t('common:confirm_deletion')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
