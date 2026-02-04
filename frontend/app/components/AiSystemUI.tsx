import React, { useState, useEffect, useRef } from "react";
import { Search, Sparkles, Command, ArrowRight, X, MessageSquare, Bot, User, Activity, Settings, LayoutGrid, Users, Briefcase, CheckCircle2, Bug, Tag, Send, Minus, Maximize2, HardDrive, FileText, Paperclip, FileDown, Brain, Database, Mic, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { cn, getLocalizedPath, api, renderString } from "~/lib/core";
import { Button } from "./ui/button";
import { useConfig } from "~/hooks/useConfig";
import { useAuth } from "~/hooks/useAuth";
import { resolveIcon } from "~/lib/icons";

const ENTITY_ICONS: Record<string, any> = {
  users: Users,
  briefcase: Briefcase,
  check: CheckCircle2,
  bug: Bug,
  tag: Tag,
  shield: Activity,
};

const getFriendlyDisplayName = (foundModel: any, activeModelId: string) => {
  if (foundModel?.name) return foundModel.name;
  if (!activeModelId) return 'AI Agent';
  
  // Enterprise Level 8: Advanced URI Parser for GitHub/Azure/Deep Links
  if (activeModelId.includes('azureml') || activeModelId.includes('github') || activeModelId.includes('endpoints')) {
    const parts = activeModelId.split('/');
    
    const eIdx = parts.indexOf('endpoints');
    if (eIdx !== -1 && parts[eIdx+1]) return parts[eIdx+1].replace(/-/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase());
    
    const mIdx = parts.indexOf('models');
    if (mIdx !== -1 && parts[mIdx+1]) return parts[mIdx+1].replace(/-/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase());

    // Fallback: If last part is numeric (version), step back 2 levels (skip 'versions' keyword if present)
    const last = parts[parts.length - 1];
    if (last && /^\d+$/.test(last) && parts.length > 1) {
        const candidate = parts[parts.length - 2];
        if (candidate === 'versions' && parts.length > 2) return parts[parts.length - 3].replace(/-/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase());
        return candidate.replace(/-/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase());
    }
  }
  
  return activeModelId.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, (l: any) => l.toUpperCase()) || 'AI Agent';
};

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  url: string;
  icon?: any;
}

// --- AiCommandBar Component ---

export function AiCommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"search" | "ai">("search");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { lang } = useParams();
  const { entity, constants, navigation, uiConfig } = useConfig();
  const settings = constants.SYSTEM_SETTING;
  const { t } = useTranslation(['common', 'ai']);

  const aiConfig = constants.AI_CONFIG || {};
  const registeredProviders = Object.keys(aiConfig.providers || {});
  
  const activeModelId = aiConfig.model || aiConfig.preferredModel || "";
  const foundModel = (aiConfig.models || []).find((m: any) => m.id === activeModelId);
  
  // Level 8: Advanced Provider Resolution (ID-Aware Fallback)
  const activeProvider = foundModel?.provider || 
    (activeModelId.startsWith('@cf/') ? 'cloudflare' : 
     (activeModelId.includes('azureml') || activeModelId.includes('github') ? 'github' : 
      (aiConfig.active_provider || aiConfig.defaultProvider || registeredProviders[0] || '')));
  
  const modelDisplayName = getFriendlyDisplayName(foundModel, activeModelId);
  const providerDisplayName = aiConfig.providers?.[activeProvider]?.typeName || aiConfig.providers?.[activeProvider]?.name || activeProvider;

  const searchShortcut = (uiConfig.shortcuts || []).find((s: any) => s.action === 'open-search');
  const searchKeyHint = searchShortcut ? `${searchShortcut.ctrlKey ? 'Ctrl+' : ''}${searchShortcut.key.toUpperCase()}` : 'Ctrl+K';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleOpenSearch = () => {
      setIsOpen(true);
      setMode("search");
      setTimeout(() => inputRef.current?.focus(), 10);
    };
    const handleOpenAI = () => {
       setIsOpen(true);
       setMode("ai");
       setQuery("?");
       setTimeout(() => inputRef.current?.focus(), 10);
    };
    const handleOpenFiles = () => {
       setIsOpen(true);
       setMode("search");
       setQuery(".");
       setTimeout(() => inputRef.current?.focus(), 10);
    };

    window.addEventListener("studio-open-search", handleOpenSearch);
    window.addEventListener("studio-open-search-ai", handleOpenAI);
    window.addEventListener("studio-open-search-file", handleOpenFiles);
    
    return () => {
      window.removeEventListener("studio-open-search", handleOpenSearch);
      window.removeEventListener("studio-open-search-ai", handleOpenAI);
      window.removeEventListener("studio-open-search-file", handleOpenFiles);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (!val) { setResults([]); return; }
    if (val.length < 2) return;

    // Check for shortcuts
    const startsWithQuestion = val.startsWith("?");
    const startsWithDot = val.startsWith(".");
    const startsWithComma = val.startsWith(",");

    const queryClean = (startsWithQuestion || startsWithDot || startsWithComma) ? val.substring(1).trim() : val.trim();
    if (!queryClean || queryClean.length < 1) {
      if (startsWithQuestion) {
        setMode("ai");
        setResults([]);
      }
      return;
    }

    // ? = AI search
    if (startsWithQuestion) {
      setMode("ai");
      setResults([]);
      return;
    }

    // . = File search (only if printing/indexer worker is active in navigation)
    if (startsWithDot) {
      const isSearchActive = navigation?.worker?.some((w: any) => w.id === 'printing' || w.id === 'indexer');
      
      if (!isSearchActive) {
        setResults([]);
        return;
      }
      setMode("search");
      setLoading(true);
      try {
        const res = await api.local.get(`file/search?q=${encodeURIComponent(queryClean)}`);
        if (res.success) {
          const fileResults = res.data.items.slice(0, 10).map((item: any) => ({
            id: item.fullPath,
            type: 'file',
            title: item.name,
            subtitle: item.fullPath,
            url: '#', 
            icon: item.isDirectory ? HardDrive : FileText
          }));
          setResults(fileResults);
        }
      } catch (e) {
        console.error("File search error:", e);
      } finally {
        setLoading(false);
      }
      return;
    }

    const nextMode = (val.length > 20) ? "ai" : "search";
    setMode(nextMode);
    
    // , = Search contact and tag
    if (startsWithComma) {
      setLoading(true);
      try {
        const res = await api.brain.get(`db/collection/contact?query=${encodeURIComponent(queryClean)}&limit=10`);
        if (res.data && res.success) {
          const contactResults = (res.data || []).map((c: any) => ({
            id: c.id,
            type: 'contact',
            title: c.name || c.email || c.phone || c.id,
            subtitle: c.email || c.phone || '',
            url: getLocalizedPath(`/contact/${c.id}`, lang),
            icon: Users
          }));
          setResults(contactResults);
        }
      } catch (e) {
        console.error('contact search error:', e);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Auto-search file if in search mode or natural search
    if (nextMode === "search") {
      setLoading(true);
      try {
        const res = await api.local.get(`file/search?q=${encodeURIComponent(queryClean)}`);
        if (res.success) {
          const fileResults = res.data.items.slice(0, 10).map((item: any) => ({
            id: item.fullPath,
            type: 'file',
            title: item.name,
            subtitle: item.fullPath,
            url: '#', 
            icon: item.isDirectory ? HardDrive : FileText
          }));
          setResults(fileResults);
        }
      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAiChat = async () => {
    if (!query) return;
    setLoading(true);
    setAiResponse(null);
    try {
      const res = await api.brain.post('ai', {
        action: "chat",
        message: query,
        role: "search",
        model: activeModelId, // Enterprise Level 8: Explicitly pass the selected model
        lang: lang || 'ro'
      });
      if (res.success && res.data) {
        setAiResponse(res.data.response);
      } else {
        setAiResponse(res.error || "Error");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <form 
        onSubmit={(e) => { e.preventDefault(); if (mode === "ai") handleAiChat(); }}
        className={cn(
          "flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 transition-all border-2",
          isOpen ? "border-blue-500 ring-4 ring-blue-500/10 bg-white dark:bg-slate-900" : "border-transparent"
        )}
      >
        <div className="flex items-center gap-2 text-slate-400">
          {mode === "ai" ? <Sparkles size={18} className="text-purple-500 animate-pulse" /> : <Search size={18} />}
        </div>
        <input
          ref={inputRef}
          type="text" value={query} onFocus={() => setIsOpen(true)} onChange={(e) => handleSearch(e.target.value)}
          placeholder={mode === "ai" ? renderString(t('ai:ai_placeholder'), lang) : renderString(t('ai:search_placeholder'), lang)}
          className="bg-transparent border-none focus:ring-0 text-sm ml-2 w-full outline-none placeholder:text-slate-400"
        />
        <div className="hidden md:flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-200 dark:bg-slate-700 rounded text-slate-500 font-mono">{searchKeyHint}</kbd>
        </div>
      </form>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
            {!query && !loading && !aiResponse && (
                <div className="p-2 space-y-3">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">{renderString(t('ai:quick_access'), lang)}</p>
                        <div className="grid grid-cols-2 gap-1 px-1">
                            {Object.entries(entity).filter(([id]) => id !== 'audit_log').map(([id, config]: [string, any]) => {
                                const Icon = config.icon ? resolveIcon(config.icon) : LayoutGrid;
                                return (
                                    <button
                                        key={id} onClick={() => { navigate(getLocalizedPath(`/${id}`, lang)); setIsOpen(false); }}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors group"
                                    >
                                        <div className={cn(
                                            "p-1.5 rounded bg-white dark:bg-slate-700 border dark:border-slate-600 group-hover:bg-blue-500 group-hover:border-blue-500 group-hover:text-white transition-all",
                                            config.color === 'blue' && 'text-blue-500', config.color === 'green' && 'text-green-500', config.color === 'red' && 'text-red-500', config.color === 'orange' && 'text-orange-500', config.color === 'indigo' && 'text-indigo-500', config.color === 'slate' && 'text-slate-500',
                                        )} ><Icon size={14} /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{renderString(config.labelPlural || config.label, lang)}</p>
                                            {config.shortcut && <p className="text-[9px] text-slate-400 font-mono">{config.shortcut.ctrlKey ? 'Ctrl+' : ''}{config.shortcut.shiftKey ? 'Shift+' : ''}{config.shortcut.key.toUpperCase()}</p>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="pt-2 border-t dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">{renderString(t('common:quick_commands'), lang)}</p>
                        <div className="grid grid-cols-2 gap-2 px-1 pb-1">
                            <div className="p-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-left transition-all" onClick={() => navigate(getLocalizedPath('/monitoring', lang))}>
                                <Activity size={14} className="text-blue-500 mb-1" /><p className="text-[11px] font-bold">{renderString(t('common:monitoring'), lang)}</p>
                            </div>
                            <div className="p-2 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-left transition-all" onClick={() => navigate(getLocalizedPath('/settings', lang))}>
                                <Settings size={14} className="text-purple-500 mb-1" /><p className="text-[11px] font-bold">{renderString(t('common:settings'), lang)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {aiResponse && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0"><Bot size={14} className="text-white" /></div>
                    <div className="space-y-2">
                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                        <div className="flex gap-2"><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setAiResponse(null)}>{renderString(t('common:close'), lang)}</Button></div>
                    </div>
                </div>
              </div>
            )}
            {!loading && !aiResponse && query.length >= 2 && mode === "search" && (
              <div className="p-2 space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase px-2 mb-1">{renderString(t('common:search_results'), lang)}</p>
                {results.length > 0 ? (
                    results.map(res => {
                        const Icon = res.icon ? resolveIcon(res.icon) : Search;
                        return (
                            <div 
                              key={res.id} 
                              className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer group"
                              onClick={() => {
                                if (res.type === 'file') {
                                  navigate(getLocalizedPath(`/printing?path=${encodeURIComponent(res.subtitle || '')}`, lang));
                                } else {
                                  navigate(res.url);
                                }
                                setIsOpen(false);
                              }}
                            >
                                <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded border group-hover:bg-blue-500 group-hover:text-white transition-all">
                                    <Icon size={14} />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="text-xs font-semibold truncate text-slate-700 dark:text-slate-200">{res.title}</p>
                                    <p className="text-[10px] text-slate-400 truncate">{res.subtitle}</p>
                                </div>
                            </div>
                        );
                    })
                ) : query.length > 2 ? (
                    <div className="flex items-center justify-center p-4 italic text-sm text-slate-500">{renderString(t('common:no_results'), lang)}</div>
                ) : null}
              </div>
            )}
            {!loading && !aiResponse && mode === "ai" && !query.includes("?") && (
                 <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group" onClick={handleAiChat}>
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600"><Sparkles size={16} /></div>
                        <div><p className="text-sm font-medium">{renderString(t('common:ask_ai'), lang)}</p><p className="text-xs text-slate-500">{renderString(t('common:ai_analysis_for', { query }), lang)}</p></div>
                    </div>
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                 </div>
            )}
          </div>
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center text-[10px] text-slate-400">
             <div className="flex gap-4 flex-wrap">
                <span className="flex items-center gap-1"><Command size={10} /> + K {renderString(t('ai:to_open'), lang)}</span>
                <span className="flex items-center gap-1"><span className="px-1 border rounded bg-white dark:bg-slate-800 font-mono mx-0.5">.</span> {renderString(t('ai:search_files'), lang)}</span>
                <span className="flex items-center gap-1"><span className="px-1 border rounded bg-white dark:bg-slate-800 font-mono mx-0.5">,</span> {renderString(t('ai:search_contacts'), lang)}</span>
                <span className="flex items-center gap-1"><span className="px-1 border rounded bg-white dark:bg-slate-800 font-mono mx-0.5">↵</span> {renderString(t('ai:to_search'), lang)}</span>
             </div>
             <div className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold border border-slate-200/50">
                {modelDisplayName} <span className="text-[9px] opacity-40 font-normal">| {providerDisplayName}</span>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- AiFloatingAgent Component ---

export function AiFloatingAgent() {
  const { t } = useTranslation(['ai', 'common']);
  const { lang } = useParams();
  const { constants } = useConfig();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const storageKey = `chat_size_${user?.email || 'default'}`;

  const [size, setSize] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch (e) { console.warn("Failed to load chat size", e); }
    }
    return { width: 384, height: 500 };
  });
  const [isResizing, setIsResizing] = useState(false);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ name: string, data: string, type: string } | null>(null);
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: renderString(t('ai:agent_welcome'), lang) }
  ]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const aiConfig = constants.AI_CONFIG || {};
  const registeredProviders = Object.keys(aiConfig.providers || {});
  const activeModelId = aiConfig.model || aiConfig.preferredModel || "";
  const foundModel = (aiConfig.models || []).find((m: any) => m.id === activeModelId);
  
  const hasVision = foundModel?.capabilities?.includes('vision');
  const hasFileGen = foundModel?.capabilities?.includes('files') || foundModel?.capabilities?.includes('agentic');

  // Level 8: Advanced Provider Resolution (ID-Aware Fallback)
  const activeProvider = foundModel?.provider || 
    (activeModelId.startsWith('@cf/') ? 'cloudflare' : 
     (activeModelId.includes('azureml') || activeModelId.includes('github') ? 'github' : 
      (aiConfig.active_provider || aiConfig.defaultProvider || registeredProviders[0] || '')));
  
  const modelDisplayName = getFriendlyDisplayName(foundModel, activeModelId);
  const providerDisplayName = aiConfig.providers?.[activeProvider]?.typeName || aiConfig.providers?.[activeProvider]?.name || activeProvider;

  // Level 8 Memory Engine: Restore thread-safe history
  useEffect(() => {
    if (isOpen && messages.length <= 1) {
        api.brain.post('ai', { action: 'history' }).then(res => {
            if (res.success && res.data && res.data.length > 0) {
                setMessages(res.data);
            }
        }).catch(e => console.error("History load error", e));
    }
  }, [isOpen]);

  // Level 8: Resize Engine (Logic for top-left drag expansion)
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Since anchored at bottom-right, we calculate size based on distance from viewport edges
      const newWidth = Math.max(320, window.innerWidth - e.clientX - 24); // 24 = right-6
      const newHeight = Math.max(300, window.innerHeight - e.clientY - 24); // 24 = bottom-6
      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => setIsResizing(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Persistent UI Settings (Enterprise Level 8)
  useEffect(() => {
    if (!isResizing && isOpen) {
       localStorage.setItem(storageKey, JSON.stringify(size));
    }
  }, [isResizing, size.width, size.height, isOpen, storageKey]);

  useEffect(() => {
    const handleOpenHelp = () => setIsOpen(true);
    window.addEventListener("studio-open-help", handleOpenHelp);
    return () => window.removeEventListener("studio-open-help", handleOpenHelp);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File too large (max 5MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedFile({
        name: file.name,
        type: file.type,
        data: base64
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async () => {
    if (!input.trim() && !selectedFile) return;
    
    const userMessage: any = { role: 'user', content: input };
    if (selectedFile) {
        userMessage.attachments = [{ name: selectedFile.name, type: selectedFile.type }];
    }

    setMessages(prev => [...prev, userMessage]);
    
    const currentInput = input;
    const currentFile = selectedFile;
    
    setInput("");
    setSelectedFile(null);
    setLoading(true);
    
    try {
      const res = await api.brain.post('ai', {
        action: "chat",
        message: currentInput,
        image: currentFile?.data, // vision compat
        file: currentFile?.data, // general file compat
        fileName: currentFile?.name,
        fileType: currentFile?.type,
        role: "chat",
        model: activeModelId, 
        history: messages.slice(-15).map(m => ({ role: m.role, content: m.content })),
        lang: lang || 'ro'
      });
      if (res.success && res.data) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: res.error || renderString(t('common:error'), lang) }]);
      }
    } catch (e: any) {
        setMessages(prev => [...prev, { role: 'assistant', content: renderString(t('ai:error_prefix'), lang) + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  const downloadGeneratedFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'generated_file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          setIsTranscribing(true);
          try {
            const res = await api.brain.post('ai', { action: 'transcribe', file: base64data });
            if (res.success && res.data?.text) {
              setInput(prev => prev ? prev + " " + res.data.text : res.data.text);
            }
          } catch (err) {
            console.error("Transcription error", err);
          } finally {
            setIsTranscribing(false);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
      // Enterprise Level 8: Visible error via chat message if mic fails
      setMessages(prev => [...prev, { role: 'assistant', content: renderString(t('ai:mic_error'), lang) }]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleToggleVoice = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-28 md:bottom-6 right-6 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-50 group border-4 border-white dark:border-slate-900"
      >
        <MessageSquare className="h-6 w-6 group-hover:hidden" /><Sparkles className="h-6 w-6 hidden group-hover:block animate-pulse" />
        <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-bounce" />
      </button>
    );
  }

  return (
    <div 
      style={{ width: isMinimized ? 320 : size.width, height: isMinimized ? 56 : size.height }}
      className={cn(
        "fixed bottom-28 md:bottom-6 right-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col z-50 animate-in fade-in slide-in-from-bottom-5", 
        !isResizing && "transition-all duration-300",
        isResizing && "select-none cursor-nwse-resize"
      )}
    >
      {!isMinimized && (
        <div 
          onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
          className="absolute -top-1 -left-1 w-8 h-8 cursor-nwse-resize z-[60] flex items-start justify-start p-1 bg-transparent rounded-tl-2xl hover:bg-blue-500/10 transition-colors group"
        >
           <div className="w-3 h-3 border-t-2 border-l-2 border-transparent group-hover:border-blue-500 transition-colors rounded-tl-sm" />
        </div>
      )}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-blue-600 rounded-t-2xl text-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"><Bot size={18} /></div>
          <div>
            <p className="text-sm font-bold leading-tight">{modelDisplayName}</p>
            {!isMinimized && <p className="text-[10px] text-blue-100 italic leading-tight opacity-90">{providerDisplayName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setIsMinimized(!isMinimized)}>{isMinimized ? <Maximize2 size={16} /> : <Minus size={16} />}</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setIsOpen(false)}><X size={16} /></Button>
        </div>
      </div>
      {!isMinimized && (
        <>
          <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/30 dark:bg-slate-800/10">
            {messages.map((m, i) => {
              // Level 8: Detect file generation (Markdown code blocks with filename hint)
              const fileMatch = m.role === 'assistant' && m.content.match(/```[\w]*\s+filename[:=]\s*([\w.]+)\s*\n([\s\S]*?)```/i);
              const generatedFileName = fileMatch ? fileMatch[1] : null;
              const generatedContent = fileMatch ? fileMatch[2] : null;

              return (
                <div key={i} className={cn("flex flex-col space-y-1", m.role === 'user' ? "items-end" : "items-start")}>
                  <div className={cn("flex gap-2 max-w-[90%]", m.role === 'user' ? "flex-row-reverse" : "")}>
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", m.role === 'user' ? "bg-slate-200 dark:bg-slate-700" : "bg-blue-100 dark:bg-blue-900/40 text-blue-600")}>
                        {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={cn("p-3 rounded-2xl text-sm shadow-sm", m.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800")}>
                        {m.content}
                        
                        {m.attachments?.map((at: any, idx: number) => (
                           <div key={idx} className="mt-2 flex items-center gap-2 p-1.5 bg-black/10 rounded-lg text-[10px] font-mono">
                               <Paperclip size={12} /> {at.name}
                           </div>
                        ))}

                        {generatedFileName && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                             <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 text-[11px] gap-2 w-full"
                                onClick={() => downloadGeneratedFile(generatedContent!, generatedFileName)}
                             >
                                <FileDown size={14} /> {renderString(t('ai:download_generated'), lang)} {generatedFileName}
                             </Button>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0"><Bot size={14} className="text-blue-600" /></div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-800 shadow-sm flex gap-1"><div className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce" /><div className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce delay-75" /><div className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce delay-150" /></div>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            {selectedFile && (
               <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-between animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                     <Paperclip size={14} className="text-blue-500 shrink-0" />
                     <span className="text-[11px] truncate font-medium">{selectedFile.name}</span>
                  </div>
                  <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
               </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="relative flex items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
              
              <div className="relative flex-grow">
                <input 
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  placeholder={renderString(t('ai:type_message'), lang)} 
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 pl-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                />
                
                {hasVision && (
                   <button 
                     type="button" 
                     onClick={() => fileInputRef.current?.click()}
                     className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                   >
                     <Paperclip size={18} />
                   </button>
                )}
              </div>

              <button 
                type="button" 
                onClick={handleToggleVoice}
                disabled={isTranscribing}
                title={renderString(t(isRecording ? 'ai:mic_stop' : (isTranscribing ? 'ai:mic_transcribing' : 'ai:mic_start')), lang)}
                className={cn(
                  "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center transition-all",
                  isRecording 
                    ? "bg-red-500 text-white animate-pulse" 
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500"
                )}
              >
                {isTranscribing ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
              </button>

              <button type="submit" disabled={loading || (!input.trim() && !selectedFile)} className="h-10 w-10 shrink-0 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors"><Send size={18} /></button>
            </form>
            <div className="flex items-center justify-between mt-3">
               <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50">
                  <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", messages.length > 2 ? "bg-emerald-500" : "bg-slate-300")} />
                  <span className="text-[9px] font-black uppercase italic text-slate-400 tracking-tighter flex items-center gap-1">
                     <Brain size={10} className={cn(messages.length > 2 ? "text-blue-500" : "text-slate-300")} />
                     Memory: {messages.length > 1 ? `${messages.length} Events` : 'Clean'}
                  </span>
               </div>
               
               <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50">
                  <span className="text-[9px] font-black uppercase italic text-slate-400 tracking-tighter flex items-center gap-1">
                     <Database size={10} className="text-purple-500" />
                     RAG: Active
                  </span>
               </div>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
                {renderString(t('ai:powered_by'), lang)} <Sparkles size={8} /> 
                {hasFileGen && <span className="ml-2 px-1 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center gap-1 font-bold"><FileDown size={8} /> File Gen </span>}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

