import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { socket, whatsappSocket } from '~/lib/core';
import { api } from '~/lib/core';
import { authClient } from '~/lib/core';
import { useConfig } from "./useConfig";

interface AuthContextType {
  user: any;
  userList: any[];
  userLoading: boolean;
  isAdminExists: boolean | null;
  loading: boolean;
  registerAdmin: (data: any) => Promise<any>;
  login: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  hasPermission: (permissionOrEntity: any, action?: 'create' | 'read' | 'update' | 'delete') => boolean;
  hasPageAccess: (pageId: string) => boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  fetchUserList: (force?: boolean) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Duplicate hook removed

export function useOptionalAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [userList, setUserList] = useState<any[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [isAdminExists, setIsAdminExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const config = useConfig();
  const useLocalAgent = config?.constants?.SYSTEM_SETTING?.use_local_agent === true;

  const fetchUserList = useCallback(async (force = false) => {
    if (!user) return;
    
    const roleDef = config?.constants?.SYSTEM_ROLE?.[user.role];
    const isGlobal = roleDef?.permission?.includes('*');
    if (!user.workspaceId && !isGlobal) return;
    
    if (!force && userList.length > 0) return; // Basic Caching (Enterprise Level 8 Optimization)
    
    setUserLoading(true);
    try {
      const response = await api.brain.get(`workspace/member?workspaceId=${user.workspaceId || ""}`);
      if (response.data?.success) {
        setUserList(Array.isArray(response.data.data) ? response.data.data : []);
      }
    } catch (error) {
      console.error("[AUTH] Failed to fetch user list", error);
    } finally {
      setUserLoading(false);
    }
  }, [user?.workspaceId, user?.role, userList.length]);

  const init = useCallback(async () => {
    try {
      const { data: sessionData } = await authClient.getSession();
      
      if (sessionData?.user) {
        setUser(sessionData.user);
        setIsAdminExists(true);
      } else {
        console.log("[AUTH] No active session, checking for admin user...");
        // Use 'check-admin' directly (not /api/auth/) to avoid interception by Better-Auth middleware
        const res = await api.brain.get(`check-admin?t=${Date.now()}`);
        const exists = !!res.data?.data?.exists;
        console.log(`[AUTH] Admin exists: ${exists}`);
        setIsAdminExists(exists);
      }

      if (sessionData?.user) {
        try {
          const res = await api.brain.get('auth/local-token');
          const tokenRes = res.data;
          if (tokenRes?.success && tokenRes.data?.token) {
            localStorage.setItem('token', tokenRes.data.token);
            if (sessionData?.user?.email) {
              localStorage.setItem('userEmail', sessionData.user.email);
            }
          }
        } catch (e) {}
      }
    } catch (e: any) {
      console.error("[AUTH-FATAL] Initialization failed:", e);
      // Fallback: If backend is down/crashing, assume admin exists to prevent setup loop if possible, 
      // OR let the user see the login page.
      setIsAdminExists(true); 
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
    const useLocalAgent = config?.constants?.SYSTEM_SETTING?.use_local_agent === true;
    
    if (user && !isLoginPage && useLocalAgent) {
      if (socket.connected) return;

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
        
        console.warn("⚠️ [SOCKET.IO] ACTIVATING CONNECTION - Authenticated user detected");
      }, 2000); // 2 second delay to prioritize UI load

      return () => clearTimeout(waitThenConnect);
    } else {
      // Enterprise Level 8: Force disconnect if local agent is disabled or user logged out
      if (socket.connected) {
        socket.disconnect();
        console.log("[AUTH] Disconnecting socket (Local Agent disabled or session inactive)");
      }
      if ((whatsappSocket as any).connected) {
        (whatsappSocket as any).disconnect();
      }
    }
  }, [user, useLocalAgent]);

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
          const res = await api.brain.get('auth/local-token');
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
      return { success: true };
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
    const res = await api.brain.post('auth/setup-admin', data);
    
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
    return res.data;
  };

  const hasPermission = (perm: string | any, action?: string) => {
    if (!user) return false;
    
    // Enterprise Level 8: Registry-Driven Permission Check
    const roles = config?.constants?.SYSTEM_ROLE || {};
    const roleDef = roles[user.role];
    
    if (roleDef?.permission?.includes('*')) return true;
    
    // Support for entity-object check
    if (typeof perm === 'object' && perm !== null) {
        if (!action) return true;
        const perms = perm.permission || {};
        const roleKeys = [user.role || 'user'];
        const allowed = perms[action] || [];
        return roleKeys.some(r => allowed.includes(r));
    }

    return (user.permission || []).includes(perm) || (roleDef?.permission || []).includes(perm);
  };

  const hasPageAccess = (pageId: string) => {
    if (!user) return false;
    
    const roles = config?.constants?.SYSTEM_ROLE || {};
    const roleDef = roles[user.role];
    
    if (roleDef?.permission?.includes('*')) return true;
    if (!roleDef) return false;

    const allowed = roleDef.allowedPage || [];
    if (allowed.includes('*')) return true;

    // Entities are handled via 'entity' group or specific ID
    if (pageId.startsWith('entity:')) {
       return allowed.includes('entity') || allowed.includes(pageId);
    }

    // Workers are handled via 'workers' group or specific ID
    if (pageId.startsWith('worker:')) {
       return allowed.includes('workers') || allowed.includes(pageId);
    }

    return allowed.includes(pageId);
  };

  const switchWorkspace = async (id: string) => {
    try {
      const res = await api.brain.post("workspace/switch", { id });
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
      userList,
      userLoading,
      isAdminExists, 
      loading, 
      login, 
      logout, 
      registerAdmin, 
      hasPermission,
      hasPageAccess,
      switchWorkspace,
      fetchUserList
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
      userList: [],
      userLoading: false,
      isAdminExists: null,
      loading: false,
      login: async () => { console.warn("useAuth: login called outside AuthProvider") },
      logout: async () => {},
      registerAdmin: async () => ({}),
      hasPermission: () => false,
      hasPageAccess: () => false,
      switchWorkspace: async () => {},
      fetchUserList: async () => {},
    } as AuthContextType;
  }
  return context;
}
