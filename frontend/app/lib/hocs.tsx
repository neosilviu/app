import React from 'react';
import { PermissionGate } from '../components/ControlGates';
import { useSystem } from '../hooks/useSystem';
import { useAuth } from '../hooks/useAuth';
import { WorkerOfflineOverlay } from '../components/SystemShell';

/**
 * Higher-Order Component to protect pages with a specific permission.
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: string
): React.ComponentType<P> {
  return function ProtectedPage(props: P) {
    return (
      <PermissionGate permission={permission}>
        <Component {...props} />
      </PermissionGate>
    );
  };
}

/**
 * Higher-Order Component to guard pages with worker status checks.
 */
export function withWorkerGuard<P extends object>(
  Component: React.ComponentType<P>,
  workerName: string,
  displayName?: string
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    const { workerStatuses } = useSystem();
    const { user } = useAuth();
    
    const wsId = user?.workspaceId;
    const status = (wsId && workerStatuses[`${workerName}:${wsId}`]) || workerStatuses[workerName] || 'UNKNOWN';

    if (status === 'stopped' || status === 'disabled') {
      return (
          <WorkerOfflineOverlay 
            workerName={displayName || workerName}
            status={status}
          />
      );
    }

    return <Component {...props} />;
  };
}
