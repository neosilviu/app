import { type Route } from "../../.react-router/types/app/routes/+types/($lang)._app.settings";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";
import { 
    socket,
    api,
    cn,
    socketRequest,
    debounce,
    renderString
} from '~/lib/core';
import { useAuth } from '~/hooks/useAuth';
import { useConfig } from '~/hooks/useConfig'; 
import { useTheme } from '~/hooks/useTheme'; 
import { toast } from 'sonner';
import { 
    Building, Globe, Bell, MessageSquare, Zap, ShieldCheck, Lock, 
    Plus, RefreshCw, Mail, ExternalLink, Settings, Clock, Sparkles, 
    Brain, Bot, CheckCheck, Trash2, AlertTriangle, X, Database, 
    Cloud, RefreshCcw, Search, ChevronLeft, ChevronRight, UserPlus, 
    Save, Code, Users, Briefcase, User, Activity, ShieldAlert, 
    Rocket, Layers, Palette, Sun, Moon, Laptop, Send, 
    Settings2, LogOut, LayoutDashboard
} from 'lucide-react';
import { ThemeEditor } from '~/components/ThemeSystem';
import { Badge } from "~/components/ui/badge";
import { GlassCard } from '~/components/ui/GlassCard';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "~/components/ui/accordion";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, 
    DialogTrigger, DialogFooter, DialogDescription 
} from "~/components/ui/dialog";
import { 
    Select, SelectContent, SelectGroup, SelectItem, 
    SelectLabel, SelectSeparator, SelectTrigger, SelectValue 
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { Separator } from "~/components/ui/separator";
import { ConfirmDestructiveAction } from '~/components/AppModals';
import { useTranslation } from 'react-i18next';
import { verifyAuth } from '~/lib/auth-core.server';
import { getDb } from '~/lib/d1.server';
import { REGISTRY_BASELINE } from '~/lib/core';

// --- SUB-COMPONENTS (OPTIMIZED) ---
import { GeneralTab } from '~/components/settings/GeneralTab';
import { AITab } from '~/components/settings/AITab';
import { CommsTab } from '~/components/settings/CommsTab';
import { UsersTab } from '~/components/settings/UsersTab';
import { BufferedInput, BufferedTextarea } from '~/components/ui/BufferedInput';

export async function loader({ params, request, context }: Route.LoaderArgs) {
    const env = (context as any).cloudflare?.env || (process as any).env;
    const user = await verifyAuth(request, env);
    
    if (!user) return { lang: params.lang, permissions: [] };

    const db = getDb(env);
    
    // Fetch data in parallel to optimize load time (Enterprise Level 8)
    let workspace = null;
    let rbacData = null;
    let workspacesList: any[] = [];
    let systemSettings: Record<string, any> = {};

    try {
        // Use Promise.all for parallel fetches
        const promises: any[] = [
            db.get("workspace", user.workspaceId),
            db.get("workspace_rbac", user.workspaceId),
            user.role === 'superadmin' 
                ? db.list("workspace", { archived: 0 })
                : db.get("workspace", user.workspaceId).then(ws => ws ? [ws] : [])
        ];

        if (user.role === 'superadmin') {
            promises.push(db.query('SELECT namespace, key, value, dataType FROM system_setting'));
        }

        const results = await Promise.allSettled(promises);

        workspace = results[0].status === 'fulfilled' ? (results[0].value as any) : null;
        rbacData = results[1].status === 'fulfilled' ? (results[1].value as any) : null;
        workspacesList = results[2].status === 'fulfilled' ? (results[2].value || []) : [];

        if (user.role === 'superadmin' && results[3]?.status === 'fulfilled') {
            const sysRows = (results[3].value as any) || [];
            sysRows.forEach((row: any) => {
                const rawNs = row.namespace || 'system_setting';
                const ns = rawNs.toLowerCase(); // Lowercase for UI consistency (gmail, whatsapp, etc.)
                if (!systemSettings[ns]) systemSettings[ns] = {};
                
                let value = row.value;
                try {
                    value = (row.dataType === 'json' || (typeof row.value === 'string' && (row.value.startsWith('{') || row.value.startsWith('['))))
                        ? JSON.parse(row.value)
                        : row.value;
                } catch (e) {
                    value = row.value;
                }

                systemSettings[ns][row.key] = value;
                
                // For backward compatibility and UI simplicity, map system_setting/GENERAL to root
                if (rawNs === 'system_setting' || rawNs === 'GENERAL') {
                    systemSettings[row.key] = value;
                }
            });
        }
    } catch (e) {
        console.error("[SETTINGS-LOADER] Error fetching data:", e);
    }

    const settings = workspace?.settings ? (typeof workspace.settings === 'string' ? JSON.parse(workspace.settings) : workspace.settings) : {};

    const rbac = (rbacData as any)?.permissions || { admin: ['view', 'add', 'edit', 'delete'], user: ['view', 'add', 'edit'], guest: ['view'] };

    return {
        lang: params.lang,
        timestamp: Date.now(),
        systemSettings,
        initialSettings: {
            id: workspace?.id,
            workspaceId: workspace?.id,
            workspaceName: workspace?.name,
            ...settings
        },
        initialRbac: rbac,
        initialWorkspaces: (workspacesList as any[]).filter(Boolean),
        permissions: [
            { id: 'view', category: 'Core' },
            { id: 'add', category: 'Core' },
            { id: 'edit', category: 'Core' },
            { id: 'delete', category: 'Core' },
            { id: 'view_whatsapp', category: 'Messaging' },
            { id: 'view_gmail', category: 'Messaging' },
            { id: 'manage_auto_reply', category: 'Messaging' },
            { id: 'view_archive', category: 'System' },
            { id: 'view_print_queue', category: 'System' },
            { id: 'view_audit_logs', category: 'System' },
            { id: 'manage_users', category: 'Admin' },
            { id: 'manage_settings', category: 'Admin' },
            { id: 'manage_all_workspaces', category: 'Superadmin' },
            { id: '*', category: 'Superadmin' }
        ]
    };
}

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
    const navigate = useNavigate();
    const { lang } = useParams();
    const { permissions = [], initialSettings, initialRbac, systemSettings: initialSystemSettings = {} } = loaderData || {};
    const { user, hasPermission, switchWorkspace, users, usersLoading, fetchUsers } = useAuth();
    const { refreshConfig, constants: registry } = useConfig();
    const { t, i18n } = useTranslation(["common", "settings", "auth"]);
    const [searchParams, setSearchParams] = useSearchParams();

    const [settings, setSettings] = useState<any>(initialSettings || {});
    const [systemSettings, setSystemSettings] = useState<any>(initialSystemSettings || {});
    const [rbac, setRbac] = useState<any>(initialRbac || null);
    const [whatsappState, setWhatsappState] = useState<{status: string, qr?: string}>({ status: 'INITIALIZING' });

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab ] = useState(searchParams.get("tab") || "general");
    const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);

    // --- OPTIMISTIC AUTO-SAVE ENGINE ---
    const isFirstMount = useRef(true);
    const lastSavedSettings = useRef(JSON.stringify(settings));

    const debouncedSave = useMemo(() => 
        debounce(async (newSettings: any) => {
            const settingsStr = JSON.stringify(newSettings);
            if (settingsStr === lastSavedSettings.current) return;
            
            try {
                const response = await api.brain.post(`workspace/update-settings`, {
                    workspaceId: user?.workspaceId,
                    settings: newSettings
                });

                if (response.success) {
                    lastSavedSettings.current = settingsStr;
                    // Push to Local Agent
                    socketRequest('workspace:update-settings', { settings: newSettings }).catch(() => {
                        console.warn("Local sync pending...");
                    });
                }
            } catch (err) {
                console.error("Auto-save failed", err);
            }
        }, 2000),
    [user?.workspaceId]);

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        debouncedSave(settings);
    }, [settings, debouncedSave]);

    useEffect(() => {
        // Request initial status when tab is comms
        if (activeTab === 'comms') {
            socket.emit('whatsapp:qr');
        }

        const handleStatus = (data: any) => {
            if (data.status) {
                setWhatsappState({ status: data.status, qr: data.qr });
            }
        };

        socket.on('whatsapp:status', handleStatus);
        socket.on('whatsapp:qr', (data: any) => {
            if (data.qr) {
                setWhatsappState(prev => ({ ...prev, status: 'QR_RECEIVED', qr: data.qr }));
            }
        });

        return () => {
            socket.off('whatsapp:status', handleStatus);
            socket.off('whatsapp:qr');
        };
    }, [activeTab]);

    const allTabs = useMemo(() => {
        const base = [
            'profile', 'general', 'workspace', 'localization', 'notification', 
            'comms', 'appearance', 'ai'
        ];
        if (hasPermission('manage_users')) base.push('users');
        if (hasPermission('manage_roles')) base.push('roles');
        return base;
    }, [hasPermission]);

    const navigateTab = (direction: 'next' | 'prev') => {
        const currentIndex = allTabs.indexOf(activeTab);
        if (direction === 'next') {
            const nextIndex = (currentIndex + 1) % allTabs.length;
            setActiveTab(allTabs[nextIndex]);
        } else {
            const prevIndex = (currentIndex - 1 + allTabs.length) % allTabs.length;
            setActiveTab(allTabs[prevIndex]);
        }
    };

    const { theme: currentMode, setTheme: setMode, customTheme } = useTheme();

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    useEffect(() => {
        if (searchParams.get("tab") !== activeTab) {
            setSearchParams(prev => {
                prev.set("tab", activeTab);
                return prev;
            }, { replace: true });
        }
    }, [activeTab]);
    const [refreshing, setRefreshing] = useState(false);

    // Profile Tab State
    const [profileData, setProfileData] = useState({
        name: "",
        email: "",
        phone: "",
        company: "",
    });
    const [profileSaving, setProfileSaving] = useState(false);

    // Users Tab State
    const [discoverableContacts, setDiscoverableContacts] = useState<any[]>([]);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");
    const [selectedContactId, setSelectedContactId] = useState("");
    const [editingPermissions, setEditingPermissions] = useState<any>(null);
    const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
    const [isGlobalPerms, setIsGlobalPerms] = useState(false);

    // Registry Tab State - Moved to Superadmin

    // Prompts Tab State - Moved to Superadmin

    const [aiStats, setAiStats] = useState({ latency: 245, accuracy: "98.2", status: "online", engine: "cloudflare" });
    const [systemInfo, setSystemInfo] = useState<any>(null);

    const updateSystemSetting = useCallback((key: string, value: any, namespace?: string) => {
        setSystemSettings((prev: any) => {
            const next = { ...prev };
            if (namespace) {
                const ns = namespace.toLowerCase();
                next[ns] = { ...(next[ns] || {}), [key]: value };
                
                // Root mirror for core settings
                if (ns === 'system_setting' || ns === 'general') {
                    next[key] = value;
                }
            } else {
                next[key] = value;
            }
            return next;
        });

        socketRequest('system:update-setting', { key, value, namespace }).then((res: any) => {
            if (res.success) toast.success(t('common:saved'));
            else toast.error(res.error || t('common:error_saving'));
        });
    }, [t]);

    useEffect(() => {
        if (activeTab === 'maintenance' || activeTab === 'general') {
            socketRequest('system:info').then((res: any) => {
                if (res?.success) setSystemInfo(res.info || null);
            });
            socketRequest('system:get-settings').then((res: any) => {
                if (res?.success && res.settings) {
                    setSystemSettings(res.settings);
                }
            });
        }
    }, [activeTab]);

    useEffect(() => {
        if (user) {
            setProfileData({
                name: user.name || "",
                email: user.email || "",
                phone: user.phone || "",
                company: user.company || "",
            });
        }
    }, [user]);

    const fetchDiscoverableContacts = async () => {
        try {
            const response = await api.brain.get(`workspace/search-contact`);
            if (response.success) {
                setDiscoverableContacts(Array.isArray(response.data) ? response.data : []);
            }
        } catch (error) {
            console.error("Failed to fetch discoverable contact", error);
        }
    };

    const handleUpdateRole = async (userId: string, newRole: string) => {
        try {
            const userToUpdate = users.find(u => u.userId === userId || u.id === userId);
            const response = await api.brain.post(`workspace/add-user`, {
                workspaceId: user?.workspaceId,
                userId,
                role: newRole,
                email: userToUpdate?.email
            });
            if (response.success) {
                toast.success(t('settings:users.user_role_updated'));
                fetchUsers(true);
            }
        } catch (error) {
            toast.error(t('settings:users.failed_update_role'));
        }
    };

    const handleInvite = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!inviteEmail) return;

        try {
            const response = await api.brain.post(`workspace/add-user`, {
                workspaceId: user?.workspaceId,
                email: inviteEmail,
                role: inviteRole
            });
            if (response.success) {
                toast.success(t('settings:users.user_added_success'));
                setInviteEmail("");
                setSelectedContactId("");
                fetchUsers(true);
            }
        } catch (error) {
            toast.error(t('settings:users.failed_add_user'));
        }
    };

    const handleSaveUserPermissions = async () => {
        if (!editingPermissions) return;

        try {
            const response = await api.brain.post(`workspace/update-user-permissions`, {
                workspaceId: user?.workspaceId,
                userId: editingPermissions.userId || editingPermissions.id,
                permissions: selectedPerms,
                isGlobal: isGlobalPerms
            });

            if (response.success) {
                toast.success(t('settings:users.permissions_updated'));
                setEditingPermissions(null);
                fetchUsers(true);
            }
        } catch (error) {
            toast.error(t('settings:users.failed_update_permissions'));
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileSaving(true);

        try {
            const response = await api.brain.post(`auth/update-profile`, { 
                displayName: profileData.name,
                phone: profileData.phone,
                company: profileData.company
            });
            if (response.success) {
                toast.success(t('auth:profile.updated_success'));
            } else {
                toast.error(response.error || t('auth:profile.update_error'));
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || t('auth:profile.update_error'));
        } finally {
            setProfileSaving(false);
        }
    };

    const translatedPermissions = useMemo(() => {
        return (permissions || []).map((p: any) => {
          const labelKey = p.id === '*' ? 'wildcard' : p.id.replace('view_', '');
          return {
            ...p,
            label: t(`settings:users.perm_${labelKey}`, p.id)
          };
        });
    }, [t, permissions]);

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
            fetchDiscoverableContacts();
        }
        
        // Sync tab with URL
        if (searchParams.get("tab") !== activeTab) {
            setSearchParams(prev => {
                prev.set("tab", activeTab);
                return prev;
            }, { replace: true });
        }
    }, [activeTab, user?.workspaceId]);

    useEffect(() => {
        if (!user?.workspaceId) return;

        // Removed redundant fetchSettings, fetchRbac, fetchWorkspaces that were hitting the Brain API
        // which the loader already provides. This prevents a request storm on page load.
        
        if (activeTab === 'users') {
            fetchUsers();
            fetchDiscoverableContacts();
        }
        
        // Finalize loading state immediately if we have data or after a short delay
        if (initialSettings) {
             setLoading(false);
        } else {
            const timer = setTimeout(() => setLoading(false), 500);
            return () => clearTimeout(timer);
        }

    }, [user?.workspaceId, user?.id, hasPermission, activeTab, initialSettings]);

    const handleSave = async () => {
        try {
            const response = await api.brain.post(`workspace/update-settings`, {
                workspaceId: user?.workspaceId,
                settings
            });

            // ALSO save to Local Agent via Socket to ensure workers get the update immediately
            try {
                await socketRequest('workspace:update-settings', { settings });
            } catch (localErr) {
                console.warn("Failed to sync settings to Local Agent, but saved to Cloud.");
            }

            if (response.success) {
                toast.success(t('settings:settings_saved'));
            } else {
                toast.error(response.error || t('settings:failed_save'));
            }
        } catch (error) {
            toast.error(t('settings:failed_save'));
        }
    };

    const handleSaveRbac = async () => {
        try {
            const response = await api.brain.post(`workspace/update-rbac`, {
                workspaceId: user?.workspaceId,
                userRoles: rbac?.userRoles || []
            });
            if (response.success) {
                toast.success(t('settings:perms_updated'));
            } else {
                toast.error(response.error || t('settings:failed_update_perms'));
            }
        } catch (error) {
            toast.error(t('settings:failed_update_perms'));
        }
    };

    const togglePermission = (role: string, permission: string) => {
        const currentPerms = rbac[role] || [];
        const newPerms = currentPerms.includes(permission)
            ? currentPerms.filter((p: string) => p !== permission)
            : [...currentPerms, permission];
        
        setRbac({
            ...rbac,
            [role]: newPerms
        });
    };

    const requestBrowserNotification = async () => {
        if (!("Notification" in window)) {
            toast.error(t('settings:browser_notifs_not_supported'));
            return false;
        }

        if (Notification.permission === "granted") return true;

        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            toast.success(t('settings:browser_notifs_enabled'));
            return true;
        } else {
            toast.error(t('settings:browser_notifs_denied'));
            return false;
        }
    };

    const allAvailablePermissions = useMemo(() => [
        { id: 'view', label: t('settings:permissions.view') },
        { id: 'add', label: t('settings:permissions.add') },
        { id: 'edit', label: t('settings:permissions.edit') },
        { id: 'delete', label: t('settings:permissions.delete') },
        { id: 'view_whatsapp', label: t('settings:permissions.view_whatsapp') },
        { id: 'view_gmail', label: t('settings:permissions.view_gmail') },
        { id: 'manage_auto_reply', label: t('settings:permissions.manage_auto_reply') },
        { id: 'manage_users', label: t('settings:permissions.manage_users') },
        { id: 'manage_roles', label: t('settings:permissions.manage_roles') },
        { id: 'manage_settings', label: t('settings:permissions.manage_settings') },
        { id: 'view_audit_logs', label: t('settings:permissions.view_audit_logs') },
        { id: 'view_archive', label: t('settings:permissions.view_archive') },
        { id: 'view_print_queue', label: t('settings:permissions.view_print_queue') },
    ], [t]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Settings className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
                </div>
                <p className="text-muted-foreground font-medium animate-pulse">{renderString(t("common:loading"), lang)}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 pb-32">
            <div className="flex items-center justify-between mb-2">
                <div>
                   <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                       {renderString(t('settings:settings_title', 'Configuration'), lang)}
                   </h1>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                       {renderString(t('settings:settings_desc', 'Manage your workspace environment and global settings'), lang)}
                   </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-slate-200 bg-white" onClick={() => navigateTab('prev')}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl border-slate-200 bg-white" onClick={() => navigateTab('next')}>
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="h-auto p-1 bg-slate-100/50 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-1 mb-8">
                    {[
                        { id: 'general', label: renderString(t('settings:tabs.general'), lang), icon: Building },
                        { id: 'ai', label: renderString(t('settings:tabs.ai'), lang), icon: Sparkles },
                        { id: 'comms', label: renderString(t('settings:tabs.comms'), lang), icon: MessageSquare },
                        { id: 'users', label: renderString(t('settings:tabs.users'), lang), icon: Users },
                    ].map((tab) => (
                        <TabsTrigger 
                            key={tab.id} 
                            value={tab.id}
                            className="rounded-xl py-3 font-black uppercase italic tracking-widest text-[10px] flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all"
                        >
                            <tab.icon size={14} />
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="general" className="mt-0 focus-visible:outline-none focus:ring-0">
                    <GeneralTab 
                        settings={settings}
                        setSettings={setSettings}
                        systemSettings={systemSettings}
                        setSystemSettings={setSystemSettings}
                        updateSystemSetting={updateSystemSetting}
                        systemInfo={systemInfo}
                        handleSave={handleSave}
                    />
                </TabsContent>

                <TabsContent value="ai" className="mt-0 focus-visible:outline-none focus:ring-0">
                    <AITab 
                        settings={settings}
                        setSettings={setSettings}
                        systemSettings={systemSettings}
                        setSystemSettings={setSystemSettings}
                        updateSystemSetting={updateSystemSetting}
                    />
                </TabsContent>

                <TabsContent value="comms" className="mt-0 focus-visible:outline-none focus:ring-0">
                    <CommsTab 
                        settings={settings}
                        setSettings={setSettings}
                        systemSettings={systemSettings}
                        setSystemSettings={setSystemSettings}
                        updateSystemSetting={updateSystemSetting}
                        whatsappState={whatsappState}
                    />
                </TabsContent>

                <TabsContent value="users" className="mt-0 focus-visible:outline-none focus:ring-0">
                    <UsersTab 
                        users={users}
                        loading={usersLoading}
                        inviteEmail={inviteEmail}
                        setInviteEmail={setInviteEmail}
                        inviteRole={inviteRole}
                        setInviteRole={setInviteRole}
                        handleInvite={handleInvite}
                        handleUpdateRole={handleUpdateRole}
                        handleRemoveUser={async (uId) => {
                            if (confirm(t('settings:users.remove_confirm'))) {
                                try {
                                    const res = await api.brain.delete(`workspace/remove-user?userId=${uId}&workspaceId=${user?.workspaceId}`);
                                    if (res.success) {
                                        toast.success(t('settings:users.user_removed_success'));
                                        fetchUsers(true);
                                    }
                                } catch (e) { toast.error(t('settings:users.failed_remove_user')); }
                            }
                        }}
                        entities={registry?.ENTITY_CONFIGS || {}}
                        roles={registry?.AUTH_CONFIG?.roles || {}}
                        workspaceId={user?.workspaceId || ""}
                        api={api}
                        toast={toast}
                    />
                </TabsContent>
            </Tabs>
            <ThemeEditor 
                isOpen={isThemeEditorOpen} 
                onClose={() => setIsThemeEditorOpen(false)} 
            />

            {/* FIXED BOTTOM ACTION BAR */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 px-6 md:px-12 z-50 flex items-center justify-end gap-4 animate-in slide-in-from-bottom duration-500">
                <Button 
                    variant="default" 
                    size="lg" 
                    onClick={handleSave} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 px-12 shadow-2xl shadow-indigo-200 dark:shadow-none transition-all hover:-translate-y-1 active:scale-95 font-black uppercase italic tracking-widest text-sm"
                >
                    <Save className="mr-2 h-5 w-5" />
                    {renderString(t("common:save"), lang)}
                </Button>
            </div>
        </div>
    );
}

