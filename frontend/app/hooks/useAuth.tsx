import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { socket, whatsappSocket } from '~/lib/core';
import { brainApi } from '~/lib/core';
import { authClient } from '~/lib/core';

interface AuthContextType {
  user: any;
  users: any[];
  usersLoading: boolean;
  isAdminExists: boolean | null;
  loading: boolean;
  registerAdmin: (data: any) => Promise<any>;
  login: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  hasPermission: (permissionOrEntity: any, action?: 'create' | 'read' | 'update' | 'delete') => boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  fetchUsers: (force?: boolean) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Duplicate hook removed

export function useOptionalAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isAdminExists, setIsAdminExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async (force = false) => {
    if (!user?.workspaceId && user?.role !== 'superadmin') return;
    if (!force && users.length > 0) return; // Basic Caching (Enterprise Level 8 Optimization)
    
    setUsersLoading(true);
    try {
      const response = await brainApi.get(`workspace/users?workspaceId=${user.workspaceId || ""}`);
      if (response.data?.success) {
        setUsers(Array.isArray(response.data.data) ? response.data.data : []);
      }
    } catch (error) {
      console.error("[AUTH] Failed to fetch users", error);
    } finally {
      setUsersLoading(false);
    }
  }, [user?.workspaceId, user?.role, users.length]);

  const init = useCallback(async () => {
    try {
      console.log("[AUTH] Initializing session check...");
      const start = Date.now();
      
      // 1. Verificăm sesiunea prin Better-Auth
      // Adăugăm un mic delay pentru a evita race conditions la boot în dev
      const { data: sessionData } = await authClient.getSession();
      
      console.log(`[AUTH] getSession completed in ${Date.now() - start}ms`, sessionData?.user?.email || "No session");
      
      if (sessionData?.user) {
        setUser(sessionData.user);
        setIsAdminExists(true);
      } else {
        // Clear stale local tokens if no central session exists
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('userEmail');
        }

        // 2. Dacă nu avem sesiune, verificăm dacă există măcar un admin (pentru setup inițial)
        try {
          console.log("[AUTH] No session, checking if admin exists...");
          const res = await brainApi.get('auth/check-admin');
          const checkData = res.data?.data;
          setIsAdminExists(!!(checkData?.exists || checkData?.hasAdmin));
          console.log("[AUTH] Admin check result:", !!(checkData?.exists || checkData?.hasAdmin));
        } catch (e) {
          console.warn("[AUTH] check-admin failed:", e);
          setIsAdminExists(false);
        }
      }

      // 3. ONLY fetch local token for Local Agent authentication IF LOGGED IN
      if (typeof window !== 'undefined' && sessionData?.user) {
        try {
          const res = await brainApi.get('auth/local-token');
          const tokenRes = res.data;
          if (tokenRes?.success && tokenRes.data?.token) {
            localStorage.setItem('token', tokenRes.data.token);
            if (sessionData?.user?.email) {
              localStorage.setItem('userEmail', sessionData.user.email);
            }
          }
        } catch (e) {
          console.warn("[AUTH] Failed to fetch local token:", e);
        }
      }
    } catch (e) {
      console.error("[AUTH] Init failed:", e);
      setIsAdminExists(null); // Keep as unknown on fatal error to prevent wrong redirects
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    // Connect socket ONLY after user is authenticated AND not on login page
    const isLoginPage = typeof window !== 'undefined' && window.location.pathname.includes('/login');
    
    if (user && !socket.connected && !isLoginPage) {
      // Enterprise Level 8: Delay socket connection to allow for "Brain-Only" mode
      // If the local agent is not running, we shouldn't spam the console.
      const waitThenConnect = setTimeout(() => {
        // Level 8: Update auth token before connecting to ensure Backend v2 can verify it
        const token = localStorage.getItem('token');
        if (token) {
          (socket as any).auth = { ...socket.auth, token, email: user.email };
          (whatsappSocket as any).auth = { ...(whatsappSocket as any).auth, token, email: user.email };
        }
        
        socket.connect();
        if ((whatsappSocket as any).connect) whatsappSocket.connect();
        
        console.log("[AUTH] Authenticated user detected, connecting sockets...");
      }, 2000); // 2 second delay to prioritize UI load

      return () => clearTimeout(waitThenConnect);
    }
  }, [user]);

  useEffect(() => {
    const joinRoom = () => {
      if (user?.workspaceId && socket.connected) {
        socket.emit("workspace:join", { workspaceId: user.workspaceId });
        console.log("[AUTH] Joined workspace room:", user.workspaceId);
      }
    };

    if (socket.connected) {
      joinRoom();
    }

    socket.on('connect', joinRoom);
    return () => {
      socket.off('connect', joinRoom);
    };
  }, [user?.workspaceId]);

  const login = async (data: any) => {
    setLoading(true);
    try {
      const { data: authData, error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: "/"
      });

      if (error) {
        setLoading(false);
        throw new Error(error.message || "Login failed");
      }

      // Refresh session data
      const { data: sessionData } = await authClient.getSession();
      if (sessionData?.user) {
        setUser(sessionData.user);
        setIsAdminExists(true);

        // Get local agent token AFTER login
        try {
          const res = await brainApi.get('auth/local-token');
          const tokenRes = res.data;
          if (tokenRes?.success && tokenRes.data?.token) {
            localStorage.setItem('token', tokenRes.data.token);
            localStorage.setItem('userEmail', sessionData.user.email);
          }
        } catch (e) {
          console.warn("[AUTH] Failed to fetch local token during login:", e);
        }
      }
      
      // Delay setting loading=false to ensure a smooth transition during navigation
      setTimeout(() => setLoading(false), 500);

      // Token fetch (don't wait for it to block UI)
    } catch (err: any) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    await authClient.signOut();
    localStorage.removeItem("userEmail");
    localStorage.removeItem("token");
    
    // Disconnect sockets
    socket.disconnect();
    if ((whatsappSocket as any).disconnect) whatsappSocket.disconnect();

    setUser(null);
    window.location.href = '/login';
  };

  const registerAdmin = async (data: any) => {
    // Folosim endpoint-ul nostru de setup-admin care are permisiuni să seteze role și workspaceId
    const res = await brainApi.post('auth/setup-admin', data);
    
    if (!res.data?.success) {
      throw new Error(res.data?.error || "Setup failed");
    }

    // Mark admin as existing immediately after successful registration
    setIsAdminExists(true);
    
    // Înregistrăm info despre build pentru a fi afișat în UI
    if (typeof window !== 'undefined') {
        const build = JSON.parse(__APP_VERSION__) as BuildInfo;
        console.log(`[AUTH] Setup Admin completed with build ${build.version}-${build.hash}`);
    }

    // După succes, facem login-ul propriu-zis
    await login({ email: data.email, password: data.password });
  };

  const hasPermission = (perm: string | any, action?: string) => {
    if (!user) return false;
    
    // Administrative roles (Enterprise Level 8)
    const isAdmin = ['superadmin', 'workspace_owner', 'workspace_admin'].includes(user.role);
    if (isAdmin) return true;
    
    // Support for entity-object check
    if (typeof perm === 'object' && perm !== null) {
        if (!action) return true;
        const perms = perm.permissions || {};
        const roleKeys = [user.role || 'user'];
        const allowed = perms[action] || [];
        return roleKeys.some(r => allowed.includes(r));
    }

    return (user.permissions || []).includes(perm);
  };

  const switchWorkspace = async (id: string) => {
    try {
      const res = await brainApi.post("workspace/switch", { id });
      if (res.data?.success) {
        // Re-inițializăm auth-ul pentru a reflecta noul workspaceId în state-ul React
        await init();
        // Socket join noul workspace
        socket.emit("workspace:join", { workspaceId: id });
        window.location.reload(); // Hard refresh pentru a reîncărca configurația specifică noului workspace
      }
    } catch (e) {
      console.error("[AUTH] Switch workspace failed:", e);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      users,
      usersLoading,
      isAdminExists, 
      loading, 
      login, 
      logout, 
      registerAdmin, 
      hasPermission,
      switchWorkspace,
      fetchUsers
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      users: [],
      usersLoading: false,
      isAdminExists: null,
      loading: false,
      login: async () => { console.warn("useAuth: login called outside AuthProvider") },
      logout: async () => {},
      registerAdmin: async () => ({}),
      hasPermission: () => false,
      switchWorkspace: async () => {},
      fetchUsers: async () => {},
    } as AuthContextType;
  }
  return context;
}
