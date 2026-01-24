import React, { useState } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router';
import * as Icons from 'lucide-react';
import { 
  ChevronRight, 
  Home, 
  Bug, 
  Send, 
  AlertCircle, 
  HelpCircle, 
  User, 
  Settings, 
  LogOut, 
  Sparkles, 
  Menu, 
  LayoutDashboard, 
  Plus, 
  Command, 
  X, 
  Zap, 
  Database, 
  ShieldCheck,
  AlertTriangle,
  Search,
  History,
  Activity,
  ZapOff
} from 'lucide-react';
import { cn, getLocalizedPath, api, renderString } from '~/lib/core';
import { IconMap } from '~/lib/icons';
import { useConfig } from '~/hooks/useConfig';
import { useTranslation } from 'react-i18next';
import { useAuth } from '~/hooks/useAuth';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AiCommandBar } from '../AiSystemUI';
import { HelpDialog } from '../AppModals';
import { InboxDrawer } from '../dashboard/InboxDrawer';

// ============================================================================
// HEADER COMPONENT (Enterprise Level 8 "Dumb UI")
// ============================================================================

interface HeaderProps {
  title?: string;
  lang: string;
  isSidebarOpen: boolean;
  setIsMobileMenuOpen: (o: boolean) => void;
  onOpenChangelog: () => void;
}

export function Header({ title: manualTitle, lang, isSidebarOpen, setIsMobileMenuOpen, onOpenChangelog }: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <header className="h-14 w-full bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl border-b border-slate-100 dark:border-slate-900 flex items-center justify-between px-2 md:px-6 shrink-0 z-40 sticky top-0">
      <div className="flex items-center gap-1 md:gap-6 flex-1 min-w-0 mr-4">
        <div className="shrink-0 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden hover:bg-slate-100 dark:hover:bg-slate-900 h-9 w-9 rounded-xl"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </Button>

          <div className="hidden sm:block">
            <Breadcrumbs />
          </div>
        </div>

        <div className="flex-1 min-w-0 max-w-xl mx-auto">
            <AiCommandBar />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <div className="hidden md:block">
            <InboxDrawer />
        </div>

        <div className="flex items-center gap-1 md:gap-3">
            <div className="hidden lg:flex items-center p-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
               <BugReportModal />
               <HelpDialog id={location.pathname} />
            </div>

            <div className="relative">
                <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-3 p-1.5 pr-3 bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all group active:scale-95"        
                >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-[11px] shadow-lg group-hover:scale-105 transition-transform">
                        {renderString(user?.name).charAt(0) || 'U'}
                    </div>
                    <div className="flex flex-col items-start hidden lg:flex">
                        <span className="text-[10px] font-black text-slate-900 dark:text-white leading-none tracking-tight">{renderString(user?.name) || t('common:anonymous')}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                            {user?.role || 'user'}
                        </span>
                    </div>
                </button>

                {isUserMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                        <div className="absolute right-0 mt-4 w-72 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl py-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                            <UserMenuContent
                                onClose={() => setIsUserMenuOpen(false)}
                                onOpenChangelog={onOpenChangelog}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
      </div>
    </header>
  );
}

// ================= :Mobile Navigation Component: ==================

export function MobileBottomBar({
  onOpenSidebar,
  onOpenUser
}: {
  onOpenSidebar: () => void,
  onOpenUser: () => void
}) {
  const { lang } = useParams();
  const location = useLocation();
  const { t } = useTranslation();

  const isHome = location.pathname === getLocalizedPath("/", lang);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 py-2 z-50 flex items-center justify-between pb-safe">
        <Link
            to={getLocalizedPath("/", lang)}
            className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                isHome ? "text-indigo-600" : "text-slate-400"
            )}
        >
            <LayoutDashboard size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{t('sidebar:dashboard')}</span>
        </Link>

        <div className="relative -translate-y-4">
            <Button
                className="w-14 h-14 rounded-full bg-indigo-600 shadow-xl shadow-indigo-200 dark:shadow-indigo-900/40 flex items-center justify-center text-white"
                onClick={() => {}} // Could open a "Quick Action" menu
            >
                <Plus size={28} className="stroke-[3]" />
            </Button>
        </div>

        <button
            onClick={onOpenSidebar}
            className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400"
        >
            <Menu size={20} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{t('sidebar:more')}</span>
        </button>
    </div>
  );
}


export const resolveIcon = (iconName: any) => {
  if (!iconName) return HelpCircle;
  if (typeof iconName === 'function') return iconName;
  const name = String(iconName);
  return IconMap[name] || 
         IconMap[name.charAt(0).toUpperCase() + name.slice(1)] ||
         (Icons as any)[name] ||
         HelpCircle;
};

export const DynamicIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = resolveIcon(name);
  return <Icon className={className} />;
};

// ============================================================================
// BREADCRUMBS COMPONENT
// ============================================================================

export function Breadcrumbs() {
  const location = useLocation();
  const { entity, navigation } = useConfig();
  const { t } = useTranslation();
  const { lang, ...params } = useParams();

  let pathnames = location.pathname.split('/').filter((x) => x);
  
  // If first segment is language, skip it for crumbs
  if (lang && pathnames[0] === lang) {
    pathnames = pathnames.slice(1);
  }
  
  if (pathnames.length === 0) return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 animate-in fade-in duration-500">
          <LayoutDashboard size={14} className="text-indigo-600" />
          <span className="text-xs font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">{t('sidebar:dashboard')}</span>
      </div>
  );

  const allNavItems = [...(navigation?.main || []), ...(navigation?.admin || []), ...(navigation?.user || [])];

  return (
    <nav className="flex items-center text-xs text-slate-500 dark:text-slate-400 overflow-x-auto whitespace-nowrap scrollbar-hide">
      <Link 
        to={getLocalizedPath("/", lang)} 
        className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1 p-1 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg"
      >
        <Home size={14} />
      </Link>

      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = getLocalizedPath(`/${pathnames.slice(0, index + 1).join('/')}`, lang);
        
        // Try to translate / find label
        let label = value;
        
        // 1. Check navigation config
        const navItem = allNavItems.find(item => getLocalizedPath(item.path, lang) === to);
        if (navItem) {
          label = renderString(navItem.label, lang);
        } 
        // 2. Check entities config (if it's a defined entity list)
        else if (entity[value]) {
          label = entity[value].labelPlural || entity[value].label || value;
        }
        // 3. Check if it's a dynamic parameter (e.g. recordId)
        else if (params.recordId === value) {
          label = value;
        }
        else if (params.id === value && !entity[value]) {
          label = value;
        }
        
        // Handle specific segments
        if (value === 'entity') return null; // Skip the "entity" segment for cleaner UI

        return (
          <React.Fragment key={to}>
            <ChevronRight size={12} className="mx-1 text-slate-300 dark:text-slate-600 shrink-0" />
            {last ? (
              <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[150px] uppercase tracking-tight">
                {renderString(label, lang)}
              </span>
            ) : (
              <Link 
                to={to} 
                className="hover:text-slate-900 dark:hover:text-white transition-colors truncate max-w-[150px] font-bold"
              >
                {renderString(label, lang)}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ============================================================================
// BUG REPORT MODAL COMPONENT
// ============================================================================

export function BugReportModal({ onOpen }: { onOpen?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      toast.error('Te rugăm să completezi toate câmpurile');
      return;
    }

    setLoading(true);
    try {
      const response = await api.brain.post(`db/collection/bug_report/${user?.workspaceId || 'all'}`, {
        title,
        description,
        status: 'new',
        priority: 'medium',
        reported_by: user?.id,
        workspaceId: user?.workspaceId,
        metadata: JSON.stringify({
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });

      if (response.success) {
        toast.success('Raport trimis cu succes! Mulțumim.');
        setTitle('');
        setDescription('');
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Error reporting bug:', error);
      toast.error('Eroare la trimiterea raportului');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open && onOpen) onOpen();
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-500 transition-colors">
          <Bug size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="text-red-500" size={20} />
            Raportează o Problemă
          </DialogTitle>
          <DialogDescription>
            Trimite-ne detalii despre problema întâmpinată pentru a o putea remedia.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titlu Scurt</Label>
            <Input 
              id="title" 
              placeholder="Ex: Nu se încarcă lista de contacte" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descriere Detaliată</Label>
            <Textarea 
              id="description" 
              placeholder="Ce s-a întâmplat? Ce pași ai urmat?" 
              className="min-h-[100px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Vom colecta automat informații despre browser și pagina curentă pentru a ne ajuta să rezolvăm problema mai repede.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? 'Se trimite...' : (
                <>
                  <Send size={16} /> Trimite Raport
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// BRAND COMPONENTS
// ============================================================================

export function BrandText({ name, hasSystemIssues, lang }: { name?: string, hasSystemIssues: boolean, lang: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn(
        "text-sm font-black tracking-tighter transition-colors duration-500",
        hasSystemIssues ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"
    )}>
        {name || 'Studio App'}
    </span>
  );
}

// ============================================================================
// USER MENU COMPONENTS
// ============================================================================

export function UserMenuContent({ onClose, onOpenChangelog }: { onClose: () => void, onOpenChangelog: () => void }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { lang } = useParams();
  const navigate = useNavigate();

  const menuItems = [
    { id: 'profile', icon: User, label: t('sidebar:profile'), path: '/profile' },
    { id: 'settings', icon: Settings, label: t('sidebar:settings'), path: '/settings' },
    { id: 'changelog', icon: Sparkles, label: t('sidebar:changelog'), action: () => { onOpenChangelog(); onClose(); } },
  ];

  return (
    <div className="flex flex-col">
       <div className="px-6 py-4 border-b border-slate-50 dark:border-slate-900 mb-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('common:welcome_back')}</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{renderString(user?.name)}</p>
       </div>

       <div className="px-2 space-y-1">
           {menuItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => {
                        if (item.action) item.action();
                        else if (item.path) navigate(getLocalizedPath(item.path, lang));
                        onClose();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition-all group"
                >
                    <item.icon size={18} className="text-slate-400 group-hover:text-indigo-500" />
                    {renderString(item.label)}
                </button>
           ))}

           <div className="h-px bg-slate-50 dark:bg-slate-900 my-2 mx-4" />

           <button
                onClick={() => logout()}
                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 hover:text-red-700 transition-all group"
           >
                <LogOut size={18} className="text-red-400 group-hover:text-red-600" />
                {t('common:logout')}
           </button>
       </div>
    </div>
  );
}

// ============================================================================
// STATUS INDICATORS COMPONENT
// ============================================================================

interface StatusIndicatorsProps {
  isConnected: boolean;
}

export function StatusIndicators({ isConnected }: StatusIndicatorsProps) {
  return (
    <div className="hidden sm:flex items-center gap-3 mr-2">
      <div className="flex items-center gap-1.5">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Front</span>
      </div>
      
      <div className="flex items-center gap-1.5">
        <div className="relative flex h-2 w-2">
          {isConnected ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          )}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Back</span>
      </div>
    </div>
  );
}

// ================= :Enterprise Level 8 "Dumb UI": ==================

export const SidebarItem = ({ 
    item, 
    lang, 
    isActive, 
    isSidebarOpen, 
    isMobile, 
    setIsMobileMenuOpen, 
    onOpenChangelog,
    status
}: { 
    item: any, 
    lang: string, 
    isActive: boolean,
    isSidebarOpen: boolean,
    isMobile?: boolean,
    setIsMobileMenuOpen?: (open: boolean) => void,
    onOpenChangelog?: () => void,
    status?: string
}) => {
  const Icon = resolveIcon(item.icon);
  
  const handleClick = () => {
    if (item.id === 'changelog' && onOpenChangelog) {
        onOpenChangelog();
    }
    if (isMobile && setIsMobileMenuOpen) {
        setIsMobileMenuOpen(false);
    }
  };

  const content = (
    <div className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group/item",
        isActive 
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 scale-[1.02]" 
            : "hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-indigo-600 font-bold"
    )}>
        <div className="relative">
            <Icon size={18} className={cn(
                "transition-transform group-hover/item:scale-110",
                isActive ? "text-white" : "text-slate-400 group-hover/item:text-indigo-500"
            )} />
            {status && (
                <span className={cn(
                    "absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 border-white dark:border-slate-950",
                    status === 'running' ? "bg-green-500" : status === 'processing' ? "bg-amber-500" : "bg-red-500"
                )} />
            )}
        </div>
        
        {(isSidebarOpen || isMobile) && (
            <div className="flex items-center justify-between flex-1 min-w-0">
                <span className="truncate text-xs tracking-tight">{renderString(item.label, lang)}</span>
                {item.badge && (
                    <span className={cn(
                        "text-[9px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-widest",
                        isActive ? "bg-white/20 text-white" : "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                    )}>
                        {item.badge}
                    </span>
                )}
            </div>
        )}
    </div>
  );

  if (item.path) {
    return (
        <Link to={getLocalizedPath(item.path, lang)} onClick={handleClick}>
            {content}
        </Link>
    );
  }

  return (
    <button onClick={handleClick} className="w-full text-left">
        {content}
    </button>
  );
};

export const Sidebar = ({ 
  navigation, 
  lang,
  isSidebarOpen,
  setIsSidebarOpen,
  isMobile,
  setIsMobileMenuOpen,
  onOpenChangelog,
  workerStatuses = {}
}: { 
  navigation: any, 
  lang: string,
  isSidebarOpen: boolean,
  setIsSidebarOpen?: (open: boolean) => void,
  isMobile?: boolean,
  setIsMobileMenuOpen?: (open: boolean) => void,
  onOpenChangelog: () => void,
  workerStatuses?: Record<string, any>
}) => {
  const { t } = useTranslation();
  const location = useLocation();

  const isItemActive = (path: string) => {
      const localizedPath = getLocalizedPath(path, lang);
      if (path === '/' || path === '') return location.pathname === localizedPath;
      return location.pathname.startsWith(localizedPath);
  };

  const getStatus = (item: any) => {
    if (item.workerName) return workerStatuses[item.workerName];
    if (item.id === 'monitoring') return workerStatuses['agent'] || 'running'; // Mock logic for demo
    return undefined;
  };

  const Section = ({ title, icon: Icon, items }: { title: string, icon: any, items: any[] }) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="space-y-1">
            <div className="px-3 mb-2 flex items-center gap-2">
                <Icon size={10} className="text-slate-400" />
                {(isSidebarOpen || isMobile) && (
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        {renderString(t(title), lang)}
                    </p>
                )}
            </div>
            {items.map(item => (
                <SidebarItem 
                    key={item.id} 
                    item={item} 
                    lang={lang} 
                    isActive={isItemActive(item.path)}
                    isSidebarOpen={isSidebarOpen}
                    isMobile={isMobile}
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                    onOpenChangelog={onOpenChangelog}
                    status={getStatus(item)}
                />
            ))}
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
         {/* Brand Header */}
         <div className="h-10 flex items-center justify-between px-4 border-b border-gray-50 dark:border-slate-900/50">
            <div className="flex items-center gap-2">
               <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg rotate-3">
                  <Command className="w-4 h-4" />
               </div>
               {(isSidebarOpen || isMobile) && (
                  <BrandText lang={lang} hasSystemIssues={false} />
               )}
            </div>
            {!isMobile && setIsSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
              >
                {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            )}
         </div>

         {/* Nav Sections */}
         <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-6 scrollbar-hide">
            <Section title="sidebar:shortcuts" icon={Zap} items={navigation.shortcuts} />
            <Section title="sidebar:main_menu" icon={LayoutDashboard} items={navigation.main} />
            <Section title="sidebar:app_worker" icon={Sparkles} items={navigation.worker} />
            <Section title="sidebar:data_system" icon={Database} items={navigation.entity} />
            <Section title="sidebar:administration" icon={ShieldCheck} items={navigation.admin} />
         </nav>

         {/* Footer Card */}
         {(isSidebarOpen || isMobile) && (
            <div className="p-4 pt-0">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
                    <div className="flex items-center justify-between opacity-50">
                        <span className="text-[10px] font-black uppercase tracking-widest">Studio v2</span>
                        <span className="text-[10px] font-mono">Enterprise</span>
                    </div>
                </div>
            </div>
         )}
    </div>
  );
};

