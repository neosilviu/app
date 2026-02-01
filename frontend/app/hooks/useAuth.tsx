import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
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


  // Cache to prevent duplicate API calls
  const fetchingUserListRef = useRef(false);
  const lastWorkspaceIdRef = useRef<string>('');

  const fetchUserList = useCallback(async (force = false) => {
    if (!user) return;
    
    const roleDef = config?.constants?.SYSTEM_ROLE?.[user.role];
    const isGlobal = roleDef?.permission?.includes('*');
    if (!user.workspaceId && !isGlobal) return;
    
    if (!force && userList.length > 0) return; // Basic Caching (Enterprise Level 8 Optimization)
    if (fetchingUserListRef.current) return; // Prevent duplicate calls
    
    fetchingUserListRef.current = true;
    setUserLoading(true);
    try {
      const response = await api.brain.get(`workspace/member?workspaceId=${user.workspaceId || ""}`);
      if (response && response.success) {
        setUserList(Array.isArray(response.data) ? response.data : []);
      }
    } finally {
      setUserLoading(false);
      fetchingUserListRef.current = false;
    }
  }, [user?.workspaceId, user?.role, config]);

  const init = useCallback(async () => {
    try {
      const { data: sessionData } = await authClient.getSession();
      
      if (sessionData?.user) {
        setUser(sessionData.user);
        setIsAdminExists(true);
      } else {
        // Use 'auth/check-admin' directly (not /api/auth/) to avoid interception by Better-Auth middleware
        const res = await api.brain.get(`auth/check-admin?t=${Date.now()}`);
        // Enterprise Level 8: Ensure we check inside 'data' property of the response
        const exists = !!(res?.data?.exists ?? res?.exists);
        setIsAdminExists(exists);
      }

      if (sessionData?.user) {
        const res = await api.brain.get('auth/local-token');
        const tokenRes = res?.data || res;
        if (tokenRes?.token) {
          localStorage.setItem('token', tokenRes.token);
          if (sessionData?.user?.email) {
            localStorage.setItem('userEmail', sessionData.user.email);
          }
        }
      }
    } catch (err: any) {
      console.error("[AUTH-INIT-ERROR]", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentWorkspaceId = user?.workspaceId || '';
    if (lastWorkspaceIdRef.current !== currentWorkspaceId) {
      // Clear cache when user workspace changes
      fetchingUserListRef.current = false;
      setUserList([]); // Clear userList for new workspace
      lastWorkspaceIdRef.current = currentWorkspaceId;
    }
  }, [user?.workspaceId]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    // Connect socket ONLY after user is authenticated AND not on login page AND Local Agent is enabled
    const isLoginPage = typeof window !== 'undefined' && window.location.pathname.includes('/login');
    
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
      // This ensures we never spam with connection errors on production when Local Agent is false
      if (socket.connected) {
        socket.disconnect();
        console.log("[AUTH] Disconnecting socket (Local Agent disabled or session inactive)");
      }
      if ((whatsappSocket as any).connected) {
        (whatsappSocket as any).disconnect();
      }
    }
  }, [user, useLocalAgent, config?.constants?.SYSTEM_SETTING?.use_local_agent]);

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
        const res = await api.brain.get('auth/local-token');
        const tokenRes = res.data;
        if (tokenRes?.success && tokenRes.data?.token) {
          localStorage.setItem('token', tokenRes.data.token);
          localStorage.setItem('userEmail', sessionData.user.email);
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

  const registeringRef = useRef(false);

  const registerAdmin = async (data: any) => {
    // Enterprise Level 8: Concurrent Guard to prevent double-submission
    if (registeringRef.current) {
        console.warn("[AUTH] Registration already in progress, ignoring duplicate call.");
        return { success: true };
    }
    
    registeringRef.current = true;
    try {
      // Folosim endpoint-ul nostru de setup-admin care are permisiuni să seteze role și workspaceId
      try {
        const res = await api.brain.post('auth/setup-admin', data);
        
        if (!res?.success) {
          throw new Error(res?.error || "Setup failed");
        }
      } catch (err: any) {
        const errorMsg = err.response?.error || err.message || "";
        // Enterprise Level 8: Idempotency support. If admin already exists, we just proceed to login.
        // This handles double-clicks or browser retries where the first request actually succeeded.
        if (errorMsg.includes('already exist') || errorMsg.includes('deja configurat')) {
          console.log("[AUTH] Admin already exists (idempotent setup), proceeding to login.");
        } else {
          throw new Error(errorMsg || "Setup failed");
        }
      }

      // Mark admin as existing immediately
      setIsAdminExists(true);
      
      // Înregistrăm info despre build pentru a fi afișat în UI
      if (typeof window !== 'undefined') {
          const build = JSON.parse(__APP_VERSION__) as BuildInfo;
          console.log(`[AUTH] Setup Admin completed with build ${build.version}-${build.hash}`);
      }

      // După succes, facem login-ul propriu-zis
      await login({ email: data.email, password: data.password });
      return { success: true };
    } finally {
      registeringRef.current = false;
    }
  };

  const hasPermission = useCallback((perm: string | any, action?: string) => {
    if (!user) return false;
    
    // Enterprise Level 8: Registry-Driven Permission Check
    const roles = config?.constants?.SYSTEM_ROLE || {};
    const roleDef = roles[user.role];
    
    // 1. SuperAdmin / Wildcard Bypass
    if (user.role === 'superadmin' || roleDef?.permission?.includes('*')) return true;
    
    // 2. Individual User Overrides (Object Format: { "contact": { "read": true } } or Array Format: ["contact:read"])
    const userRaw = user.permission || [];
    const userPerms = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw;

    if (typeof perm === 'string') {
        // Handle string permission check like "contact:read"
        if (Array.isArray(userPerms)) {
            if (userPerms.includes(perm) || userPerms.includes('*')) return true;
        } else if (typeof userPerms === 'object' && userPerms !== null) {
            const [entity, act] = perm.split(':');
            const entityData = userPerms[entity];
            if (entityData) {
                // Enterprise Level 8: Canonical Mappings for Action Synonyms
                const synMap: Record<string, string[]> = {
                    'read': ['read', 'view', 'list'],
                    'create': ['create', 'add', 'insert'],
                    'update': ['update', 'edit', 'save', 'modify'],
                    'delete': ['delete', 'remove', 'destroy']
                };
                const potentialActions = synMap[act] || [act];

                if (potentialActions.some(a => entityData[a] === true)) return true;
                if (entityData['*'] === true) return true;
                if (entityData[act] === false) return false; // Explicit Deny
            }
        }
    }

    // 3. Support for internal entity-object check (Legacy/Compatibility)
    if (typeof perm === 'object' && perm !== null) {
        if (!action) return true;
        const entityPerms = perm.permission || {};
        const allowed = entityPerms[action] || [];
        if (allowed.includes(user.role || 'user')) return true;
    }

    // 4. Fallback to Role-level permissions (Baseline)
    return (roleDef?.permission || []).includes(perm);
  }, [user, config]);

  const hasPageAccess = useCallback((pageId: string) => {
    if (!user) return false;
    
    const roles = config?.constants?.SYSTEM_ROLE || {};
    const roleDef = roles[user.role];
    
    if (roleDef?.permission?.includes('*')) return true;
    if (!roleDef) return false;

    const allowed = roleDef.allowedPage || [];
    if (allowed.includes('*')) return true;

    // Support for group checks and entity/worker auto-discovery
    const entities = config?.entity || {};
    const isEntity = !!entities[pageId];
    const isWorker = (config?.navigation?.worker || []).some((i: any) => i.id === pageId);

    // Enterprise Level 8: Dynamic Access for Entities and Workers
    if (pageId.startsWith('entity:') || isEntity) {
       const entityName = pageId.startsWith('entity:') ? pageId.replace('entity:', '') : pageId;
       
       // 1. Explicit permission ALWAYS wins (Entity-level RBAC)
       const hasPerm = hasPermission(`${entityName}:read`) || 
                       hasPermission(`${entityName}:view`) || 
                       hasPermission(`${entityName}:manage`) ||
                       hasPermission(`${entityName}:*`) ||
                       hasPermission('workspace:manage') ||
                       hasPermission('entity:manage');
       if (hasPerm) return true;
       
       // 2. Admin/Superadmin bypass via role-level wildcard
       if (roleDef?.permission?.includes('*')) return true;

       // 3. System Entity Protection (Level 8 Security Gate)
       // Never show internal system entities via generic group access like 'entity'
       const coreEntities = (config?.constants?.CONSTANT?.coreEntity || [
           'audit_log', 'config_version', 'system_setting', 'user', 'session', 'role', 'blueprint'
       ]).map((e: string) => e.toLowerCase());
       
       const entityCfg = config?.entity?.[entityName];
       
       const isSystem = coreEntities.includes(entityName.toLowerCase()) || !!entityCfg?.isSystem;
       const isAdminCategory = entityCfg?.menuConfig?.category === 'administration';
       
       // If it's a system entity or admin-only category, it requires explicit permission OR admin role (Level 8 Protection)
       if (isSystem || isAdminCategory) {
           const hasLevel8Admin = roleDef?.allowedPage?.includes('*') || roleDef?.permission?.includes('*');
           if (!hasPerm && !hasLevel8Admin) return false;
       }

       // 4. Generic Group Access (Only for non-system/business entities)
       const cleanId = pageId.startsWith('entity:') ? pageId : `entity:${pageId}`;
       
       // If explicitly allowed by ID, then it's fine
       if (allowed.includes(cleanId) || allowed.includes(pageId)) return true;

       // If generic 'entity' group is allowed, we still want to filter by at least ONE basic permission
       // This ensures that roles like 'Member' only see entities they can actually interact with.
       if (allowed.includes('entity')) {
          const hasActionPerm = hasPermission(`${entityName}:read`) || 
                               hasPermission(`${entityName}:view`) || 
                               hasPermission(`${entityName}:manage`) ||
                               hasPermission(`${entityName}:create`) ||
                               hasPermission(`${entityName}:*`);
          
          if (hasActionPerm) return true;

          // SPECIAL CAVEAT: "Newly created ones"
          // If an entity is NOT a system entity and was just added, and the user has 'workspace:manage' or similar, 
          // we might want to show it. But for now, we stick to explicit permissions.
       }

       return false;
    }

    if (pageId.startsWith('worker:') || isWorker) {
       const workerName = pageId.startsWith('worker:') ? pageId.replace('worker:', '') : pageId;
       const hasPerm = hasPermission(`${workerName}:manage`) || hasPermission(`${workerName}:view`);
       if (hasPerm) return true;

       const cleanId = pageId.startsWith('worker:') ? pageId : `worker:${pageId}`;
       return allowed.includes('worker') || allowed.includes('workers') || allowed.includes(cleanId) || allowed.includes(pageId);
    }

    // Default: Check explicit page list
    return allowed.includes(pageId) || allowed.includes('*');
  }, [user, config, hasPermission]);

  const switchWorkspace = useCallback(async (id: string) => {
    const res = await api.brain.post("workspace/switch", { id });
    if (res?.success) {
      // Re-inițializăm auth-ul pentru a reflecta noul workspaceId în state-ul React
      await init();
      // Socket join noul workspace
      socket.emit("workspace:join", { workspaceId: id });
      window.location.reload(); // Hard refresh pentru a reîncărca configurația specifică noului workspace
    }
  }, [init]);

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
