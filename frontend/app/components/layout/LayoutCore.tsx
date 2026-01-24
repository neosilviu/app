import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet, useParams } from 'react-router';
import { cn, getLocalizedPath, renderString } from '~/lib/core';
import { useAuth } from '~/hooks/useAuth';
import { useConfig } from '~/hooks/useConfig';
import { useTheme } from '~/hooks/useTheme';
import { useSystem } from '~/hooks/useSystem';
import { Changelog } from '../AppModals';
import { AiFloatingAgent } from '../AiSystemUI';
import { Sidebar, Header, MobileBottomBar } from './LayoutUtils';

/**
 * DashboardLayout - The radicially simplified "Shell" of the application.
 * All complex filtering logic has been moved to useConfig.tsx and useAuth.tsx.
 * UI components are now "Dumb" and located in LayoutUtils.tsx.
 */
export default function DashboardLayout({ children, title }: { children?: React.ReactNode, title?: string }) {
  const { 
    user, 
    loading: authLoading, 
    isAdminExists, 
    navigationAuthorized 
  } = useAuth();
  
  const config = useConfig();
  const { workerStatuses } = useSystem();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useParams();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Sync sidebar preference after mount
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('sidebar_open');
    if (saved !== null) {
      try {
        setIsSidebarOpen(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Persist sidebar state
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('sidebar_open', JSON.stringify(isSidebarOpen));
    }
  }, [isSidebarOpen, isMounted]);

  // Handle Redirection logic
  useEffect(() => {
    if (!authLoading && !user && isAdminExists === true) {
      const isAuthPage = location.pathname.includes('/login') || 
                         location.pathname.includes('/register') || 
                         location.pathname.includes('/setup');
      if (!isAuthPage) {
        navigate(getLocalizedPath("/login", lang));
      }
    }
  }, [user, authLoading, isAdminExists, navigate, lang, location.pathname]);

  // Automatic Document Title
  useEffect(() => {
    const appName = config?.uiConfig?.appName || 'Studio App';
    document.title = title ? `${title} | ${appName}` : appName;
  }, [title, config?.uiConfig?.appName]);

  const isFullScreenPage = location.pathname.includes('comms') || 
                           location.pathname.includes('whatsapp') || 
                           location.pathname.includes('monitoring');

  if (authLoading || (!user && isAdminExists === true)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
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
      >
        <Sidebar
            navigation={navigationAuthorized}
            lang={lang || 'ro'}
            isSidebarOpen={isSidebarOpen} 
            setIsSidebarOpen={setIsSidebarOpen}
            onOpenChangelog={() => setIsChangelogOpen(true)}
            workerStatuses={workerStatuses}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar Content */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 z-50 md:hidden transform transition-transform duration-300 ease-in-out flex flex-col",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar
          navigation={navigationAuthorized}
          lang={lang || 'ro'}
          isSidebarOpen={true}
          isMobile={true}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onOpenChangelog={() => setIsChangelogOpen(true)}
          workerStatuses={workerStatuses}
        />
      </aside>

      {/* Main Shell */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={title}
          lang={lang || 'ro'}
          isSidebarOpen={isSidebarOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          onOpenChangelog={() => setIsChangelogOpen(true)}
        />

        <main className={cn(
          "flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950",
          isFullScreenPage ? "p-0" : "p-3 md:p-6 pb-24 md:pb-6"
        )}>
           <div className={cn("transition-all duration-300", isFullScreenPage ? "w-full h-full" : "mx-auto max-w-7xl")}>
              {children || <Outlet />}
           </div>
        </main>

        <MobileBottomBar 
          onOpenSidebar={() => setIsMobileMenuOpen(true)}
          onOpenUser={() => setIsUserMenuOpen(true)}
        />

        <Changelog 
          isOpen={isChangelogOpen} 
          onClose={() => setIsChangelogOpen(false)} 
        />
        <AiFloatingAgent />
      </div>

       {/* Mobile User Menu Overlay */}
       {isUserMenuOpen && (
            <div className="md:hidden fixed inset-0 z-[100] animate-in fade-in duration-300">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-950 rounded-t-[3rem] p-4 shadow-2xl animate-in slide-in-from-bottom-full duration-500">
                    <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6" />
                    <div className="px-6 py-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white">{renderString(user?.name)}</p>
                            <p className="text-xs text-slate-400 uppercase tracking-widest font-black">{user?.role}</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}

