import React, { useEffect } from 'react';
import { useAuth } from '~/hooks/useAuth';
import { useNavigate, useParams, useLocation } from 'react-router';
import { getLocalizedPath } from '~/lib/core';

interface PermissionGateProps {
    children: React.ReactNode;
    permission?: string;
    role?: string | string[];
    fallback?: React.ReactNode;
}

/**
 * PermissionGate - Protects children based on user permissions or roles.
 */
export function PermissionGate({ children, permission, role, fallback = null }: PermissionGateProps) {
    const auth = useAuth();
    if (!auth) return <>{fallback}</>;
    
    const { user, hasPermission } = auth;
    if (!user) return <>{fallback}</>;

    // Administrative roles (Enterprise Level 10)
    const isAdmin = ['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role);
    if (isAdmin) return <>{children}</>;

    // Check role if specified
    if (role) {
        const roles = Array.isArray(role) ? role : [role];
        if (!roles.includes(user.role)) return <>{fallback}</>;
    }

    // Check permission if specified
    if (permission && !hasPermission(permission)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * SuperAdminGate - Wraps children and handles auth loading state and initial setup redirect.
 */
export function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  
  // If we are outside AuthProvider (e.g. error boundary or early layout), just render children
  if (!auth) return <>{children}</>;

  const { loading: authLoading, isAdminExists, user } = auth;
  const navigate = useNavigate();
  const { lang } = useParams();
  const location = useLocation();

  useEffect(() => {
    // Enterprise Level 10: Logic for initial setup redirection
    // We only redirect if:
    // 1. Not loading
    // 2. Not logged in
    // 3. System specifically reports NO admin exists
    // 4. Not already on setup/login pages
    if (user || authLoading || isAdminExists === null) return;

    if (isAdminExists === false && !location.pathname.includes('/setup') && !location.pathname.includes('/login')) {
      navigate(getLocalizedPath('/setup', lang));
    }
  }, [authLoading, isAdminExists, navigate, lang, location.pathname, user]);

  if (authLoading) {
    // Fast-unblock UX: render app immediately and show a small non-blocking status badge.
    // This mirrors app-v3 behaviour where the UI is interactive while auth finishes in background.
    return (
      <>
        {children}
        <div className="fixed top-4 right-4 z-[9999] pointer-events-none">
          <div className="inline-flex items-center gap-3 rounded-md px-3 py-2 bg-muted/10 text-sm text-muted-foreground shadow-lg backdrop-blur-sm">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Checking session...</span>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}

/**
 * ErrorBoundary - Basic error handling for routes.
 */
export function ErrorBoundary({ children, error }: { children?: React.ReactNode; error?: any }) {
    if (error) {
        return (
            <div className="p-8 m-4 bg-destructive/10 border border-destructive/20 rounded-xl text-center space-y-4">
                <h2 className="text-xl font-bold text-destructive">Component Error</h2>
                <p className="text-muted-foreground">{error?.message}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                >
                    Reload Page
                </button>
            </div>
        );
    }
    return <>{children}</>;
}
