import React, { createContext, useContext, useState, useEffect } from 'react';
import { socket } from '~/lib/core';

type WorkerStatus = 'running' | 'stopped' | 'disabled' | 'processing' | 'limited' | 'UNKNOWN' | string;

interface SystemContextType {
  workerStatuses: Record<string, WorkerStatus>;
  cpu: number;
  ram: number;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [workerStatuses, setWorkerStatuses] = useState<Record<string, WorkerStatus>>({});
  const [cpu, setCpu] = useState<number>(0);
  const [ram, setRam] = useState<number>(0);

  useEffect(() => {
    const handleSystemStatus = (data: any) => {
      // Handle both broadcast (data) and response from request (data.status)
      const payload = data.status || data.payload || data;
      
      if (payload) {
        if (payload.cpu !== undefined) setCpu(Number(payload.cpu));
        if (payload.ram !== undefined) setRam(Number(payload.ram));

        if (payload.workerStatus) {
            // Normalize status: if it's an object {status, pid, uptime}, extract status string
            const normalized: Record<string, WorkerStatus> = {};
            Object.entries(payload.workerStatus).forEach(([name, status]) => {
                let s = typeof status === 'object' ? (status as any).status : status;
                const statusStr = String(s).toLowerCase();
                let finalStatus: WorkerStatus = (s as WorkerStatus); // Try to keep raw if possible for UI matching
                
                if (['ready', 'running', 'connected', 'synced', 'online', 'ready (api)', 'ready (imap)'].some(v => statusStr.includes(v))) {
                    finalStatus = 'running';
                } else if (['limited', 'ready (limited)'].includes(statusStr)) {
                    finalStatus = 'limited';
                } else if (['initializing', 'connecting', 'starting', 'syncing', 'processing', 'authenticating', 'qr_received'].some(v => statusStr.includes(v))) {
                    finalStatus = 'processing';
                } else if (['offline', 'stopped', 'error', 'disabled'].includes(statusStr)) {
                    finalStatus = 'stopped';
                }
                
                // If it's not one of our enum values, we keep the raw string but lowercase it for consistency
                // and we'll check for it in the UI.
                // However, the type says WorkerStatus. Let's cast it.
                normalized[name] = finalStatus;

                // Strip workspace ID for easier lookups if it's a workspace-specific worker
                if (name.includes(':')) {
                    const shortName = name.split(':')[0];
                    if (!normalized[shortName] || normalized[shortName] === 'stopped') {
                        normalized[shortName] = finalStatus;
                    }
                }
            });
            setWorkerStatuses(normalized);
        } else if (payload.workers && Array.isArray(payload.workers)) {
            // Fallback for legacy format if any
            const statuses: Record<string, WorkerStatus> = {};
            payload.workers.forEach((w: any) => {
            statuses[w.name] = typeof w.status === 'object' ? w.status.status : w.status;
            });
            setWorkerStatuses(prev => ({ ...prev, ...statuses }));
        }
      }
    };

    const handleIndividualWorkerStatus = (data: any) => {
        if (!data || !data.workerName) return;
        const name = (data.workspaceId && data.workspaceId !== 'system') ? `${data.workerName}:${data.workspaceId}` : data.workerName;
        const status = data.status;
        const statusStr = String(status).toLowerCase();
        
        let finalStatus: WorkerStatus = status; // Keep raw status
        if (['ready', 'running', 'connected', 'synced', 'online', 'ready (api)', 'ready (imap)'].some(v => statusStr.includes(v))) {
            finalStatus = 'running';
        } else if (['limited', 'ready (limited)'].some(v => statusStr.includes(v))) {
            finalStatus = 'limited';
        } else if (['initializing', 'connecting', 'starting', 'syncing', 'processing', 'authenticating', 'qr_received'].some(v => statusStr.includes(v))) {
            finalStatus = 'processing';
        } else if (['offline', 'stopped', 'error', 'disabled'].some(v => statusStr.includes(v))) {
            finalStatus = 'stopped';
        }

        setWorkerStatuses(prev => {
            const next: Record<string, WorkerStatus> = { ...prev, [name]: finalStatus };
            // Also update short name if applicable
            if (name.includes(':')) {
                const shortName = name.split(':')[0];
                if (!next[shortName] || next[shortName] === 'stopped') {
                    next[shortName] = finalStatus;
                }
            }
            return next;
        });
    };

    const requestStatus = () => {
      if (socket.connected) {
        socket.emit('system:status', {}, (res: any) => {
          if (res && res.success) {
            handleSystemStatus(res.status);
          }
        });
      }
    };

    socket.on('system:status', handleSystemStatus);
    socket.on('gmail:status', (data) => handleIndividualWorkerStatus({ ...data, workerName: 'gmail' }));
    socket.on('whatsapp:status', (data) => handleIndividualWorkerStatus({ ...data, workerName: 'whatsapp' }));
    socket.on('print:status', (data) => handleIndividualWorkerStatus({ ...data, workerName: 'print' }));
    socket.on('indexer:status', (data) => handleIndividualWorkerStatus({ ...data, workerName: 'indexer' }));
    socket.on('connect', requestStatus);
    
    // Initial request attempt
    requestStatus();

    return () => {
      socket.off('system:status', handleSystemStatus);
      socket.off('gmail:status');
      socket.off('whatsapp:status');
      socket.off('print:status');
      socket.off('indexer:status');
      socket.off('connect', requestStatus);
    };
  }, []);

  return (
    <SystemContext.Provider value={{ workerStatuses, cpu, ram }}>
      {children}
    </SystemContext.Provider>
  );
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
}
