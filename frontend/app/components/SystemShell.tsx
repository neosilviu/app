import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from "react-router";
import { socket, getLocalizedPath, renderString } from '~/lib/core';
import { RefreshCw, WifiOff, AlertCircle, Wifi, Zap, ZapOff, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useTheme } from '~/hooks/useTheme';
import { useConfig } from '~/hooks/useConfig';

/**
 * ConnectionManager - Monitors the connection to the backend and automatically
 * refreshes the page when the connection is restored after a failure.
 * CLIENT-ONLY: This component uses hooks and must not be rendered on the server.
 */
export const ConnectionManager: React.FC = () => {
  // Skip rendering on server side
  if (typeof window === 'undefined') return null;

  const [isConnected, setIsConnected] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isIntentionalDisconnect, setIsIntentionalDisconnect] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'online' | 'down'>('online');
  const [countdown, setCountdown] = useState<number | null>(null);
  const { autoRefreshEnabled, toggleAutoRefresh } = useTheme();
  const { t } = useTranslation();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const checkBackendHealth = useCallback(async () => {
    // If it's an intentional disconnect, we don't need to check health
    if (isIntentionalDisconnect) return true;

    try {
      // Try to fetch the health endpoint
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (response.ok) {
        if (backendStatus === 'down') {
          console.log('[CONNECTION] Backend is back online! Starting countdown...');
          setBackendStatus('online');
          
          // Start 5 second countdown before reload only if auto refresh is enabled
          // AND the socket is NOT trying to reconnect on its own
          if (autoRefreshEnabled && !socket.connected) {
            setCountdown(5);
          }
        }
        return true;
      }
    } catch (e) {
      // Still down
    }
    setBackendStatus('down');
    return false;
  }, [backendStatus, autoRefreshEnabled, isIntentionalDisconnect]);

  // Countdown logic
  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      // If we are already connected via socket, don't reload
      if (socket.connected) {
        setCountdown(null);
        return;
      }
      window.location.reload();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    const onConnect = () => {
      console.log('[CONNECTION] Connected to socket server');
      setIsConnected(true);
      setIsReconnecting(false);
      setIsIntentionalDisconnect(false);
      setBackendStatus('online');
      setCountdown(null); // Cancel any pending reload
    };

    const onDisconnect = (reason: string) => {
      // If it's an intentional client-side disconnect (e.g. token refresh), ignore completely
      if (reason === 'io client disconnect') {
        setIsIntentionalDisconnect(true);
        setIsConnected(true);
        return;
      }

      console.log('[CONNECTION] Disconnected:', reason);
      setIsConnected(false);
      setIsIntentionalDisconnect(false);
      setBackendStatus('down');

      if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'ping timeout') {
        setIsReconnecting(true);
      }
    };

    const onConnectError = (error: Error) => {
      console.error('[CONNECTION] Connection error:', error.message);
      setIsConnected(false);
      setIsIntentionalDisconnect(false);
      setBackendStatus('down');
      setIsReconnecting(true);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // If already connected when component mounts
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [isConnected]);

  // Health check polling when disconnected
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (!isConnected || isReconnecting) {
      intervalId = setInterval(() => {
        checkBackendHealth();
      }, 10000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isConnected, isReconnecting, checkBackendHealth]);

  // If connected, show nothing
  if (isConnected && backendStatus === 'online' && countdown === null) {
    return null;
  }

  // Enterprise Level 10: Permanent elimination of the bottom connection secondary message
  // We keep the health check logic but stop rendering the overlay to avoid blocking the UI
  return null;
};

interface WorkerOfflineOverlayProps {
  workerName: string;
  status: 'stopped' | 'disabled' | 'UNKNOWN';
  onRetry?: () => void;
  onNavigateToMonitoring?: () => void;
}

/**
 * WorkerOfflineOverlay - Fullscreen overlay displayed when a required worker is offline.
 */
export const WorkerOfflineOverlay: React.FC<WorkerOfflineOverlayProps> = ({
  workerName,
  status,
  onRetry = () => window.location.reload(),
  onNavigateToMonitoring = () => window.location.href = '/monitoring'
}) => {
  const { t } = useTranslation();
  const isDisabled = status === 'disabled';

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-8">
        <AlertCircle className="w-12 h-12 text-amber-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {isDisabled ? t('common.worker_disabled', { name: workerName }) : t('common.worker_offline', { name: workerName })}
      </h2>
      <p className="text-gray-500 max-w-md mb-8">
        {isDisabled 
          ? t('common.worker_disabled_desc')
          : t('common.worker_offline_desc', { name: workerName })}
      </p>
      <div className="flex gap-4">
        <button 
          onClick={onNavigateToMonitoring}
          className="px-6 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          {t('common.go_to_monitoring')}
        </button>
        <button 
          onClick={onRetry}
          className="px-6 py-3 bg-gray-50 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all border border-gray-200 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('common.retry')}
        </button>
      </div>
    </div>
  );
};

/**
 * ShortcutManager - Global keyboard shortcut handler.
 */
export function ShortcutManager() {
  const navigate = useNavigate();
  const { lang } = useParams();
  const { theme, setTheme, customTheme } = useTheme();
  const { uiConfig, entity } = useConfig();
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        if (e.key === "Escape") {
            (document.activeElement as HTMLElement).blur();
        }
        if (!e.ctrlKey && !e.altKey && !e.metaKey) return;
      }

      // Priority: Custom Theme Shortcuts > UI Config Defaults
      const dynamicShortcuts = customTheme?.shortcuts || uiConfig.shortcuts || [];
      const shortcut = dynamicShortcuts.find((s: any) => {
        const matchesKey = e.key.toLowerCase() === s.key.toLowerCase();
        const matchesModifier = 
          !!e.ctrlKey === !!s.ctrlKey && 
          !!e.altKey === !!s.altKey && 
          !!e.shiftKey === !!s.shiftKey && 
          !!e.metaKey === !!s.metaKey;
        
        return matchesKey && matchesModifier;
      });

      if (shortcut) {
        e.preventDefault();
        
        switch (shortcut.action) {
          case "open-search":
            window.dispatchEvent(new CustomEvent("studio-open-search"));
            break;
          case "open-search-ai":
            window.dispatchEvent(new CustomEvent("studio-open-search-ai"));
            break;
          case "open-search-file":
            window.dispatchEvent(new CustomEvent("studio-open-search-file"));
            break;
          case "toggle-theme":
            setTheme(theme === "dark" ? "light" : "dark");
            toast.info(t('common.theme_switched', { theme: theme === "dark" ? "Light" : "Dark" }));
            break;
          case "go-dashboard": navigate(getLocalizedPath("/", lang)); break;
          case "go-monitoring": navigate(getLocalizedPath("/monitoring", lang)); break;
          case "go-profile": navigate(getLocalizedPath("/profile", lang)); break;
          case "go-help":
            window.dispatchEvent(new CustomEvent("studio-open-help"));
            break;
          default:
            // Handle dynamic entity shortcuts
            const action = shortcut.action as string;
            
            // 1. Navigation (nav:entity_id)
            if (action.startsWith("nav:")) {
              const entityId = action.split('?')[0].replace('nav:', '');
              const entityDef = (entity as any)[entityId];
              navigate(getLocalizedPath(`/${action.replace('nav:', '')}`, lang));
              toast.info(t('common.navigating_to', { label: renderString(entityDef?.labelPlural || entityDef?.label, lang) || entityId }));
            }
            // 2. Creation (new:entity_id)
            else if (action.startsWith("new:")) {
              const entityId = action.replace('new:', '');
              const entityDef = (entity as any)[entityId];
              navigate(getLocalizedPath(`/${entityId}/new`, lang));
              toast.success(t('common.opening_form', { label: renderString(entityDef?.label, lang) || entityId }));
            }
            // 3. List/Board (list:entity_id)
            else if (action.startsWith("list:")) {
              const entityId = action.replace('list:', '');
              const entityDef = (entity as any)[entityId];
              navigate(getLocalizedPath(`/${entityId}`, lang));
              toast.info(t('common.navigating_to', { label: renderString(entityDef?.labelPlural || entityDef?.label, lang) || entityId }));
            }
            break;
        }
        return;
      }

      // Check static entity shortcuts (legacy/fallback)
      Object.entries(entity).forEach(([id, config]: [string, any]) => {
        // If there's an override in theme for this entity, it was already handled above
        const hasOverride = dynamicShortcuts.some((s: any) => s.action === `nav:${id}`);
        if (hasOverride) return;

        if (config.shortcut) {
           const s = config.shortcut;
           const matchesKey = e.key.toLowerCase() === s.key.toLowerCase();
           const matchesModifier = 
             !!e.ctrlKey === !!s.ctrlKey && 
             !!e.altKey === !!s.altKey && 
             !!e.shiftKey === !!s.shiftKey && 
             !!e.metaKey === !!s.metaKey;
           
           if (matchesKey && matchesModifier) {
             e.preventDefault();
             navigate(getLocalizedPath(`/${id}`, lang));
             toast.info(t('common:navigating_to', { label: renderString(config.labelPlural || config.label, lang) }));
           }
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, theme, setTheme, uiConfig, entity]);

  return null;
}

