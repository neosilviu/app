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

    // Administrative roles (Enterprise Level 8)
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
    // Fail-safe: If we are already logged in, we NEVER redirect to setup
    if (user) return;

    // If we know for sure there is no admin, redirect to setup (unless already there OR on login)
    const isSetupPage = location.pathname.includes('/setup');
    const isLoginPage = location.pathname.includes('/login');
    
    if (isAdminExists === false && !isSetupPage && !isLoginPage) {
      console.log("[Auth] No admin exists, redirecting to setup");
      navigate(getLocalizedPath('/setup', lang));
    }
  }, [isAdminExists, navigate, lang, location.pathname, user]);

  if (authLoading) {
    return (
      <div key="system-check" className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground animate-pulse font-medium">Checking session...</p>
        </div>
      </div>
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
                <p className="text-muted-foreground">{error?.message || "An unexpected error occurred."}</p>
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
