import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet, useParams, Link } from 'react-router';
import { cn, api, socket, getLocalizedPath, socketRequest, type NavItem, renderString, resolveIcon } from '~/lib/core';
import { assertRenderable } from '~/lib/utils';
import { useAuth } from '~/hooks/useAuth';
import { AiFloatingAgent } from '../AiSystemUI';
import { useTranslation } from 'react-i18next';
import { IconMap } from '~/lib/icons';
import { useSettings } from '~/hooks/useSettings';
import { Menu, Plus, History, Palette, Sparkles, Activity, ChevronRight, X, Command, HardDrive, HelpCircle, ShieldCheck, Database, LayoutDashboard, Users as UsersIcon, Briefcase as BriefcaseIcon, Shield as ShieldIcon, Tag as TagIcon, Check as CheckIcon, Bug as BugIcon, LogOut, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { useConfig } from '~/hooks/useConfig';
import { ThemeEditor } from '../ThemeSystem';
import { useTheme } from '~/hooks/useTheme';
import { Changelog, HelpDialog } from '../AppModals';
import { BugReportModal } from './LayoutUtils';
import { AiCommandBar } from '../AiSystemUI';
import { useSystem } from '~/hooks/useSystem';
import { InboxDrawer } from '../dashboard/InboxDrawer';

import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';

// ============================================================================
// QUICK ACTIONS MENU
// ============================================================================

function QuickCreateMenu({ entities, lang, variant = 'pill' }: { entities: any[], lang: string, variant?: 'pill' | 'circle' }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { constants } = useConfig();

  // Robust SuperAdmin check (matching DashboardLayout logic exactly)
  const isSuper = user?.role === 'superadmin' || 
                 (user?.role && (constants?.SYSTEM_ROLE as any)?.[user.role]?.permission?.includes('*'));
  
  // LOGGING: Let's see why it's hiding
  // console.log("[QuickCreateMenu] Role:", user?.role, "Entities:", entities.length, "isSuper:", isSuper);

  // If we have no entities and not an admin, or if it's the floating circle, stay silent
  if (entities.length === 0 && !isSuper) return null;
  if (entities.length === 0 && variant === 'circle') return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
            className={cn(
                "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-all hover:-translate-y-0.5 active:scale-95 border-none shrink-0 z-[60]",
                variant === 'pill' 
                    ? "gap-2 rounded-2xl h-10 md:h-11 px-3 md:px-5 shadow-indigo-100 dark:shadow-none min-w-[44px]" 
                    : "w-14 h-14 rounded-full shadow-indigo-200 dark:shadow-indigo-900/40 p-0"
            )}
            title={renderString(t('common:new'), lang)}
        >
            <Plus size={variant === 'pill' ? 20 : 28} className="stroke-[3]" />
            {variant === 'pill' && (
                <span className="hidden sm:inline font-extrabold uppercase text-[10px] tracking-widest leading-none">
                    {renderString(t('common:new'), lang)}
                </span>
            )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align={variant === 'pill' ? "end" : "center"} 
        side={variant === 'pill' ? "bottom" : "top"}
        sideOffset={variant === 'pill' ? 8 : 20}
        className="w-64 p-3 rounded-[2rem] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-slate-100 dark:border-slate-800 shadow-2xl z-[100]"
      >
        <DropdownMenuLabel className="px-3 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            {renderString(t('sidebar:main_menu'), lang)}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-50 dark:bg-slate-800 mb-2" />
        <div className="space-y-1 overflow-y-auto max-h-[60vh] custom-scrollbar">
            {entities.length === 0 && isSuper && (
                <div className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase italic text-center">
                    {renderString(t('common:no_entities_found'), lang) || "Initialising..."}
                </div>
            )}
            {entities.map(([id, entityDef]: [string, any]) => (
                <DropdownMenuItem 
                    key={id}
                    onClick={() => navigate(getLocalizedPath(`/${id}?action=new`, lang))}
                    className="px-4 py-3 text-xs font-bold rounded-2xl focus:bg-indigo-50 dark:focus:bg-indigo-900/20 text-slate-600 dark:text-slate-300 focus:text-indigo-600 transition-colors flex items-center justify-between group cursor-pointer"
                >
                    <span className="truncate">{renderString(entityDef.label || id, lang)}</span>
                    <Plus size={14} className="opacity-40 group-focus:opacity-100 transition-opacity" />
                </DropdownMenuItem>
            ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// USER MENU CONTENT
// ============================================================================

function UserMenuContent({ onClose, onOpenChangelog, onOpenThemeEditor }: { onClose: () => void, onOpenChangelog?: () => void, onOpenThemeEditor?: () => void }) {
  const { user, hasPermission, hasPageAccess, logout } = useAuth();
  const { lang, ...params } = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  const config = useConfig();
  const navigation = config?.navigation || { main: [], admin: [], user: [] };

  return (
    <div className="w-full">
        <div className="px-6 py-4 mb-2 border-b border-slate-50 dark:border-slate-900">
                <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
                    <Sparkles size= {24} />
                </div>
                <div>
                    <p className="font-black text-slate-900 dark:text-white truncate">{renderString(user?.name, lang)}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {user?.role ? (renderString(t(`common:role.${user.role}`), lang) || user.role) : renderString(t('common:role.user'), lang)}
                    </p>
                </div>
                </div>
        </div>
        
        <div className="px-2 pt-2 space-y-1">
            {navigation.user.filter(item => {
                if (item.hidden) return false;
                
                // Enterprise Level 8: Unified Page Permission Check
                // Profile is allowed for everyone as a basic requirement.
                // Settings and others must strictly follow registry permissions.
                if (item.id && !hasPageAccess(item.id)) {
                    const isCore = ['profile'].includes(item.id);
                    if (!isCore) return false;
                }

                if (item.permission && !hasPermission(item.permission)) return false;
                return true;
            })
            .sort((a, b) => (a.priority || 99) - (b.priority || 99))
            .map(item => {
                const ItemIcon = resolveIcon(item.icon);
                return (
                <Link 
                    key={item.id}
                    to={getLocalizedPath(item.path, lang)} 
                    className="flex items-center gap-4 px-4 py-3 text-xs font-bold rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-all"
                    onClick={onClose}
                >
                    <ItemIcon size={18} className="text-slate-400" /> 
                    {renderString(item.label, lang)}
                </Link>
                );
            })}

            <button 
              onClick={() => { onOpenThemeEditor?.(); onClose(); }}
                className="w-full flex items-center gap-4 px-4 py-3 text-xs font-bold rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:text-indigo-600 transition-all text-left"
            >
                <Palette size={18} /> {renderString(t('sidebar:theme_editor'), lang)}
            </button>

            <div className="md:hidden space-y-1 pt-4 border-t border-slate-50 dark:border-slate-900 mt-4 px-2">
                <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{renderString(t('sidebar:system_tools'), lang)}</p>
                <div className="grid grid-cols-2 gap-2">
                   <Button variant="ghost" className="justify-start gap-3 h-12 rounded-2xl font-bold text-xs" onClick={() => { onClose(); if (onOpenChangelog) onOpenChangelog(); }}>
                      <History size={16} className="text-indigo-500" /> {renderString(t('common:whats_new'), lang)}
                   </Button>
                   <HelpDialog id={params.id || location.pathname} onOpen={onClose} trigger={
                      <Button variant="ghost" className="justify-start gap-3 h-12 rounded-2xl font-bold text-xs">
                        <HelpCircle size={16} className="text-blue-500" /> {renderString(t('common:help'), lang)}
                      </Button>
                   } />
                   <BugReportModal onOpen={onClose} />
                </div>
            </div>

            <div className="h-px bg-slate-50 dark:bg-slate-900 mx-4 my-2" />

            <button 
                onClick={() => { logout(); onClose(); }}
                className="w-full flex items-center gap-4 px-4 py-3 text-xs font-bold rounded-2xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all text-left"
            >
                <LogOut size={18} /> {renderString(t('sidebar:logout'), lang)}
            </button>
        </div>

        {/* ThemeEditor is rendered by parent to avoid unmount when closing this menu */}
    </div>
  );
}
const BrandText = ({ name, hasSystemIssues, lang }: { name: any, hasSystemIssues: boolean, lang?: string }) => {
  const resolvedName = renderString(name, lang);
  if (!resolvedName) return null;

  return (
    <span className={cn(
        "font-black text-sm tracking-tight leading-none",
        hasSystemIssues ? "text-red-500" : "text-slate-900 dark:text-white"
    )}>
      {resolvedName}
    </span>
  );
};

function SidebarItem({ 
  item, 
  lang, 
  isActive, 
  isSidebarOpen, 
  isMobile, 
  setIsMobileMenuOpen,
  onOpenChangelog
}: { 
  item: any, 
  lang: string, 
  isActive: boolean, 
  isSidebarOpen: boolean, 
  isMobile: boolean, 
  setIsMobileMenuOpen?: (o: boolean) => void,
  onOpenChangelog?: () => void
}) {
  const Icon = resolveIcon(item.icon);
  const isOffline = item.status === 'stopped' || item.status === 'disabled';
  
  const handleClick = (e: React.MouseEvent) => {
    if (item.action === 'open-changelog' && onOpenChangelog) {
        e.preventDefault();
        onOpenChangelog();
    }
    if (isMobile) setIsMobileMenuOpen?.(false);
  };

  return (
    <Link
      to={getLocalizedPath(item.path, lang)}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-300 group relative text-[13px]",
        isActive 
          ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold" 
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900",
        isOffline && "opacity-60",
        (!isSidebarOpen && !isMobile) && "justify-center px-1"
      )}
      onClick={handleClick}
    >
      <div className="relative shrink-0">
        <Icon size={isSidebarOpen ? 16 : 18} />
        {item.status && (
          <div className={cn(
            "absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-950",
            ['ready', 'running', 'connected', 'ready (api)', 'ready (imap)'].includes(String(item.status).toLowerCase()) ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" :
            ['initializing', 'connecting', 'starting', 'syncing', 'processing', 'authenticating', 'qr_received'].includes(String(item.status).toLowerCase()) ? "bg-amber-500 animate-pulse" :
            (['stopped', 'error', 'disabled'].includes(String(item.status).toLowerCase())) ? "bg-red-500" :
            "bg-slate-400"
          )} title={String(item.status)} />
        )}
      </div>
      {(isSidebarOpen || isMobile) && (
        <>
          <span className="font-medium truncate">{renderString(item.label, lang)}</span>
          {item.badge && (
            (() => {
              // Fail-fast in dev when badge is an unexpected object
              assertRenderable(item.badge, `nav.badge:${item.id}`);
              const badgeContent = renderString(item.badge, lang);
              return (
                <span className="ml-auto px-1.5 py-0.5 text-[9px] font-black rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                  {badgeContent}
                </span>
              );
            })()
          )}
        </>
      )}
    </Link>
  );
}

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (o: boolean) => void;
  isMobile?: boolean;
  setIsMobileMenuOpen?: (o: boolean) => void;
  onOpenChangelog?: () => void;
}

function Sidebar({ isSidebarOpen, setIsSidebarOpen, isMobile = false, setIsMobileMenuOpen, onOpenChangelog }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useParams();
  const { user, hasPermission, hasPageAccess } = useAuth();
  
  const { workerStatuses, cpu, ram } = useSystem();
  const { settings } = useSettings();
  const { customTheme } = useTheme();
  const config = useConfig();
  const buildInfo = config?.buildInfo as BuildInfo | null;
  const isConfigReady = config?.isInitialized;
  const uiConfig = config?.uiConfig || {};
  const navigation = config?.navigation || { main: [], worker: [], admin: [], user: [], entity: [], shortcuts: [] };
  const entities = config?.entity || {};
  
  const systemSettings = config?.constants?.SYSTEM_SETTING || {};
  // Enterprise Level 8: Robust boolean check for SQLite (supports true, 1, 'true')
  const useLocalAgent = systemSettings.use_local_agent === true || systemSettings.use_local_agent === 1 || String(systemSettings.use_local_agent) === 'true';

  const { t } = useTranslation(['common', 'sidebar', 'monitoring', 'entity']);
  
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [isBrainConnected, setIsBrainConnected] = useState(true);

  const fullPath = location.pathname + location.search;
  const isItemActive = (path: string, exact = false) => {
    const localized = getLocalizedPath(path, lang);
    if (!localized) return false;
    
    // For paths with query params (like tabs), we check the full path
    if (path.includes('?')) return fullPath.startsWith(localized);
    
    // Standard matching
    if (exact) return location.pathname === localized;
    return location.pathname.startsWith(localized);
  };

  useEffect(() => {
    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Simple health check for Brain
    const checkBrain = async () => {
        try {
            const start = Date.now();
            await api.brain.get('health', { timeout: 3000 });
            setIsBrainConnected(true);
        } catch (e) {
            setIsBrainConnected(false);
        }
    };

    const interval = setInterval(checkBrain, 10000);
    checkBrain();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      clearInterval(interval);
    };
  }, []);

  // Monitor useLocalAgent changes reactively
  useEffect(() => {
    if (!isConfigReady) return;

    if (useLocalAgent && !socket.connected) {
        console.warn("⚠️ [SOCKET.IO] ACTIVATING CONNECTION - Local Agent is enabled in Registry");
        socket.connect();
    } else if (!useLocalAgent && socket.connected) {
        console.warn("🛑 [SOCKET.IO] DEACTIVATING CONNECTION - Local Agent is disabled in Registry");
        socket.disconnect();
    }
  }, [useLocalAgent, isConfigReady]);

  const filterNavItems = (items: NavItem[]) => {
    return items
      .filter(item => {
        if (item.hidden) return false;

        // Unified condition: If it requires local agent, check it first
        if (item.localAgentOnly === true && !useLocalAgent) return false;
        
        // Registry-Driven access check
        if (!item.id) return true;
        return hasPageAccess(item.id);
      })
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));
  };

  // Combine registry shortcuts with user pinned shortcuts
  const shortcutItems = [
     ...(filterNavItems(navigation.shortcuts || [])),
     ...(customTheme?.sidebarShortcuts || [])
  ];

  const getWorkerStatus = (workerName: string, itemId?: string) => {
    if (itemId === 'monitoring') {
      return isSocketConnected ? 'running' : 'stopped';
    }
    
    if (!workerName) return undefined;
    const wsId = user?.workspaceId;

    // Unified status for Comms (WhatsApp + Gmail)
    if (itemId === 'interaction' || itemId === 'comms') {
       const waStatus = (wsId && workerStatuses[`whatsapp:${wsId}`]) || workerStatuses['whatsapp'];
       const gmStatus = (wsId && workerStatuses[`gmail:${wsId}`]) || workerStatuses['gmail'];
       
       // Priority: error > processing > running > stopped
       const statuses = [waStatus, gmStatus].map(s => String(s || '').toLowerCase());
       if (statuses.some(s => s === 'error' || s === 'stopped')) return 'stopped';
       if (statuses.some(s => ['initializing', 'connecting', 'starting', 'syncing', 'processing', 'authenticating', 'qr_received'].includes(s))) return 'processing';
       if (statuses.some(s => ['ready', 'running', 'connected', 'ready (api)', 'ready (imap)'].includes(s))) return 'running';
       return 'stopped';
    }

    return (wsId && workerStatuses[`${workerName}:${wsId}`]) || workerStatuses[workerName];
  };

  const navItems = filterNavItems(navigation.main).map(item => ({
    ...item,
    category: (item as any).category || 'main_menu',
    status: (item.workerName || item.id === 'monitoring') ? getWorkerStatus(item.workerName || '', item.id) : undefined
  }));

  const workerItems = filterNavItems(navigation.worker || []).map(item => ({
    ...item,
    status: (item.workerName || item.id === 'monitoring') ? getWorkerStatus(item.workerName || '', item.id) : undefined
  }));

  const adminItems = filterNavItems(navigation.admin).map(item => ({
    ...item,
    status: (item.workerName || item.id === 'monitoring') ? getWorkerStatus(item.workerName || '', item.id) : undefined
  }));
  const entityItems = filterNavItems(navigation.entity || []);
  
  const enableWorker = config?.constants?.SYSTEM_SETTING?.enable_worker === true;

  const hasSystemIssues = useLocalAgent && (cpu > 80 || ram > 90 || Object.values(workerStatuses).some(s => s === 'stopped'));

  return (
    <div className={cn(
        "flex flex-col h-full bg-white dark:bg-slate-950 transition-all duration-500",
        (useLocalAgent && !isSocketConnected) && "border-t-4 border-red-500"
    )}>
      {/* Brand Header */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-gray-50 dark:border-slate-900/50">
        <div className="flex items-center gap-2">
           <div className={cn(
             "w-7 h-7 rounded-lg flex items-center justify-center shadow-lg transition-all rotate-3 group hover:rotate-0 cursor-pointer",
             hasSystemIssues 
              ? "bg-red-600 shadow-red-200 dark:shadow-red-900/40 animate-pulse" 
              : "bg-indigo-600 shadow-indigo-200 dark:shadow-indigo-900/20"
           )}>
              <Command className="w-4 h-4 text-white" />
           </div>
           {(isSidebarOpen || isMobile) && (
             <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-500">
                <BrandText 
                  name={uiConfig?.layout?.appName} 
                  hasSystemIssues={hasSystemIssues}
                  lang={lang}
                />
                <span className={cn(
                    "text-[7px] font-bold uppercase tracking-widest mt-0.5 opacity-70",
                    hasSystemIssues ? "text-red-500" : "text-indigo-500"
                )}>
                    {hasSystemIssues ? renderString(t('sidebar:system_alert'), lang) : renderString(t('sidebar:v2_label'), lang)}
                </span>
             </div>
           )}
        </div>
        {!isMobile && (
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 relative"
          >
            {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
            {hasSystemIssues && !isSidebarOpen && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-950 animate-bounce" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4 custom-scrollbar">
        {/* Loading State */}
        {!isConfigReady && (
            <div className="space-y-2 p-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
        )}
        
        {isConfigReady && (
        <>
        {/* System Health Alerts */}
        {(isSidebarOpen || isMobile) && (
            <div className="space-y-1 px-2">
                {/* CPU Alert */}
                {cpu > 80 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <Activity size={14} className="text-amber-600 animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-amber-900 dark:text-amber-200 uppercase leading-none">{renderString(t('sidebar:high_cpu'), lang)}</span>
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">{cpu}% {renderString(t('sidebar:usage'), lang)}</span>
                        </div>
                    </div>
                )}
                
                {/* RAM Alert */}
                {ram > 90 && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/40 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <HardDrive size={14} className="text-rose-600 animate-pulse" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-rose-900 dark:text-rose-200 uppercase leading-none">{renderString(t('sidebar:low_memory'), lang)}</span>
                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">{ram}% {renderString(t('sidebar:ram_full'), lang)}</span>
                        </div>
                    </div>
                )}

                {/* Stopped Workers Alert */}
                {Object.entries(workerStatuses).some(([name, status]) => status === 'stopped') && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <BugIcon size={14} className="text-red-500" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-red-900 dark:text-red-200 uppercase leading-none">{renderString(t('sidebar:worker_issue'), lang)}</span>
                            <span className="text-[9px] font-bold text-red-500 dark:text-red-400 mt-0.5 truncate max-w-[120px]">
                                {Object.entries(workerStatuses).filter(([_, s]) => s === 'stopped').map(([n]) => n).join(', ')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* System Shortcuts Section */}
        {shortcutItems.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 mb-2 flex items-center gap-2">
                <Zap size={10} className="text-amber-500" />
                {(isSidebarOpen || isMobile) && (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {renderString(t('sidebar:shortcuts'), lang)}
                    </p>
                )}
            </div>
            {shortcutItems.map(item => (
                <SidebarItem 
                    key={item.id} 
                    item={item} 
                    lang={lang || 'ro'} 
                    isActive={isItemActive(item.path, true)}
                    isSidebarOpen={isSidebarOpen} 
                    isMobile={isMobile} 
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                    onOpenChangelog={onOpenChangelog}
                />
            ))}
          </div>
        )}

        {/* Main Menu */}
        <div className="space-y-1">
          <div className="px-3 mb-2 flex items-center gap-2">
            <LayoutDashboard size={10} className="text-slate-400" />
            {(isSidebarOpen || isMobile) && (
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    {renderString(t('sidebar:main_menu'), lang)}
                </p>
            )}
          </div>
          {navItems.filter(i => i.category === 'main_menu' || !i.category).map(item => (
            <SidebarItem 
                key={item.id} 
                item={item} 
                lang={lang || 'ro'} 
                isActive={isItemActive(item.path, true)}
                isSidebarOpen={isSidebarOpen} 
                isMobile={isMobile} 
                setIsMobileMenuOpen={setIsMobileMenuOpen}
                onOpenChangelog={onOpenChangelog}
            />
          ))}
        </div>

        {/* Worker Applications Section */}
        {workerItems.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 mb-2 flex items-center gap-2">
                <Sparkles size={10} className="text-slate-400" />
                {(isSidebarOpen || isMobile) && (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {renderString(t('sidebar:app_worker'), lang)}
                    </p>
                )}
            </div>
            {workerItems.map(item => (
                <SidebarItem 
                    key={item.id} 
                    item={item} 
                    lang={lang || 'ro'} 
                    isActive={isItemActive(item.path, false)}
                    isSidebarOpen={isSidebarOpen} 
                    isMobile={isMobile} 
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                    onOpenChangelog={onOpenChangelog}
                />
            ))}
          </div>
        )}

        {/* Dynamic Entities Section */}
        {entityItems.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 mb-2 flex items-center gap-2">
                <Database size={10} className="text-slate-400" />
                {(isSidebarOpen || isMobile) && (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {renderString(t('sidebar:data_system'), lang)}
                    </p>
                )}
            </div>
            {entityItems.map(item => (
                <SidebarItem 
                    key={item.id} 
                    item={item} 
                    lang={lang || 'ro'} 
                    isActive={isItemActive(item.path, false)}
                    isSidebarOpen={isSidebarOpen} 
                    isMobile={isMobile} 
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                    onOpenChangelog={onOpenChangelog}
                />
            ))}
          </div>
        )}

        {/* Admin Tools Section */}
        {adminItems.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 mb-2 flex items-center gap-2">
                <ShieldCheck size={10} className="text-slate-400" />
                {(isSidebarOpen || isMobile) && (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {renderString(t('sidebar:administration'), lang)}
                    </p>
                )}
            </div>
            {adminItems.map(item => (
                <SidebarItem 
                    key={item.id} 
                    item={item} 
                    lang={lang || 'ro'} 
                    isActive={isItemActive(item.path, false)}
                    isSidebarOpen={isSidebarOpen} 
                    isMobile={isMobile} 
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                    onOpenChangelog={onOpenChangelog}
                />
            ))}
          </div>
        )}
        </>
        )}
      </nav>

      {/* Footer Info & Profile */}
      <div className="p-4 space-y-4">
        {/* Connection Pulse */}
        <div className={cn("px-2", (!isSidebarOpen && !isMobile) && "px-0")}>
            <div className={cn(
                "rounded-2xl p-3 border transition-all duration-500",
                ((!isSocketConnected && useLocalAgent) || !isBrainConnected) && (isSidebarOpen || isMobile) 
                    ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 shadow-xl" 
                    : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800",
                (!isSidebarOpen && !isMobile) && "p-2 border-none bg-transparent"
            )}>
                <div className={cn(
                    "flex gap-2", 
                    (isSidebarOpen || isMobile) ? "items-center justify-between" : "flex-col items-center"
                )}>
                    {/* Cloudflare Connection */}
                    <div className={cn(
                        "flex items-center gap-2 flex-1 p-2 rounded-xl justify-center border transition-all duration-300",
                        isBrainConnected 
                            ? "bg-white dark:bg-slate-800/50 border-slate-50 dark:border-slate-700 shadow-sm" 
                            : "bg-indigo-500 dark:bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.4)] animate-pulse",
                        (!isSidebarOpen && !isMobile) && "p-0 bg-transparent border-none shadow-none"
                    )}>
                        <div className={cn(
                            "w-2.5 h-2.5 rounded-full transition-all duration-500 border-2",
                            isBrainConnected 
                                ? "bg-indigo-500 border-indigo-100 dark:border-indigo-900 shadow-[0_0_8px_rgba(79,70,229,0.4)] shadow-indigo-400" 
                                : "bg-white border-indigo-200 scale-125 shadow-white shadow-sm"
                        )} title="Cloudflare Brain Connection" />
                        {(isSidebarOpen || isMobile) && (
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-tighter",
                                isBrainConnected ? "text-slate-600 dark:text-slate-300" : "text-white"
                            )}>Brain</span>
                        )}
                    </div>

                    {/* Agent Connection */}
                    {useLocalAgent && (
                        <div className={cn(
                            "flex items-center gap-2 flex-1 p-2 rounded-xl justify-center border transition-all duration-300",
                            isSocketConnected 
                                ? "bg-white dark:bg-slate-800/50 border-slate-50 dark:border-slate-700 shadow-sm" 
                                : "bg-red-500 dark:bg-red-600 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse",
                            (!isSidebarOpen && !isMobile) && "p-0 bg-transparent border-none shadow-none"
                        )}>
                            <div className={cn(
                                "w-2.5 h-2.5 rounded-full transition-all duration-500 border-2",
                                isSocketConnected 
                                    ? "bg-green-500 border-green-100 dark:border-green-900 shadow-[0_0_8px_rgba(34,197,94,0.4)]" 
                                    : "bg-white border-red-200 scale-125 shadow-white shadow-sm"
                            )} title="Local Agent Connection" />
                            {(isSidebarOpen || isMobile) && (
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-tighter",
                                    isSocketConnected ? "text-slate-600 dark:text-slate-300" : "text-white"
                                )}>Local</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Build & Version Card */}
        <div className={cn(
            "p-3 rounded-2xl transition-all",
            (isSidebarOpen || isMobile) ? "bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800" : ""
        )}>
            <div className={cn("flex flex-col", (!isSidebarOpen && !isMobile) && "items-center")}>
                {(isSidebarOpen || isMobile) ? (
                    <div className="flex flex-col space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 font-mono tracking-widest uppercase italic">
                                {buildInfo ? buildInfo.hash : config?.constants?.BUILD_DATE}
                            </span>
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">
                                v{buildInfo ? buildInfo.version : config?.constants?.VERSION}
                            </span>
                        </div>
                        {buildInfo && (
                            <span className="text-[8px] font-medium text-slate-400 truncate">
                                {new Date(buildInfo.date).toLocaleString()}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="text-[8px] font-black text-slate-400 uppercase leading-none italic">
                        {buildInfo ? buildInfo.version : config?.constants?.VERSION_SHORT}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

interface HeaderProps {
  title?: string;
  isConnected: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isChangelogOpen: boolean;
  setIsChangelogOpen: (open: boolean) => void;
  onOpenThemeEditor: () => void;
  creatableEntities: any[];
}

function Header({ 
  title: manualTitle, 
  isConnected, 
  setIsMobileMenuOpen, 
  isChangelogOpen, 
  setIsChangelogOpen, 
  onOpenThemeEditor,
  creatableEntities
}: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [storageStats, setStorageStats] = useState<any>(null);
  const { user, hasPermission, hasPageAccess, logout } = useAuth();

  useEffect(() => {
    const fetchStorage = async () => {
      if (!user) return; // PROD GUARD: Prevent requests if not logged in
      if (!hasPageAccess('monitoring')) return; // Level 8: Only admins can view monitoring data
      
      try {
        const res = await socketRequest("monitoring:storage");
        if (res.success) setStorageStats(res.data);
      } catch (e) {}
    };

    fetchStorage();
    const interval = setInterval(fetchStorage, 60000);
    return () => clearInterval(interval);
  }, [user, hasPageAccess]);

  const { workerStatuses } = useSystem();
  const config = useConfig();
  const uiConfig = config?.uiConfig || {};
  const navigation = config?.navigation || { main: [], admin: [], user: [] };
  const entities = config?.entity || {};
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, ...params } = useParams();

  const changeLanguage = (newLang: string) => {
    const newPath = getLocalizedPath('', lang, location.pathname, newLang);
    i18n.changeLanguage(newLang);
    navigate(newPath);
  };

  // Automatic title & icon discovery
  const allNavItems = [...navigation.main, ...navigation.admin, ...navigation.user];
  const navItem = allNavItems.find(item => getLocalizedPath(item.path, lang) === location.pathname);
  const displayTitle = manualTitle || (navItem ? renderString(navItem.label, lang) : '');
  const DisplayIcon = navItem?.icon ? resolveIcon(navItem.icon) : null;
  const workerStatus = navItem?.workerName ? workerStatuses[navItem.workerName] : null;

  // Determine help context ID
  const helpId = params.id || location.pathname;

  // Breadcrumbs component - Refined to only show Current Page Title as requested
  const Breadcrumbs = () => {
    let pathnames = location.pathname.split('/').filter((x) => x);
    
    // If first segment is language, skip it for crumbs
    if (lang && pathnames[0] === lang) {
      pathnames = pathnames.slice(1);
    }
    
    if (pathnames.length === 0) return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 animate-in fade-in duration-500">
            <LayoutDashboard size={14} className="text-indigo-600" />
            <span className="text-xs font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">{renderString(t('sidebar:dashboard'), lang)}</span>
        </div>
    );

    // Get the last valid segment for title display
    const lastValue = pathnames[pathnames.length - 1];
    const to = getLocalizedPath(`/${pathnames.join('/')}`, lang);
    
    let label = lastValue;
    
    // 1. Check navigation config
    const navItem = allNavItems.find(item => getLocalizedPath(item.path, lang) === to);
    if (navItem) {
      label = renderString(navItem.label, lang);
    } 
    // 2. Check entities config (if it's a defined entity list)
    else if (entities[lastValue]) {
      label = renderString(entities[lastValue].labelPlural || entities[lastValue].label, lang);
    }
    // 3. Check if it's a record ID
    let iconName = navItem?.icon || '';

    if (lastValue === params.recordId || lastValue === params.id) {
      const entityKey = pathnames[pathnames.length - 2];
      const entityDef = entities[entityKey];
      const entityLabel = entityDef ? renderString(entityDef.label, lang) : '';
      iconName = entityDef?.icon || '';
      
      // Enterprise Level 8: Improved Identity Breadcrumb (Entity: Name)
      if (manualTitle && String(manualTitle) !== 'undefined' && entityLabel) {
        label = `${entityLabel}: ${manualTitle}`;
      } else if (entityLabel) {
         // If we don't have a manual title yet, show "Entity: ID" but avoid showing "undefined"
         const displayId = (lastValue && lastValue !== 'undefined' && lastValue !== 'new') 
            ? `${lastValue.substring(0, 8)}...` 
            : '';
         label = displayId ? `${entityLabel}: ${displayId}` : entityLabel;
      } else {
        label = manualTitle || lastValue;
      }
    }
    // 4. Handle "new" record
    else if (lastValue === 'new') {
      const entityKey = pathnames[pathnames.length - 2];
      const entityDef = entities[entityKey];
      const entityLabel = entityDef ? renderString(entityDef.label, lang) : '';
      iconName = entityDef?.icon || 'Plus';
      label = t('common:new_record', { label: entityLabel || lastValue });
    } else if (entities[lastValue]) {
      iconName = entities[lastValue].icon || '';
    }

    // Enterprise Level 8: Cleanup labels (remove hyphens, handle special cases)
    if (label === 'entity') return null;

    const Icon = iconName ? resolveIcon(iconName) : null;

    return (
      <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
        {Icon ? (
           <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800/50 shadow-sm">
              <Icon size={16} className="text-indigo-600 dark:text-indigo-400" />
           </div>
        ) : (
          <div className="h-4 w-1.5 bg-indigo-500 rounded-full" />
        )}
        <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-sm md:text-lg leading-tight truncate max-w-[200px] md:max-w-md">
          {renderString(label, lang)}
        </h2>
      </div>
    );
  };

  return (
    <header className="h-14 w-full bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl border-b border-slate-100 dark:border-slate-900 flex items-center justify-between px-2 md:px-6 shrink-0 z-40 sticky top-0">
      <div className="flex items-center gap-1 md:gap-6 flex-1 min-w-0 mr-4">
        <div className="shrink-0 flex items-center gap-4">
          <Breadcrumbs />
        </div>

        {/* Middle Section - Expanding Search Bar */}
        <div className="flex-1 min-w-0 max-w-xl mx-auto">
            <AiCommandBar />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Conditional Inbox/Notification Tray - Only on Communication Page */}
        {(location.pathname.includes('/comms') || location.pathname.includes('/comunicare')) && (
            <div className="hidden md:block">
                <InboxDrawer />
            </div>
        )}

        {/* Support Tools - Visible for all users */}
        <div className="flex items-center p-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
            <BugReportModal />
            <HelpDialog id={helpId} />
        </div>

        {/* Quick Actions */}
        <div className="hidden sm:block">
             <QuickCreateMenu entities={creatableEntities} lang={lang || 'ro'} />
        </div>

        {/* User Dropdown */}
        <div className="relative">
            <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-3 p-1.5 pr-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all group active:scale-95"
            >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-[11px] shadow-lg group-hover:scale-105 transition-transform">
                        {renderString(user?.name).charAt(0) || 'U'}
                    </div>
                    <div className="flex flex-col items-start hidden lg:flex">
                        <span className="text-[10px] font-black text-slate-900 dark:text-white leading-none tracking-tight">{renderString(user?.name) || renderString(t('common:anonymous'), lang)}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                            {user?.role ? (renderString(t(`common:role.${user.role}`)) || user.role) : renderString(t('common:role.user'), lang)}
                        </span>
                    </div>
                    <ChevronRight size={14} className={cn("text-slate-400 transition-transform", isUserMenuOpen ? "rotate-90" : "")} />
                </button>

                {isUserMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                        <div className="absolute right-0 mt-4 w-72 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl py-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                            <UserMenuContent 
                        onClose={() => setIsUserMenuOpen(false)} 
                        onOpenChangelog={() => setIsChangelogOpen(true)}
                          onOpenThemeEditor={onOpenThemeEditor}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    </header>
  );
}

// ============================================================================
// MOBILE BOTTOM BAR
// ============================================================================

function MobileBottomBar({ 
  creatableEntities, 
  setIsMobileMenuOpen, 
  setIsUserMenuOpen 
}: { 
  creatableEntities: any[], 
  setIsMobileMenuOpen: (o: boolean) => void,
  setIsUserMenuOpen: (o: boolean) => void
}) {
  const { lang } = useParams();
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 py-2 z-50 flex items-center justify-between pb-safe">
        {/* Dashboard Link */}
        <Link 
            to={getLocalizedPath("/", lang)} 
            className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                location.pathname === getLocalizedPath("/", lang) ? "text-indigo-600" : "text-slate-400"
            )}
        >
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{renderString(t('sidebar:dashboard'), lang)}</span>
        </Link>

        {/* contact Link */}
        <Link 
            to={getLocalizedPath("/contact", lang)} 
            className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                location.pathname.startsWith(getLocalizedPath("/contact", lang)) ? "text-indigo-600" : "text-slate-400"
            )}
        >
            <UsersIcon size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{renderString(t('sidebar:contact'), lang)}</span>
        </Link>

        {/* Quick Actions (Repus în topbar și aici) */}
        <div className="relative -translate-y-4">
            <QuickCreateMenu entities={creatableEntities} lang={lang || 'ro'} variant="circle" />
        </div>

        {/* User Profile */}
        <button 
            onClick={() => setIsUserMenuOpen(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400"
        >
            <ShieldIcon size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{renderString(t('sidebar:profile'), lang)}</span>
        </button>

        {/* More (Sidebar) */}
        <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400"
        >
            <Menu size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{renderString(t('sidebar:more'), lang)}</span>
        </button>
    </div>
  );
}

// ============================================================================
// DASHBOARD LAYOUT (MAIN COMPONENT)
// ============================================================================

/**
 * DashboardLayout - The main shell of the application, including Sidebar, Header and Main content area.
 */
export default function DashboardLayout({ children, title }: { children?: React.ReactNode, title?: string }) {
  const config = useConfig();
  const uiConfig = config?.uiConfig || {};
  const navigation = config?.navigation || { main: [], admin: [], user: [] };
  const entities = config?.entity || {};
  // HYDRATION FIX: Initialize with default (true) to match server, then sync from storage
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);
  const [dynamicTitle, setDynamicTitle] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useParams();
  const { t } = useTranslation();
  const { user, hasPermission, loading, isAdminExists } = useAuth();
  const { customTheme } = useTheme();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isMounted, setIsMounted] = useState(false);

  const allNavItems = [...navigation.main, ...navigation.admin, ...navigation.user];

  const creatableEntities = React.useMemo(() => {
    if (!entities) return [];
    
    // Check if user has overall admin permission or "*"
    const isSuper = user?.role === 'superadmin' || 
                   (user?.role && (config?.constants?.SYSTEM_ROLE as any)?.[user.role]?.permission?.includes('*'));
    
    return Object.entries(entities).filter(([id, entityDef]: [string, any]) => {
        const canCreate = isSuper || 
                         hasPermission(`${id}:create`) || 
                         hasPermission(`${id}:*`) || 
                         hasPermission('workspace:manage');
                         
        if (!canCreate) return false;
        
        const cfg = entityDef as any;
        // Don't show entities explicitly marked as not creatable
        if (cfg.features?.creatable === false) return false;
        
        // Hide administrative entities from the main "New" menu unless SuperAdmin
        if (!isSuper && cfg.menuConfig?.category === 'administration') return false;
        
        // Check explicit menu visibility override
        if (cfg.menuConfig?.showInNewMenu === false) return false;
        
        return true;
    }).sort((a, b) => ((a[1] as any).menuConfig?.priority || 50) - ((b[1] as any).menuConfig?.priority || 50));
  }, [entities, user, config, hasPermission]);

  const isAuthPage = location.pathname.includes('/login') || 
                     location.pathname.includes('/register') || 
                     location.pathname.includes('/setup');

  const isFullScreenPage = location.pathname.includes('comms') || 
                           location.pathname.includes('whatsapp') ||
                           location.pathname.includes('monitoring');

  // Sync sidebar from theme preference
  React.useEffect(() => {
    if (customTheme?.sidebarCollapsed !== undefined) {
      setIsSidebarOpen(!customTheme.sidebarCollapsed);
    }
  }, [customTheme?.sidebarCollapsed]);

  // Sync sidebar preference after mount
  React.useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('sidebar_open');
    if (saved !== null) {
      try {
        setIsSidebarOpen(JSON.parse(saved));
      } catch (e) {
        // ignore invalid json
      }
    }
  }, []);

  // Automatic Document Title
  React.useEffect(() => {
    const navItem = allNavItems.find((item: any) => getLocalizedPath(item.path, lang) === location.pathname);
    const pageTitle = dynamicTitle || title || (navItem ? renderString(navItem.label, lang) : '');
    const appName = renderString(uiConfig.appName || uiConfig.layout?.appName || '', lang);
    document.title = pageTitle ? `${pageTitle} | ${appName}` : appName;
  }, [location.pathname, title, dynamicTitle, t, uiConfig, allNavItems, lang]);

  React.useEffect(() => {
    localStorage.setItem('sidebar_open', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  React.useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  React.useEffect(() => {
    // Only redirect to login if we are NOT loading, user is missing, AND admin actually exists
    // If admin does not exist, SuperAdminGate will handle redirection to /setup
    // Also check that we aren't already on an auth page to prevent recursion
                       
    if (!loading && !user && isAdminExists === true && !isAuthPage) {
      console.log("[Auth] DashboardLayout redirecting to login - reason: !loading && !user && isAdminExists");
      navigate(getLocalizedPath("/login", lang));
    }
  }, [user, loading, navigate, lang, isAdminExists, location.pathname]);

  // RENDER GUARD: Don't render layout components if we are not authenticated and not on an auth page
  // This prevents eager data fetching from children like Header or nested routes
  if (!loading && !user && isAdminExists === true && !isAuthPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out z-30",
          isSidebarOpen ? "w-64" : "w-20"
        )}
        style={{ 
          backgroundColor: 'rgba(var(--sidebar-bg-rgb, 255, 255, 255), var(--sidebar-opacity, 1))',
          backdropFilter: 'blur(var(--sidebar-blur, 0px))'
        }}
      >
        <Sidebar 
            isSidebarOpen={isSidebarOpen} 
            setIsSidebarOpen={setIsSidebarOpen} 
            onOpenChangelog={() => setIsChangelogOpen(true)}
        />
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 z-50 md:hidden transform transition-transform duration-300 ease-in-out flex flex-col",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar 
          isSidebarOpen={true} 
          setIsSidebarOpen={() => {}} 
          isMobile={true} 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
          onOpenChangelog={() => setIsChangelogOpen(true)}
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          title={dynamicTitle || title} 
          isConnected={isConnected} 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
          isChangelogOpen={isChangelogOpen}
          setIsChangelogOpen={setIsChangelogOpen}
          onOpenThemeEditor={() => setIsThemeEditorOpen(true)}
          creatableEntities={creatableEntities}
        />

        {/* Page Content */}
        <main className={cn(
          "flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950",
          isFullScreenPage ? "p-0" : "p-3 md:p-6 pb-24 md:pb-6"
        )}>
          <div 
            className={cn(
              "transition-all duration-300",
              isFullScreenPage ? "w-full h-full" : "mx-auto"
            )}
            style={isFullScreenPage ? {} : { maxWidth: 'var(--content-width, 80rem)' }}
          >
            {/* Enterprise Level 8: Ensuring context is passed even through children wrapper */}
            {children ? (
                 React.isValidElement(children) ? React.cloneElement(children as React.ReactElement, { context: { setDynamicTitle, dynamicTitle } }) : children
            ) : (
                <Outlet context={{ setDynamicTitle, dynamicTitle }} />
            )}
          </div>
        </main>
        
        <MobileBottomBar 
          creatableEntities={creatableEntities}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          setIsUserMenuOpen={setIsUserMenuOpen}
        />

        {/* Mobile User Menu Overlay */}
        {isUserMenuOpen && (
            <div className="md:hidden fixed inset-0 z-[100] animate-in fade-in duration-300">
                <div 
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                    onClick={() => setIsUserMenuOpen(false)}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-950 rounded-t-[3rem] p-4 shadow-2xl animate-in slide-in-from-bottom-full duration-500">
                    <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6" />
                    <UserMenuContent 
                onClose={() => setIsUserMenuOpen(false)} 
                onOpenChangelog={() => setIsChangelogOpen(true)}
                onOpenThemeEditor={() => setIsThemeEditorOpen(true)}
                    />
                    <div className="h-8" /> {/* Spacer for bottom bar */}
                </div>
            </div>
        )}
        
        <Changelog 
          isOpen={isChangelogOpen} 
          onClose={() => setIsChangelogOpen(false)} 
        />
        <ThemeEditor 
          isOpen={isThemeEditorOpen} 
          onClose={() => setIsThemeEditorOpen(false)}
        />
        <AiFloatingAgent />
      </div>
    </div>
  );
}

export { Header, Sidebar };

