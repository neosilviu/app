import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket, socketRequest } from '~/lib/core';
import { useConfig } from '~/hooks/useConfig';
import { useAuth } from '~/hooks/useAuth';

interface Settings {
  [key: string]: any;
}

interface SettingsContextType {
  settings: Settings;
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { constants, isInitialized } = useConfig();
  const { isAdminExists, user } = useAuth() || { isAdminExists: null, user: null };
  const useLocalAgent = constants?.SYSTEM_SETTING?.use_local_agent === true;
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Enterprise Level 8: Skip backend fetch if we are in Setup phase (No Admin)
      // or if we don't have a logged-in user yet (socket won't be connected),
      // OR if Local Agent is disabled in Registry.
      if (isAdminExists === false || !user || !useLocalAgent) {
          const registrySettings = constants?.SYSTEM_SETTING || {};
          setSettings(registrySettings);
          setLoading(false);
          return;
      }

      const response = await Promise.race([
        socketRequest('system:get-settings'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Socket timeout')), 2000))
      ]).then(res => res as any).catch(err => {
        console.warn('[SETTINGS] Local socket fetch failed, falling back to Registry:', err.message);
        return null;
      });

      if (response?.success && response?.settings) {
        setSettings(response.settings);
      } else if (isInitialized) {
        const registrySettings = constants?.SYSTEM_SETTING || {};
        setSettings(registrySettings);
      }
    } catch (err: any) {
      console.warn('[SETTINGS] Failed to fetch settings:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshSettings = async () => {
    await fetchSettings();
  };

  useEffect(() => {
    if (isInitialized) {
        fetchSettings();
    }

    const handleSettingsUpdate = () => {
      fetchSettings();
    };

    if (useLocalAgent) {
        socket.on('system:settings-updated', handleSettingsUpdate);
        socket.on('connect', fetchSettings);
    }

    return () => {
      if (useLocalAgent) {
          socket.off('system:settings-updated', handleSettingsUpdate);
          socket.off('connect', fetchSettings);
      }
    };
  }, [isInitialized, useLocalAgent]);

  return (
    <SettingsContext.Provider value={{ settings, loading, error, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

